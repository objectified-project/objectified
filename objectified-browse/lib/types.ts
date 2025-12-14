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

