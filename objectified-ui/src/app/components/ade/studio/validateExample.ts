import { PropertyFormData } from './PropertyFormFields';

export type ExampleValidity =
  | { ok: true; value: unknown; matchedConstraints: string[] }
  | { ok: false; reason: string };

const FORMAT_CHECKERS: Record<string, (s: string) => boolean> = {
  email: (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),
  uri: (s) => {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  },
  url: (s) => {
    try {
      new URL(s);
      return true;
    } catch {
      return false;
    }
  },
  uuid: (s) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),
  hostname: (s) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i.test(s),
  ipv4: (s) => /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)$/.test(s),
  ipv6: (s) => /^[0-9a-f:]+$/i.test(s) && s.includes(':'),
  date: (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)),
  'date-time': (s) =>
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/.test(s) &&
    !Number.isNaN(Date.parse(s)),
  time: (s) => /^\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/.test(s),
  duration: (s) => /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/.test(s),
  byte: (s) => /^[A-Za-z0-9+/]*={0,2}$/.test(s) && s.length % 4 === 0,
};

const checkType = (value: unknown, type: string): boolean => {
  switch (type) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'object':
      return typeof value === 'object' && value !== null && !Array.isArray(value);
    case 'array':
      return Array.isArray(value);
    default:
      return true;
  }
};

const toNumber = (s: string | undefined): number | undefined => {
  if (!s || !s.trim()) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Validate a single example payload (raw JSON string) against the current
 * property's type, format, pattern, enum/const and range constraints.
 * Returns `{ ok: true }` with a human-readable list of constraints exercised,
 * or `{ ok: false, reason }` describing the first mismatch.
 */
export function validateExample(
  raw: string,
  formData: PropertyFormData,
  propertyType: string,
  propertyIsArray: boolean,
): ExampleValidity {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, reason: 'Empty example.' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'Not valid JSON.' };
  }

  const matched: string[] = [];

  if (propertyIsArray) {
    if (!Array.isArray(parsed)) return { ok: false, reason: 'Expected an array.' };
    matched.push('type=array');

    const minItems = toNumber(formData.minItems);
    const maxItems = toNumber(formData.maxItems);
    if (minItems !== undefined && parsed.length < minItems) {
      return { ok: false, reason: `Array length ${parsed.length} < minItems ${minItems}.` };
    }
    if (maxItems !== undefined && parsed.length > maxItems) {
      return { ok: false, reason: `Array length ${parsed.length} > maxItems ${maxItems}.` };
    }
    if (formData.uniqueItems) {
      const seen = new Set<string>();
      for (const item of parsed) {
        const key = JSON.stringify(item);
        if (seen.has(key)) return { ok: false, reason: 'Array contains duplicate items.' };
        seen.add(key);
      }
      matched.push('uniqueItems');
    }

    for (let i = 0; i < parsed.length; i += 1) {
      const item = parsed[i];
      if (!checkType(item, propertyType)) {
        return { ok: false, reason: `Item ${i} is not a ${propertyType}.` };
      }
    }
    matched.push(`items: ${propertyType}`);
    return { ok: true, value: parsed, matchedConstraints: matched };
  }

  if (formData.nullable && parsed === null) {
    return { ok: true, value: parsed, matchedConstraints: ['nullable'] };
  }

  if (!checkType(parsed, propertyType)) {
    return { ok: false, reason: `Expected ${propertyType}, got ${typeof parsed}.` };
  }
  matched.push(`type=${propertyType}`);

  if (formData.const?.trim()) {
    let constVal: unknown;
    try {
      constVal = JSON.parse(formData.const);
    } catch {
      constVal = formData.const;
    }
    if (JSON.stringify(parsed) !== JSON.stringify(constVal)) {
      return { ok: false, reason: 'Does not equal const value.' };
    }
    matched.push('const');
  }

  if (formData.enum && formData.enum.length > 0) {
    const enumValues = formData.enum.map((v) => {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    });
    const ok = enumValues.some((v) => JSON.stringify(v) === JSON.stringify(parsed));
    if (!ok) return { ok: false, reason: 'Not in enum.' };
    matched.push('enum');
  }

  if (propertyType === 'string' && typeof parsed === 'string') {
    const minLen = toNumber(formData.minLength);
    const maxLen = toNumber(formData.maxLength);
    if (minLen !== undefined && parsed.length < minLen) {
      return { ok: false, reason: `Length ${parsed.length} < minLength ${minLen}.` };
    }
    if (maxLen !== undefined && parsed.length > maxLen) {
      return { ok: false, reason: `Length ${parsed.length} > maxLength ${maxLen}.` };
    }

    if (formData.pattern?.trim()) {
      try {
        const re = new RegExp(formData.pattern);
        if (!re.test(parsed)) return { ok: false, reason: 'Does not match pattern.' };
        matched.push('pattern');
      } catch {
        // ignore — invalid regex is reported by the lint engine separately
      }
    }

    if (formData.format?.trim() && FORMAT_CHECKERS[formData.format]) {
      const ok = FORMAT_CHECKERS[formData.format](parsed);
      if (!ok) return { ok: false, reason: `Does not match format ${formData.format}.` };
      matched.push(`format=${formData.format}`);
    }
  }

  if (propertyType === 'number' || propertyType === 'integer') {
    if (typeof parsed === 'number') {
      const min = toNumber(formData.minimum);
      const max = toNumber(formData.maximum);
      if (min !== undefined && parsed < min) {
        return { ok: false, reason: `Value ${parsed} < minimum ${min}.` };
      }
      if (max !== undefined && parsed > max) {
        return { ok: false, reason: `Value ${parsed} > maximum ${max}.` };
      }
      if (formData.multipleOf) {
        const mo = Number(formData.multipleOf);
        if (Number.isFinite(mo) && mo > 0 && Math.abs(parsed / mo - Math.round(parsed / mo)) > 1e-9) {
          return { ok: false, reason: `Not a multiple of ${mo}.` };
        }
        if (Number.isFinite(mo) && mo > 0) matched.push('multipleOf');
      }
    }
  }

  return { ok: true, value: parsed, matchedConstraints: matched };
}
