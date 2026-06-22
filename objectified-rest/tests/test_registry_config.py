"""Type-registry database connection settings (#3446).

Deterministic, DB-free checks that ``Settings`` exposes an independent registry
database URL: by default it reuses the core host/port/user/password and only swaps
the database name, and an explicit ``OBJECTIFIED_TYPES_DB_URL`` overrides it.
"""

from app.config import Settings


def test_registry_db_defaults_to_objectified_types_db() -> None:
    """The registry database name defaults to ``objectified-types-db``."""
    s = Settings(_env_file=None)
    assert s.types_postgres_db == "objectified-types-db"


def test_effective_types_url_reuses_core_connection_with_swapped_database() -> None:
    """Without a dedicated URL, only the database name differs from the core URL."""
    s = Settings(
        _env_file=None,
        postgres_user="u",
        postgres_password="pw",
        postgres_host="dbhost",
        postgres_port=5432,
        postgres_db="objectified",
        types_postgres_db="objectified-types-db",
        types_database_url=None,
    )
    assert s.effective_database_url == "postgresql://u:pw@dbhost:5432/objectified"
    assert s.effective_types_database_url == "postgresql://u:pw@dbhost:5432/objectified-types-db"


def test_effective_types_url_prefers_dedicated_url() -> None:
    """An explicit registry URL points the service at a separate server entirely."""
    s = Settings(
        _env_file=None,
        postgres_host="dbhost",
        types_database_url="postgresql://r:rp@other:5433/registry",
    )
    assert s.effective_types_database_url == "postgresql://r:rp@other:5433/registry"


def test_registry_database_name_is_configurable() -> None:
    """The registry database name is overridable (no hardcoded value in the URL)."""
    s = Settings(_env_file=None, types_postgres_db="custom-registry", types_database_url=None)
    assert s.effective_types_database_url.endswith("/custom-registry")
