/**
 * OpenAPI Specification Generator Utilities
 *
 * Consolidates OpenAPI 3.1.0 specification generation logic for reuse across
 * the application. Builds complete schemas from class definitions and their properties.
 */

/**
 * Extracts class name from a JSON Schema $ref string
 * @param ref - The $ref string (e.g., "#/components/schemas/Person")
 * @returns The class name or null if not found
 */
export function extractClassNameFromRef(ref: string): string | null {
  if (!ref) return null;

  if (ref.includes('/')) {
    const parts = ref.split('/');
    return parts[parts.length - 1] || null;
  }
  return ref;
}

/**
 * Recursively finds all class names referenced in a schema object via $ref
 * @param obj - The schema object to search
 * @param refs - Set to accumulate found class names
 */
export function findReferencedClasses(obj: any, refs: Set<string>): void {
  if (!obj || typeof obj !== 'object') return;

  if (obj.$ref && typeof obj.$ref === 'string') {
    const className = extractClassNameFromRef(obj.$ref);
    if (className) refs.add(className);
  }

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      findReferencedClasses(obj[key], refs);
    }
  }
}

/**
 * Builds property schema with nested children for object types
 * @param prop - The property to build schema for
 * @param allProperties - All properties to find children
 * @returns Property schema object with nested properties if applicable
 */
function buildPropertySchema(prop: any, allProperties: any[]): any {
  const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : { ...prop.data };

  // Clean up description handling
  if (propData.description === null) {
    delete propData.description;
    if (propData.title) {
      propData.description = propData.title;
    }
  }

  // If this property has type "object" and no $ref, check for nested properties
  if (propData.type === 'object' && !propData.$ref) {
    // Find all child properties
    const children = allProperties.filter((p: any) => p.parent_id === prop.id);

    if (children.length > 0) {
      // Build nested properties object
      const nestedProperties: any = {};
      const nestedRequired: string[] = [];

      children.forEach((child: any) => {
        const childSchema = buildPropertySchema(child, allProperties);

        // Handle required flag for nested properties
        if (childSchema.required) {
          nestedRequired.push(child.name);
          delete childSchema.required;
        }
        if (childSchema.required === false) {
          delete childSchema.required;
        }

        nestedProperties[child.name] = childSchema;
      });

      // Add nested properties to the object schema
      propData.properties = nestedProperties;

      if (nestedRequired.length > 0) {
        propData.required = nestedRequired;
      }
    }
  }

  // If this property is an array of inline objects, ensure items is present and nest children under items
  if (propData.type === 'array') {
    const children = allProperties.filter((p: any) => p.parent_id === prop.id);

    // If children exist but items is missing, infer items as an inline object
    if (children.length > 0 && !propData.items) {
      propData.items = { type: 'object' };
    }

    if (propData.items && !propData.items.$ref && (propData.items.type === 'object' || children.length > 0)) {
      const nestedProperties: any = {};
      const nestedRequired: string[] = [];

      children.forEach((child: any) => {
        const childSchema = buildPropertySchema(child, allProperties);
        if (childSchema.required) {
          nestedRequired.push(child.name);
          delete childSchema.required;
        }
        if (childSchema.required === false) {
          delete childSchema.required;
        }
        nestedProperties[child.name] = childSchema;
      });

      // Ensure items is an object and attach nested properties
      propData.items = { ...(propData.items || {}), type: 'object', properties: nestedProperties };
      if (nestedRequired.length > 0) {
        propData.items.required = nestedRequired;
      } else if (propData.items.required !== undefined) {
        delete propData.items.required;
      }
    }
  }

  return propData;
}

/**
 * Builds a JSON Schema from a class definition and its properties
 * @param classData - The class data including name, description, schema, and properties array
 * @returns A JSON Schema object representing the class
 */
