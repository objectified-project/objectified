import psycopg2
from psycopg2.extras import RealDictCursor
from typing import Optional, List, Dict, Any
from .config import settings


class Database:
    """Database connection and query manager."""

    def __init__(self):
        self.connection = None

    def connect(self):
        """Establish database connection."""
        if not self.connection or self.connection.closed:
            self.connection = psycopg2.connect(
                settings.database_url,
                cursor_factory=RealDictCursor
            )
        return self.connection

    def close(self):
        """Close database connection."""
        if self.connection and not self.connection.closed:
            self.connection.close()

    def execute_query(self, query: str, params: tuple = None) -> List[Dict[str, Any]]:
        """Execute a SELECT query and return results."""
        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute(query, params)
                return cursor.fetchall()
        except Exception as e:
            conn.rollback()
            raise e

    def get_version_by_slugs(self, tenant_slug: str, project_slug: str, version_id: str) -> Optional[Dict[str, Any]]:
        """Get version information by tenant, project, and version slugs."""
        query = """
            SELECT v.id, v.version_id, v.visibility, v.published
            FROM odb.versions v
            JOIN odb.projects p ON v.project_id = p.id
            JOIN odb.tenants t ON p.tenant_id = t.id
            WHERE t.slug = %s
              AND p.slug = %s
              AND v.version_id = %s
              AND v.deleted_at IS NULL
              AND p.deleted_at IS NULL
              AND t.deleted_at IS NULL
        """
        results = self.execute_query(query, (tenant_slug, project_slug, version_id))
        return results[0] if results else None

    def get_classes_for_version(self, version_id: str) -> List[Dict[str, Any]]:
        """Get all classes for a specific version."""
        query = """
            SELECT id, version_id, name, description, schema, enabled
            FROM odb.classes
            WHERE version_id = %s AND deleted_at IS NULL
            ORDER BY name ASC
        """
        return self.execute_query(query, (version_id,))

    def get_class_by_name(self, version_id: str, class_name: str) -> Optional[Dict[str, Any]]:
        """Get a specific class by name for a version."""
        query = """
            SELECT id, version_id, name, description, schema, enabled
            FROM odb.classes
            WHERE version_id = %s AND name = %s AND deleted_at IS NULL
        """
        results = self.execute_query(query, (version_id, class_name))
        return results[0] if results else None

    def get_properties_for_class(self, class_id: str) -> List[Dict[str, Any]]:
        """Get all properties for a specific class."""
        query = """
            SELECT cp.id, cp.class_id, cp.property_id, cp.name, cp.description, cp.data,
                   p.id as property_source_id, p.name as property_source_name
            FROM odb.class_properties cp
            LEFT JOIN odb.properties p ON cp.property_id = p.id
            WHERE cp.class_id = %s
            ORDER BY cp.name ASC
        """
        return self.execute_query(query, (class_id,))


# Global database instance
db = Database()

