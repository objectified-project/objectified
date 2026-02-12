import { Importer, ImportSourceKind, NormalizeOptions, NormalizeResult, NormalizedClass, NormalizedProperty } from './index';
import { applyNamingConventionToClasses } from '../../src/app/utils/naming-conventions';
import { getSmartClassName } from '../schema-context-naming';
import { collectReservedNameWarnings } from './reserved-names';

// Utility: extract direct properties and nested inline children similar to src/app/utils/openapi-import.ts
const extractDirectProperties = (schema: any): { properties: Record<string, any>; required: string[] } => {
  const result = { properties: {} as Record<string, any>, required: [] as string[] };
  if (!schema) return result;

  // First, always include top-level properties if they exist
  if (schema.properties) {
    Object.assign(result.properties, schema.properties);
  }
  if (Array.isArray(schema.required)) {
    result.required.push(...schema.required);
  }

  // Then also check allOf for additional inline properties (not $refs)
  if (schema.allOf && Array.isArray(schema.allOf)) {
    for (const item of schema.allOf) {
      // Skip $ref items - those are class references, not inline properties
      if (item.$ref) continue;
      // Skip if/then/else conditional rules - those don't define properties to import
      if (item.if !== undefined) continue;
      // Include inline properties from allOf items
      if (item.properties) Object.assign(result.properties, item.properties);
      if (Array.isArray(item.required)) result.required.push(...item.required);
    }
  }

  // For anyOf/oneOf without top-level properties, return empty (these are variant types)
  if ((schema.anyOf || schema.oneOf) && Object.keys(result.properties).length === 0) {
    return result;
  }

  return result;
};

/** Build external type key from property data for type mapping (#757). Returns null for refs or missing type. */
export function getExternalTypeKey(data: any): string | null {
  if (!data || typeof data !== 'object' || data.$ref) return null;
  const t = data.type;
  if (!t || typeof t !== 'string') return null;
  const f = data.format;
  return f && typeof f === 'string' ? `${t}:${f}` : t;
}

/** Apply type mapping to a single property data object (recurses into items). Refs are not modified. */
function applyTypeMappingToData(data: any, typeMapping: Record<string, any>): any {
  if (!data || typeof data !== 'object') return data;
  if (data.$ref) return data;
  const next = { ...data };
  if (next.items && typeof next.items === 'object') {
    next.items = applyTypeMappingToData(next.items, typeMapping);
  }
  const key = getExternalTypeKey(next);
  if (key && typeMapping[key]) {
    const internal = typeMapping[key];
    const merged = typeof internal === 'object' && internal !== null ? { ...internal } : { type: internal };
    if (next.required !== undefined) merged.required = next.required;
    return merged;
  }
  return next;
}

/** Apply type mapping to a normalized property and its children. */
function applyTypeMappingToProperty(p: NormalizedProperty, typeMapping: Record<string, any>): NormalizedProperty {
  const data = applyTypeMappingToData(p.data, typeMapping);
  const children = p.children?.map((c) => applyTypeMappingToProperty(c, typeMapping));
  return { ...p, data, children };
}

/** Apply global default values to a property when it has no default (#758). Recurse into children and items. */
function applyDefaultValuesToProperty(p: NormalizedProperty, defaultValues: Record<string, any>): NormalizedProperty {
  if (!defaultValues || Object.keys(defaultValues).length === 0) return p;
  const data = p.data && typeof p.data === 'object' ? { ...p.data } : p.data;
  if (data && !data.$ref && data.default === undefined) {
    const key = getExternalTypeKey(data);
    if (key && key in defaultValues) {
      data.default = defaultValues[key];
    }
  }
  if (data?.items && typeof data.items === 'object' && !data.items.$ref && data.items.default === undefined) {
    const key = getExternalTypeKey(data.items);
    if (key && key in defaultValues) {
      data.items = { ...data.items, default: defaultValues[key] };
    }
  }
  const children = p.children?.map((c) => applyDefaultValuesToProperty(c, defaultValues));
  return { ...p, data, children };
}

