import { PropertyFormData } from './PropertyFormFields';
import { PropertyLintDiagnostic } from './propertyLint';

export interface PropertySuggestion {
  /** Section to scroll to when the user clicks the suggestion. */
  section: string;
  /** Short headline shown in the suggestion card. */
  title: string;
  /** Supporting description / reason. */
  description: string;
  /** Optional CTA text. Defaults to "Jump to section". */
  cta?: string;
}

interface SuggestInput {
  propertyName: string;
  propertyType: string;
  propertyIsArray: boolean;
  formData: PropertyFormData;
  diagnostics: PropertyLintDiagnostic[];
}

/**
 * Pick the single most useful next action for the user. Highest priority is
 * always to surface real errors; after that we suggest soft improvements.
 */
export function suggestNextAction(input: SuggestInput): PropertySuggestion | null {
  const { propertyName, propertyType, propertyIsArray, formData, diagnostics } = input;

  const firstError = diagnostics.find((d) => d.level === 'error');
  if (firstError) {
    return {
      section: firstError.section,
      title: 'Resolve a blocking error',
      description: firstError.message,
      cta: 'Open section',
    };
  }

  if (!propertyName.trim()) {
    return {
      section: 'identity',
      title: 'Give it a name',
      description: 'Property name is required before saving.',
      cta: 'Open Identity',
    };
  }

  if (!formData.description?.trim()) {
    return {
      section: 'identity',
      title: 'Add a description',
      description: 'Descriptions are surfaced in generated docs and IDE hints.',
      cta: 'Open Identity',
    };
  }

  if (
    propertyType === 'string' &&
    !formData.format?.trim() &&
    !formData.pattern?.trim() &&
    !formData.appliedPrimitive?.trim()
  ) {
    return {
      section: 'type-format',
      title: 'Tighten this string',
      description: 'Consider applying a primitive or setting a format/pattern to constrain valid values.',
      cta: 'Open Type & Format',
    };
  }

  if ((propertyType === 'number' || propertyType === 'integer') && !formData.minimum && !formData.maximum) {
    return {
      section: 'constraints',
      title: 'Bound the range',
      description: 'Numbers without min/max often lead to surprising payloads downstream.',
      cta: 'Open Constraints',
    };
  }

  if (propertyIsArray && !formData.minItems && !formData.maxItems) {
    return {
      section: 'constraints',
      title: 'Cap array size',
      description: 'minItems / maxItems prevent unbounded payloads from clients.',
      cta: 'Open Constraints',
    };
  }

  if (!formData.examples || formData.examples.length === 0) {
    return {
      section: 'constraints',
      title: 'Add an example',
      description: 'Examples drive better mock data and documentation snippets.',
      cta: 'Open Constraints',
    };
  }

  if (!formData.owner?.trim()) {
    return {
      section: 'ownership',
      title: 'Assign an owner',
      description: 'Knowing who owns a property speeds up reviews and migrations.',
      cta: 'Open Ownership',
    };
  }

  return null;
}
