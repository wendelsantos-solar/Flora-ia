#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .local/phase-02
curl -fsS --max-time 5 http://localhost:13400/api/health/ready >/dev/null
channels=$(docker compose exec -T asterisk asterisk -rx 'core show channels count')
case "$channels" in
  *'0 active channels'*) ;;
  *) echo 'Há canais ativos. Aguarde o fim das chamadas.' >&2; exit 1 ;;
esac
# Use only on the development stack, without human operators on 201–203.
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"
export GOPATH="$PWD/.local/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PWD/.local/cache/go-build"
(cd backend && go test -race ./... && go vet ./...)
scripts/test-integration.sh
node --experimental-strip-types --test tests/unit/audio-health.test.mjs
npm --prefix web run typecheck
web/node_modules/.bin/playwright test --config web/playwright.operations.config.ts
EVIDENCE_DIR="$PWD/docs/evidence/phase-02/regression" npm --prefix web run test:e2e
PHASE_01_1_EVIDENCE_DIR="$PWD/docs/evidence/phase-02/phase-01-1-regression" web/node_modules/.bin/playwright test --config web/playwright.homologacao.config.ts
