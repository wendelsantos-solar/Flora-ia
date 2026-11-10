#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .local/test
# Disposable database service on the project network; no host port and no real data.
name="flora-phase1-integration-$$"
cleanup() { status=$?; if [ "$status" -ne 0 ]; then docker logs "$name" > ".local/test/init-$name.log" 2>&1 || true; fi; docker rm -f "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT INT TERM
docker run -d --name "$name" --network flora-phase1_private -e POSTGRES_PASSWORD=disposable-admin -e POSTGRES_APP_PASSWORD=disposable -e POSTGRES_DB=flora -v "$PWD/backend/db/migrations/001_initial.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro" -v "$PWD/backend/db/migrations/002_operations.sql:/docker-entrypoint-initdb.d/02-operations.sql:ro" -v "$PWD/backend/db/migrations/003_transfer.sql:/docker-entrypoint-initdb.d/03-transfer.sql:ro" -v "$PWD/backend/db/migrations/004_queue_journal.sql:/docker-entrypoint-initdb.d/04-queue-journal.sql:ro" -v "$PWD/backend/db/migrations/005_schedules.sql:/docker-entrypoint-initdb.d/05-schedules.sql:ro" -v "$PWD/backend/db/migrations/006_tenant_lab.sql:/docker-entrypoint-initdb.d/06-tenant-lab.sql:ro" -v "$PWD/backend/db/migrations/007_sessions.sql:/docker-entrypoint-initdb.d/07-sessions.sql:ro" -v "$PWD/backend/db/migrations/008_sip_lab.sql:/docker-entrypoint-initdb.d/08-sip-lab.sql:ro" -v "$PWD/infra/postgres/00-role.sh:/docker-entrypoint-initdb.d/00-role.sh:ro" postgres:17-alpine >/dev/null
for attempt in $(seq 1 40); do if docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec "$name" pg_isready -h 127.0.0.1 -U postgres >/dev/null
docker run --rm --network flora-phase1_private -v "$PWD/.local/cache/integration-mod:/go/pkg/mod" -v "$PWD/backend:/src" -v "$PWD/.local/cache/integration-go:/root/.cache/go-build" -w /src -e DATABASE_URL_TEST="postgres://flora_app:disposable@$name:5432/flora?sslmode=disable" golang:1.26.10-alpine go test -v ./integration
