import { PropertyFormData } from './PropertyFormFields';

export type LintLevel = 'error' | 'warning' | 'info';

export type LintCode =
  | 'name-missing'
  | 'name-pattern'
  | 'description-missing'
  | 'pattern-invalid'
  | 'pattern-without-string'
  | 'format-without-string'
  | 'length-range-inverted'
  | 'numeric-range-inverted'
  | 'items-range-inverted'
  | 'props-range-inverted'
  | 'default-and-const'
  | 'readonly-and-writeonly'
  | 'enum-and-const'
  | 'deprecated-without-message'
  | 'multipleof-non-positive'
  | 'min-contains-without-contains'
  | 'examples-invalid-json';

export interface PropertyLintDiagnostic {
  code: LintCode;
  level: LintLevel;
  /** Section the diagnostic belongs to (matches FormSectionNav ids). */
  section: string;
  /** Optional anchor field id (e.g. for inline highlight). */
  field?: string;
  message: string;
}

export interface PropertyLintInput {
  propertyName: string;
  propertyType: string;
  propertyIsArray: boolean;
  formData: PropertyFormData;
  mode: 'add' | 'edit';
}

const isFiniteNumber = (s: string | undefined): boolean => {
  if (!s || !s.trim()) return false;
  const n = Number(s);
  return Number.isFinite(n);
};

