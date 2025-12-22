// Type definitions for database entities

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
  tenant_name?: string;
  tenant_slug?: string;
  tenant_description?: string | null;
}

export interface Version {
  id: string;
  version_id: string;
  description: string | null;
  change_log: string | null;
  published: boolean;
  visibility: 'public' | 'private';
  created_at: Date;
  updated_at: Date;
  published_at: Date | null;
  published_by: string | null;
  publisher_name?: string | null;
  publisher_email?: string | null;
  project_name?: string;
  project_slug?: string;
  project_description?: string | null;
  tenant_name?: string;
  tenant_slug?: string;
  tenant_description?: string | null;
}

export interface SearchResult {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_description: string | null;
  project_id: string;
  project_name: string;
  project_slug: string;
  project_description: string | null;
  version_count: number;
}

/**
 * Canvas metadata for class positioning and styling.
 * This is UI-only data and does not affect schema generation or exports.
 */
export interface CanvasMetadata {
  /** Position on the canvas in pixels */
  position?: {
    x: number;
    y: number;
  };
  /** Dimensions of the class node */
  dimensions?: {
    width?: number;
    height?: number;
  };
  /** Visual styling options */
  style?: {
    backgroundColor?: string;
    borderColor?: string;
    collapsed?: boolean;
    zIndex?: number;
  };
  /** Group ID if this class belongs to a visual group */
  group?: string | null;
}

/**
 * Class definition representing a schema object.
 */
export interface Class {
  id: string;
  version_id: string;
  name: string;
  description: string | null;
  /** JSON Schema definition for the class */
  schema: Record<string, unknown>;
  enabled: boolean;
  /** UI-only canvas positioning and styling - excluded from exports */
  canvas_metadata?: CanvasMetadata | null;
  created_at: Date;
  updated_at: Date;
}

