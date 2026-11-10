#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
curl -fsS --max-time 5 http://localhost:13400/api/health/ready >/dev/null
for pbx in asterisk asterisk-b; do
  case "$(docker compose exec -T "$pbx" asterisk -rx 'core show channels count')" in
    *'0 active channels'*) ;;
    *) echo "Aguarde o fim das chamadas em $pbx." >&2; exit 1 ;;
  esac
done
# Use exclusively without human operators on 201–203 and 211–213.
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers"
export GOPATH="$PWD/.local/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PWD/.local/cache/go-build"
export PHASE_02_EVIDENCE_DIR="$PWD/docs/evidence/phase-02-5/regression-02"
export EVIDENCE_DIR="$PWD/docs/evidence/phase-02-5/regression-01"
export PHASE_01_1_EVIDENCE_DIR="$PWD/docs/evidence/phase-02-5/regression-01-1"
export BROWSER_EVIDENCE_DIR="$PWD/docs/evidence/phase-02-5"
python3 -B tests/unit/test_ami_gate.py
python3 scripts/probe-ami-gate.py
(cd backend && go test -race ./... && go vet ./...)
scripts/test-integration.sh
npm --prefix web run typecheck
web/node_modules/.bin/playwright test --config web/playwright.hardening.config.ts
web/node_modules/.bin/playwright test --config web/playwright.operations.config.ts
npm --prefix web run test:e2e
web/node_modules/.bin/playwright test --config web/playwright.homologacao.config.ts
# The diagnostic Firefox run is intentionally separate; a failure remains a recorded restriction.