const toNumber = (s: string | undefined): number | undefined => {
  if (!s || !s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Run all lint rules against the current form state and return a flat list of
 * diagnostics. Errors block save; warnings are advisory.
 */
export function lintProperty(input: PropertyLintInput): PropertyLintDiagnostic[] {
  const { propertyName, propertyType, propertyIsArray, formData, mode } = input;
  const diagnostics: PropertyLintDiagnostic[] = [];
  const baseType = propertyIsArray ? 'array' : propertyType;

  if (mode === 'add' && !propertyName.trim()) {
    diagnostics.push({
      code: 'name-missing',
      level: 'error',
      section: 'identity',
      field: 'propertyName',
      message: 'Property name is required.',
    });
  } else if (propertyName && !/^[A-Za-z][A-Za-z0-9_]*$/.test(propertyName)) {
    diagnostics.push({
      code: 'name-pattern',
      level: 'warning',
      section: 'identity',
      field: 'propertyName',
      message: 'Names should start with a letter and use only letters, numbers, and underscores.',
    });
  }

  if (!formData.description?.trim()) {
    diagnostics.push({
      code: 'description-missing',
      level: 'warning',
      section: 'identity',
      field: 'description',
      message: 'Adding a description improves generated docs and IDE hints.',
    });
  }

  if (formData.pattern?.trim()) {
    try {
      new RegExp(formData.pattern);
    } catch {
      diagnostics.push({
        code: 'pattern-invalid',
        level: 'error',
        section: 'constraints',
        field: 'pattern',
        message: 'Pattern is not a valid regular expression.',
      });
    }
    if (baseType !== 'string' && propertyType !== 'string') {
      diagnostics.push({
        code: 'pattern-without-string',
        level: 'warning',
        section: 'constraints',
        field: 'pattern',
        message: 'Pattern is only meaningful for string types and will be ignored otherwise.',
      });
    }
  }

  if (formData.format?.trim() && propertyType !== 'string') {
    diagnostics.push({
      code: 'format-without-string',
      level: 'warning',
      section: 'type-format',
      field: 'format',
      message: 'Format is only defined for string types in OpenAPI 3.1.',
    });
  }

  const minLen = toNumber(formData.minLength);
  const maxLen = toNumber(formData.maxLength);
  if (minLen !== undefined && maxLen !== undefined && minLen > maxLen) {
    diagnostics.push({
      code: 'length-range-inverted',
      level: 'error',
      section: 'constraints',
      field: 'minLength',
      message: `minLength (${minLen}) cannot exceed maxLength (${maxLen}).`,
    });
  }

  const minNum = toNumber(formData.minimum);
  const maxNum = toNumber(formData.maximum);
  if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
    diagnostics.push({
      code: 'numeric-range-inverted',
      level: 'error',
      section: 'constraints',
      field: 'minimum',
      message: `minimum (${minNum}) cannot exceed maximum (${maxNum}).`,
    });
  }

  if (isFiniteNumber(formData.multipleOf)) {
    const mo = Number(formData.multipleOf);
    if (mo <= 0) {
      diagnostics.push({
        code: 'multipleof-non-positive',
        level: 'error',
        section: 'constraints',
        field: 'multipleOf',
        message: 'multipleOf must be greater than 0.',
      });
    }
  }

  const minItems = toNumber(formData.minItems);
  const maxItems = toNumber(formData.maxItems);
  if (minItems !== undefined && maxItems !== undefined && minItems > maxItems) {
    diagnostics.push({
      code: 'items-range-inverted',
      level: 'error',
      section: 'constraints',
      field: 'minItems',
      message: `minItems (${minItems}) cannot exceed maxItems (${maxItems}).`,
    });
  }

  const minProps = toNumber(formData.minProperties);
  const maxProps = toNumber(formData.maxProperties);
  if (minProps !== undefined && maxProps !== undefined && minProps > maxProps) {
    diagnostics.push({
      code: 'props-range-inverted',
      level: 'error',
      section: 'constraints',
      field: 'minProperties',
      message: `minProperties (${minProps}) cannot exceed maxProperties (${maxProps}).`,
    });
  }

  if (
    (toNumber(formData.minContains) !== undefined || toNumber(formData.maxContains) !== undefined) &&
    !formData.contains?.trim()
  ) {
    diagnostics.push({
      code: 'min-contains-without-contains',
      level: 'warning',
      section: 'constraints',
      field: 'contains',
      message: 'minContains / maxContains have no effect without a contains schema.',
    });
  }

  if (formData.default?.trim() && formData.const?.trim()) {
    diagnostics.push({
      code: 'default-and-const',
      level: 'error',
      section: 'defaults',
      field: 'default',
      message: 'A property cannot define both default and const.',
    });
  }

  if (formData.const?.trim() && (formData.enum?.length ?? 0) > 0) {
    diagnostics.push({
      code: 'enum-and-const',
      level: 'error',
      section: 'defaults',
      field: 'const',
      message: 'const and enum are mutually exclusive — pick one.',
    });
  }

  if (formData.readOnly && formData.writeOnly) {
    diagnostics.push({
      code: 'readonly-and-writeonly',
      level: 'error',
      section: 'flags',
      field: 'readOnly',
      message: 'A property cannot be both readOnly and writeOnly.',
    });
  }

  if (formData.deprecated && !formData.deprecationMessage?.trim()) {
    diagnostics.push({
      code: 'deprecated-without-message',
      level: 'warning',
      section: 'flags',
      field: 'deprecationMessage',
      message: 'Add a deprecation message so consumers know what to migrate to.',
    });
  }

  if (formData.examples?.length) {
    formData.examples.forEach((ex, idx) => {
      try {
        JSON.parse(ex);
      } catch {
        diagnostics.push({
          code: 'examples-invalid-json',
          level: 'warning',
          section: 'defaults',
          field: `examples[${idx}]`,
          message: `Example #${idx + 1} is not valid JSON and may be rendered as a string.`,
        });
      }
    });
  }

  return diagnostics;
}

export interface DiagnosticCounts {
  errors: number;
  warnings: number;
  info: number;
}

export function countDiagnostics(diagnostics: PropertyLintDiagnostic[]): DiagnosticCounts {
  return diagnostics.reduce<DiagnosticCounts>(
    (acc, d) => {
      if (d.level === 'error') acc.errors += 1;
      else if (d.level === 'warning') acc.warnings += 1;
      else acc.info += 1;
      return acc;
    },
    { errors: 0, warnings: 0, info: 0 },
  );
}

export function bySection(
  diagnostics: PropertyLintDiagnostic[],
): Record<string, PropertyLintDiagnostic[]> {
  return diagnostics.reduce<Record<string, PropertyLintDiagnostic[]>>((acc, d) => {
    if (!acc[d.section]) acc[d.section] = [];
    acc[d.section].push(d);
    return acc;
  }, {});
}
