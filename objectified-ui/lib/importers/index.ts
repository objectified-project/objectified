export type ImportSourceKind = 'openapi' | 'arazzo' | 'unknown';

export interface NormalizedProperty {
  name: string;
  data: any;
  description?: string | null;
  children?: NormalizedProperty[];
}

export interface NormalizedClass {
  name: string;
  description?: string | null;
  schema?: any;
  properties: NormalizedProperty[];
}

export interface NormalizeOptions {
  selectedSchemas: string[];
}

export interface NormalizeResult {
  classes: NormalizedClass[];
  warnings: string[];
}

export interface Importer {
  kind: ImportSourceKind;
  normalize(input: { document: any; options: NormalizeOptions }): NormalizeResult;
}

const registry = new Map<ImportSourceKind, Importer>();

export function registerImporter(importer: Importer): void {
  registry.set(importer.kind, importer);
}

export function getImporter(kind: ImportSourceKind): Importer | undefined {
  return registry.get(kind);
}

import { openApiImporter } from './openapi';
import { arazzoImporter } from './arazzo';

registerImporter(openApiImporter);
registerImporter(arazzoImporter);

export { openApiImporter, arazzoImporter };

