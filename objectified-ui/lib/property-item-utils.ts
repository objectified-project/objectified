import type { PropertyItem } from '@/app/components/ade/studio/StudioSideNav';

/**
 * Converts a PropertyItem into the reduced shape expected by the Ollama API's
 * `existing_properties` payload field (id and name stripped, description normalised).
 */
export function propertyItemToExistingApiShape(p: PropertyItem): {
  name: string;
  description: string | null;
  data: Record<string, unknown>;
} {
  const rec = p as unknown as Record<string, unknown>;
  const name = rec.name;
  const description = rec.description;
  const data = { ...rec };
  delete data.id;
  delete data.name;
  delete data.description;
  return {
    name: typeof name === 'string' ? name : String(name ?? ''),
    description: description != null && String(description).trim() ? String(description) : null,
    data,
  };
}
