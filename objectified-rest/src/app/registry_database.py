"""Dedicated connection to the separate type-registry database (objectified-types-db).

The registry lives in its own database, isolated from the core ADE schema, so the REST
service connects to it independently of the primary :class:`~app.database.Database`. This
module provides a minimal connection manager used by the health check and (later tickets)
the registry service layer; it deliberately does not import or share state with the core
``db`` singleton so a failure in one database cannot mask the health of the other.

See docs/ROADMAP_TYPE_REGISTRY_GOVERNANCE.md §1.1 (#3446).
"""

import logging

import psycopg2
from psycopg2.extras import RealDictCursor

from .config import settings

_logger = logging.getLogger(__name__)


class RegistryDatabase:
    """Lazy, single-connection manager for the type-registry database.

    Mirrors the connection style of :class:`~app.database.Database` (a shared psycopg2
    connection, reconnected on demand) but targets ``settings.effective_types_database_url``.
    Credentials are never logged: connection errors surface the driver message only, which
    does not include the password.
    """

    def __init__(self) -> None:
        self.connection = None

    def connect(self):
        """Establish (or reuse) the registry database connection.

        Returns the live psycopg2 connection. Raises ``psycopg2.OperationalError`` (with a
        provisioning hint when the database is absent) on failure — callers decide whether
        that is fatal.
        """
        if not self.connection or self.connection.closed:
            try:
                self.connection = psycopg2.connect(
                    settings.effective_types_database_url,
                    cursor_factory=RealDictCursor,
                )
            except psycopg2.OperationalError as e:
                err_s = str(e).lower()
                if "does not exist" in err_s and "database" in err_s:
                    raise psycopg2.OperationalError(
                        f"{e}\n\n"
                        "The type-registry database does not exist yet. Provision it with:\n"
                        "  objectified-db registry migrate\n"
                        "(or `docker compose up types-migrate`). Override the name with "
                        "OBJECTIFIED_TYPES_DB / OBJECTIFIED_TYPES_DB_URL."
                    ) from e
                raise
        return self.connection

    def close(self) -> None:
        """Close the registry database connection if open."""
        if self.connection and not self.connection.closed:
            self.connection.close()

    def ping(self) -> bool:
        """Return ``True`` if a trivial query succeeds against the registry database.

        Reconnects if needed and commits so the shared connection returns to IDLE.
        Raises the underlying error on connection/query failure (the caller maps it to a
        health status).
        """
        conn = self.connect()
        try:
            with conn.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            conn.commit()
            return True
        except Exception:
            try:
                conn.rollback()
            except Exception:
                pass
            raise


# Global registry database instance (independent of the core ``db`` singleton).
registry_db = RegistryDatabase()
