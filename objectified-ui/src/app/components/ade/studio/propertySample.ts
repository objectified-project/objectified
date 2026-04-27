import { PropertyFormData } from './PropertyFormFields';

const FORMAT_SAMPLES: Record<string, string> = {
  email: 'jane.doe@example.com',
  uri: 'https://example.com/resource',
  url: 'https://example.com/resource',
  uuid: '550e8400-e29b-41d4-a716-446655440000',
  hostname: 'api.example.com',
  ipv4: '192.0.2.42',
  ipv6: '2001:db8::1',
  'date-time': '2026-01-22T10:00:00Z',
  date: '2026-01-22',
  time: '10:00:00Z',
  duration: 'P1DT2H30M',
  byte: 'aGVsbG8gd29ybGQ=',
  binary: 'aGVsbG8gd29ybGQ=',
  password: 's3cret-passw0rd!',
  'json-pointer': '/foo/bar',
  'relative-json-pointer': '0/foo',
  regex: '^[a-z]+$',
};

const tryParseJson = (s: string | undefined): unknown => {
  if (s === undefined || s === null) return undefined;
  const trimmed = String(s).trim();
  if (trimmed === '') return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return s;
  }
};

const sampleString = (data: PropertyFormData): string => {
  if (data.format && FORMAT_SAMPLES[data.format]) return FORMAT_SAMPLES[data.format];

  const min = data.minLength ? Number(data.minLength) : 0;
  const max = data.maxLength ? Number(data.maxLength) : 0;
  const target = max > 0 ? Math.min(Math.max(min || 8, 8), max) : Math.max(min || 8, 8);

  const seed = 'sample value text padding here ';
  let out = seed.slice(0, target);
  while (out.length < target) out += seed;
  return out.slice(0, target);
};

const sampleNumber = (data: PropertyFormData, integer: boolean): number => {
  const min = data.minimum ? Number(data.minimum) : undefined;
  const max = data.maximum ? Number(data.maximum) : undefined;

  let candidate: number;
  if (min !== undefined && max !== undefined) candidate = (min + max) / 2;
  else if (min !== undefined) candidate = min + 1;
  else if (max !== undefined) candidate = max - 1;
  else candidate = integer ? 42 : 3.14;

  if (data.multipleOf) {
    const mo = Number(data.multipleOf);
    if (Number.isFinite(mo) && mo > 0) {
      candidate = Math.round(candidate / mo) * mo;
    }
  }

  return integer ? Math.round(candidate) : candidate;
};

const sampleForType = (
  baseType: string,
  data: PropertyFormData,
  isArrayItem = false,
): unknown => {
  if (data.const?.trim()) return tryParseJson(data.const);
  if (data.enum && data.enum.length > 0) return data.enum[0];

  if (!isArrayItem && data.default?.trim()) {
    const parsed = tryParseJson(data.default);
    if (parsed !== undefined) return parsed;
  }

  switch (baseType) {
    case 'string':
      return sampleString(data);
    case 'number':
      return sampleNumber(data, false);
    case 'integer':
      return sampleNumber(data, true);
    case 'boolean':
      return true;
    case 'null':
      return null;
    case 'object':
      return {};
    default:
      return null;
  }
};

/**
 * Produce an example payload for the property based on the current form state.
 * Uses const, enum, default, format, length/range constraints, and falls back
 * to type-appropriate placeholders.
 */
export function generateSampleValue(
  formData: PropertyFormData,
  propertyType: string,
  propertyIsArray: boolean,
): unknown {
  if (propertyIsArray) {
    const itemSample = sampleForType(propertyType, formData, true);
    const min = formData.minItems ? Number(formData.minItems) : 0;
    const max = formData.maxItems ? Number(formData.maxItems) : 0;
    const length = max > 0 ? Math.min(Math.max(min || 1, 1), max) : Math.max(min || 1, 1);
    return Array.from({ length: Math.min(length, 3) }, () => itemSample);
  }

  return sampleForType(propertyType, formData);
}
