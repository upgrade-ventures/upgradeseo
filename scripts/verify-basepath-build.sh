#!/usr/bin/env bash
# Build with a basepath and prove the emitted asset URLs and the emitted files
# agree. Both halves of this broke separately in production:
#   - URLs prefixed, files at the root  -> every asset 404s into the SPA shell,
#     which renders as a BLANK page with no console error
#   - prefix applied twice              -> /UpgradeSEO/UpgradeSEO/assets/...
# Unit tests cannot see this class of bug: it lives in the interaction between
# TanStack Start's manifest, Vite's base, and the relocate plugin in
# vite.config.ts. Only a real build tells the truth.
set -euo pipefail
cd "$(dirname "$0")/.."

PREFIX="${1:-UpgradeSEO}"

echo "building with VITE_BASE_PATH=${PREFIX}…"
rm -rf dist
VITE_BASE_PATH="$PREFIX" npx vite build >/dev/null 2>&1

fail() { echo "FAIL: $1" >&2; exit 1; }

# 1. Files must live under the prefix, where Workers Assets will look them up.
[ -d "dist/client/${PREFIX}/assets" ] || fail "no dist/client/${PREFIX}/assets — relocate plugin did not run"
COUNT=$(ls "dist/client/${PREFIX}/assets" | wc -l | tr -d ' ')
[ "$COUNT" -gt 10 ] || fail "only ${COUNT} files under the prefix — build looks wrong"

# 2. The server output must emit prefixed URLs. They live in the Start manifest
#    CHUNK, not index.js — grep the whole tree or a code-split change reads as
#    a basepath failure (the first run of this script made exactly that error).
REF=$(grep -rohE "/${PREFIX}/assets/[A-Za-z0-9_.-]+\.js" dist/server/ | head -1 || true)
[ -n "$REF" ] || fail "server output emits no /${PREFIX}/assets/ URLs — Start ignored the basepath"

# 3. …and every emitted URL must resolve to a real file.
[ -f "dist/client${REF}" ] || fail "URL ${REF} has no file at dist/client${REF} — URL/file disagreement"

# 4. The prefix must never double in an emitted URL. Matched with a leading
#    quote: the SSR bundle keeps comments, and a comment in auth.ts WARNS about
#    this exact string — an unanchored grep reads the warning as the disease.
if grep -rqE "[\"'\x60]/${PREFIX}/${PREFIX}/" dist/server/ dist/client/; then
  fail "doubled prefix /${PREFIX}/${PREFIX}/ found in an emitted URL"
fi

echo "OK: ${COUNT} assets under /${PREFIX}/, sample URL ${REF} resolves, no doubling"