export function buildClassSchema(classData: any): any {
  const schema = typeof classData.schema === 'string'
    ? JSON.parse(classData.schema)
    : (classData.schema || {});

  // Remove properties and required from schema to prevent overwriting
  // We build these from the class_properties table instead
  const { properties: _schemaProperties, required: _schemaRequired, ...schemaWithoutProperties } = schema;

  const properties: any = {};
  const required: string[] = [];

  if (classData.properties && classData.properties.length > 0) {
    // Only process top-level properties (those without parent_id)
    const topLevelProperties = classData.properties.filter((prop: any) => !prop.parent_id);

    topLevelProperties.forEach((prop: any) => {
      const propSchema = buildPropertySchema(prop, classData.properties);

      // Handle required flag - it belongs in the class schema's required array, not the property
      if (propSchema.required) {
        required.push(prop.name);
        delete propSchema.required;
      }

      // If property data explicitly sets required=false, remove the field
      if (propSchema.required === false) {
        delete propSchema.required;
      }

      properties[prop.name] = propSchema;
    });
  }

  // Check if schema has composition keywords (allOf/anyOf/oneOf)
  const hasComposition = schemaWithoutProperties.allOf || schemaWithoutProperties.anyOf || schemaWithoutProperties.oneOf;

  let classSchema: any;

  if (hasComposition) {
    // Preserve composition structure - don't add type, properties, or required at root
    // These belong inside the composition items, not at the root level
    classSchema = {
      description: classData.description || undefined,
      ...schemaWithoutProperties
    };
  } else {
    // Normal schema without compositions - build as usual
    classSchema = {
      type: 'object',
      description: classData.description || undefined,
      ...schemaWithoutProperties,
      properties,
      required: required.length > 0 ? required : undefined
    };
  }

  // Delete class properties if properties is empty
  if (classSchema.properties && Object.keys(classSchema.properties).length === 0) {
    delete classSchema.properties;
  }

  // Remove undefined values
  Object.keys(classSchema).forEach(key => {
    if (classSchema[key] === undefined) {
      delete classSchema[key];
    }
  });

  return classSchema;
}

/**
 * Generates a complete OpenAPI 3.1.0 specification from class definitions
 * @param classes - Array of class data objects with properties
 * @param options - Optional metadata for the spec
 * @returns OpenAPI document as a JSON string
 */
export function generateOpenApiSpec(
  classes: any[],
  options?: {
    projectName?: string;
    version?: string;
    description?: string;
  }
): string {
  const schemas: any = {};

  // Build schema for each class
  classes.forEach((cls) => {
    schemas[cls.name] = buildClassSchema(cls);
  });

  const openApiDoc = {
    openapi: '3.1.0',
    info: {
      title: options?.projectName || 'API Schema',
      version: options?.version || '1.0.0',
      description: options?.description || 'Generated OpenAPI 3.1.0 specification from Objectified Studio'
    },
    components: {
      schemas
    }
  };

  return JSON.stringify(openApiDoc, null, 2);
}

/**
 * Generates an OpenAPI specification for a single class and its referenced dependencies
 * @param classData - The primary class to generate spec for
 * @param allClasses - All available classes (to resolve references)
 * @param options - Optional metadata for the spec
 * @returns OpenAPI document as an object (not stringified)
 */
export function generateClassOpenApiSpec(
  classData: any,
  allClasses: any[],
  options?: {
    title?: string;
    version?: string;
    description?: string;
  }
): any {
  const referencedClasses = new Set<string>();

  // Find all referenced classes in the primary class
  const schema = typeof classData.schema === 'string'
    ? JSON.parse(classData.schema)
    : (classData.schema || {});

  findReferencedClasses(schema, referencedClasses);

  // Also check properties for references
  if (classData.properties && classData.properties.length > 0) {
    classData.properties.forEach((prop: any) => {
      const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
      findReferencedClasses(propData, referencedClasses);
    });
  }

  // Build schemas for the main class and all referenced classes
  const schemas: any = {
    [classData.name]: buildClassSchema(classData)
  };

  // Recursively resolve all transitive references
  const processedClasses = new Set<string>([classData.name]);
  const classesToProcess = Array.from(referencedClasses);

  while (classesToProcess.length > 0) {
    const className = classesToProcess.shift()!;

    if (processedClasses.has(className)) {
      continue; // Skip already processed classes
    }

    processedClasses.add(className);

    const referencedClassData = allClasses.find((cls: any) => cls.name === className);

    if (referencedClassData) {
      schemas[className] = buildClassSchema(referencedClassData);

      // Find references within this referenced class (transitive references)
      const transitiveRefs = new Set<string>();
      const refSchema = typeof referencedClassData.schema === 'string'
        ? JSON.parse(referencedClassData.schema)
        : (referencedClassData.schema || {});

      findReferencedClasses(refSchema, transitiveRefs);

      // Also check properties for references
      if (referencedClassData.properties && referencedClassData.properties.length > 0) {
        referencedClassData.properties.forEach((prop: any) => {
          const propData = typeof prop.data === 'string' ? JSON.parse(prop.data) : prop.data;
          findReferencedClasses(propData, transitiveRefs);
        });
      }

      // Add new references to the queue
      transitiveRefs.forEach(refClassName => {
        if (!processedClasses.has(refClassName) && !classesToProcess.includes(refClassName)) {
          classesToProcess.push(refClassName);
        }
      });
    } else {
      // Create placeholder for missing references
      schemas[className] = {
        type: 'object',
        description: `Referenced schema: ${className} (not loaded)`,
        properties: {}
      };
    }
  }

  return {
    openapi: '3.1.0',
    info: {
      title: options?.title || `${classData.name} Schema`,
      version: options?.version || '1.0.0',
      description: options?.description || 'OpenAPI 3.1.0 schema definition'
    },
    components: {
      schemas
    }
  };
}
