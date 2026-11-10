#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p .local/phase-01-1 docs/evidence/phase-01-1
curl --fail --max-time 5 -s http://localhost:13400/api/health/ready >/dev/null
current_channels="$(docker compose exec -T asterisk asterisk -rx 'core show channels count')"
case "$current_channels" in
  *'0 active channels'*) ;;
  *) echo 'Há canais ativos. Encerre as chamadas antes de executar a homologação automática.' >&2; exit 1 ;;
esac
# Dedicated development endpoints only. Do not run while humans use 201/202.
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"
export GOPATH="$PWD/.local/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PWD/.local/cache/go-build"
node --experimental-strip-types --test tests/unit/audio-health.test.mjs
(cd backend && go test -race ./... && go vet ./...)
scripts/test-integration.sh
npm --prefix web run typecheck
# Execute every browser suite even when one compatibility scenario fails.
result=0
web/node_modules/.bin/playwright test --config web/playwright.homologacao.config.ts || result=1
web/node_modules/.bin/playwright test --config web/playwright.compatibilidade.config.ts || result=1
EVIDENCE_DIR="$PWD/docs/evidence/phase-01-1/regression" npm --prefix web run test:e2e || result=1
exit "$result"