/** Recursively collect external type keys from a property schema. */
function collectKeysFromProp(prop: any, keys: Set<string>): void {
  if (!prop || typeof prop !== 'object') return;
  if (prop.$ref) return;
  const key = getExternalTypeKey(prop);
  if (key) keys.add(key);
  if (prop.type === 'object' && prop.properties) {
    for (const child of Object.values(prop.properties)) collectKeysFromProp(child as any, keys);
  }
  if (prop.type === 'array' && prop.items) collectKeysFromProp(prop.items, keys);
}

/** Collect all external type keys present in the given document for selected schemas (#757). */
export function collectExternalTypeKeysFromDocument(document: any, selectedSchemas: string[]): string[] {
  const schemas = document?.components?.schemas || {};
  const selected = new Set(selectedSchemas);
  const keys = new Set<string>();
  for (const [schemaName, schema] of Object.entries<any>(schemas)) {
    if (!selected.has(schemaName)) continue;
    const { properties } = extractDirectProperties(schema);
    for (const prop of Object.values(properties)) collectKeysFromProp(prop, keys);
  }
  return Array.from(keys).sort();
}

const convertProperty = (propName: string, propSchema: any, required: string[] = []): NormalizedProperty => {
  const data: any = { ...propSchema };
  const description = data.description;
  delete data.description;

  if (required.includes(propName)) data.required = true;

  const result: NormalizedProperty = { name: propName, data, description };

  // Inline object
  if (propSchema.type === 'object' && propSchema.properties) {
    const nestedRequired = Array.isArray(propSchema.required) ? propSchema.required : [];
    const children: NormalizedProperty[] = [];
    delete data.properties;
    delete data.required;
    for (const childName of Object.keys(propSchema.properties)) {
      children.push(convertProperty(childName, propSchema.properties[childName], nestedRequired));
    }
    result.children = children;
  }

  // Array of objects
  if (propSchema.type === 'array' && propSchema.items?.type === 'object' && propSchema.items.properties) {
    const nestedRequired = Array.isArray(propSchema.items.required) ? propSchema.items.required : [];
    const children: NormalizedProperty[] = [];
    const items = { ...propSchema.items };
    delete items.properties;
    delete items.required;
    data.items = items;
    for (const childName of Object.keys(propSchema.items.properties)) {
      children.push(convertProperty(childName, propSchema.items.properties[childName], nestedRequired));
    }
    result.children = children;
  }

  return result;
};

