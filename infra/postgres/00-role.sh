#!/bin/sh
# Do not change shell options when PostgreSQL sources this initialization hook.
psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v password="${POSTGRES_APP_PASSWORD:?run bootstrap}" <<'SQL'
CREATE ROLE flora_app LOGIN PASSWORD :'password';
GRANT CONNECT ON DATABASE flora TO flora_app;
SQL
