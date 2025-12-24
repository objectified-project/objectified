import { Importer, ImportSourceKind, NormalizeOptions, NormalizeResult } from './index';

export const arazzoImporter: Importer = {
  kind: 'arazzo' as ImportSourceKind,
  normalize({ document, options }: { document: any; options: NormalizeOptions }): NormalizeResult {
    return {
      classes: [],
      warnings: ['Arazzo import not yet implemented']
    };
  }
};

