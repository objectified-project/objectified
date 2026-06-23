#!/usr/bin/env sh
#
# Apply pending Flyway migrations using the objectified-db CLI.
# Connection is resolved from OBJECTIFIED_DB_URL / DATABASE_URL / POSTGRES_* (see README).

exec node dist/cli.js migrate "$@"
