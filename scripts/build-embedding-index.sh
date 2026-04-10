#!/usr/bin/env bash
# Pre-builds the scripture semantic embedding index for all translations.
# Output: apps/desktop/resources/scripture_index_<TRANSLATION>.{bin,sha256}
#
# Each translation's index is built separately and keyed by its own hash, so
# unchanged translations are skipped on subsequent runs.
#
# Usage:
#   ./scripts/build-embedding-index.sh              # build all (KJV, WEB, BSB)
#   ./scripts/build-embedding-index.sh --force      # force rebuild all
#   # Or single translation:
#   cargo run -p ow-embed-builder -- --translation KJV
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPO_ROOT"

echo "[build-embedding-index] Building KJV…"
cargo run -p ow-embed-builder --release -- --translation KJV "$@"

echo "[build-embedding-index] Building WEB…"
cargo run -p ow-embed-builder --release -- --translation WEB "$@"

echo "[build-embedding-index] Building BSB…"
cargo run -p ow-embed-builder --release -- --translation BSB "$@"

echo "[build-embedding-index] All translations done."
