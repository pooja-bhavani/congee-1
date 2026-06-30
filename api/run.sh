#!/usr/bin/env bash
# Launch the Reverie-on-Cognee API. Cognee runs from source via PYTHONPATH using
# its own venv (which has cognee's heavy deps + fastembed + boto3 installed).
# Run exactly ONE instance — kuzu is a single-writer store.
set -euo pipefail

COGNEE_SRC="${COGNEE_SRC:-/Users/sagarbhavani/Desktop/cognee}"
PYBIN="$COGNEE_SRC/.venv/bin/python"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cd "$HERE"   # cwd = congee-1/api so app's own .env is used, not cognee's clone .env
PYTHONPATH="$COGNEE_SRC" "$PYBIN" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 "$@"
