#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
export GOPATH="$PWD/.local/go"
export GOMODCACHE="$GOPATH/pkg/mod"
export GOCACHE="$PWD/.local/cache/go-build"
(cd backend && go test -race ./... && go vet ./...)
npm --prefix web run typecheck
npm --prefix web run build
scripts/test-integration.sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.local/browsers" npm --prefix web run test:e2e