export const openApiImporter: Importer = {
  kind: 'openapi' as ImportSourceKind,
  normalize({ document, options }: { document: any; options: NormalizeOptions }): NormalizeResult {
    const classes: NormalizedClass[] = [];
    const warnings: string[] = [];

    const schemas = document?.components?.schemas || {};
    const selected = new Set(options.selectedSchemas || Object.keys(schemas));

    const classNameMap = options.classNameMap;

    for (const [schemaName, originalSchema] of Object.entries<any>(schemas)) {
      if (!selected.has(schemaName)) continue;

      const { properties, required } = extractDirectProperties(originalSchema);
      const props: NormalizedProperty[] = [];
      for (const propName of Object.keys(properties)) {
        props.push(convertProperty(propName, properties[propName], required));
      }

      // Smart naming from schema context (#753): title / x-class-name / then schema key
      const baseName = classNameMap?.[schemaName] ?? getSmartClassName(schemaName, originalSchema);

      classes.push({
        name: baseName,
        originalSchemaKey: schemaName,
        description: originalSchema?.description ?? null,
        schema: originalSchema,
        properties: props
      });
    }

    if (classes.length === 0) warnings.push('No selected schemas to import.');

    // Required field override (#759): apply before naming so we key by original schema + property name
    const requiredOverrides = options.requiredOverrides;
    let classesAfterRequired = classes;
    if (requiredOverrides && Object.keys(requiredOverrides).length > 0) {
      classesAfterRequired = classes.map((cls) => {
        const schemaKey = cls.originalSchemaKey ?? cls.name;
        const overrides = requiredOverrides[schemaKey];
        if (!overrides || typeof overrides !== 'object') return cls;
        const newProps = (cls.properties ?? []).map((p) => {
          if (overrides[p.name] === undefined) return p;
          const data = p.data && typeof p.data === 'object' ? { ...p.data, required: Boolean(overrides[p.name]) } : p.data;
          return { ...p, data };
        });
        return { ...cls, properties: newProps };
      });
    }

    // Description override (#760): add or modify property descriptions during import
    const descriptionOverrides = options.descriptionOverrides;
    if (descriptionOverrides && Object.keys(descriptionOverrides).length > 0) {
      classesAfterRequired = classesAfterRequired.map((cls) => {
        const schemaKey = cls.originalSchemaKey ?? cls.name;
        const overrides = descriptionOverrides[schemaKey];
        if (!overrides || typeof overrides !== 'object') return cls;
        const newProps = (cls.properties ?? []).map((p) => {
          if (!(p.name in overrides)) return p;
          const desc = overrides[p.name];
          return { ...p, description: desc === '' ? undefined : desc };
        });
        return { ...cls, properties: newProps };
      });
    }

    // Apply naming convention enforcement (#581)
    const applyNaming = options.applyNamingConvention === true;
    let finalClasses = applyNaming
      ? applyNamingConventionToClasses(classesAfterRequired, {
          classNamingConvention: options.classNamingConvention ?? 'PascalCase',
          propertyNamingConvention: options.propertyNamingConvention ?? 'camelCase',
          applyNamingConvention: true,
        })
      : classesAfterRequired;

    // Apply prefix/suffix rules to class names (#755)
    const prefix = (options.classPrefix ?? '').trim();
    const suffix = (options.classSuffix ?? '').trim();
    if (prefix || suffix) {
      const nameToFinal = new Map<string, string>();
      for (const cls of finalClasses) {
        const finalName = prefix + cls.name + suffix;
        nameToFinal.set(cls.name, finalName);
        if (cls.originalSchemaKey && cls.originalSchemaKey !== cls.name) nameToFinal.set(cls.originalSchemaKey, finalName);
      }
      const updateRefs = (data: any): any => {
        if (!data || typeof data !== 'object') return data;
        const result = { ...data };
        if (typeof result.$ref === 'string') {
          const match = result.$ref.match(/#\/components\/schemas\/(.+)$/);
          if (match && nameToFinal.has(match[1])) {
            result.$ref = `#/components/schemas/${nameToFinal.get(match[1])}`;
          }
        }
        if (result.items && typeof result.items === 'object' && result.items.$ref) {
          const match = result.items.$ref.match(/#\/components\/schemas\/(.+)$/);
          if (match && nameToFinal.has(match[1])) {
            result.items = { ...result.items, $ref: `#/components/schemas/${nameToFinal.get(match[1])}` };
          }
        }
        return result;
      };
      const transformProp = (p: NormalizedProperty): NormalizedProperty => {
        const newData = p.data ? updateRefs(p.data) : p.data;
        const result: NormalizedProperty = { ...p, data: newData };
        if (p.children?.length) result.children = p.children.map(transformProp);
        return result;
      };
      finalClasses = finalClasses.map((cls) => ({
        ...cls,
        name: prefix + cls.name + suffix,
        properties: cls.properties?.map(transformProp) ?? cls.properties,
      }));
    }

    // Reserved name detection (#756): warn on class and property names that conflict with keywords
    warnings.push(...collectReservedNameWarnings(finalClasses));

    // Type mapping (#757): map external types to internal types for imported properties
    const typeMapping = options.typeMapping;
    let classesOut =
      typeMapping && Object.keys(typeMapping).length > 0
        ? finalClasses.map((cls) => ({
            ...cls,
            properties: (cls.properties ?? []).map((p) => applyTypeMappingToProperty(p, typeMapping)),
          }))
        : finalClasses;

    // Default value assignment (#758): set global defaults for properties that have no default
    const defaultValues = options.defaultValues;
    if (defaultValues && Object.keys(defaultValues).length > 0) {
      classesOut = classesOut.map((cls) => ({
        ...cls,
        properties: (cls.properties ?? []).map((p) => applyDefaultValuesToProperty(p, defaultValues)),
      }));
    }

    return { classes: classesOut, warnings };
  }
};

