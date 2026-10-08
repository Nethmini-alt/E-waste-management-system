#!/usr/bin/env bash
# Runs one k6 test (or all of them) and saves the HTML dashboard report and JSON summary
# into results/. Usage: ./run.sh smoke|load|stress|spike|all
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p results

run() {
  echo "=== $1 ==="
  K6_WEB_DASHBOARD=true K6_WEB_DASHBOARD_EXPORT="results/$1-report.html" \
    k6 run --summary-export "results/$1-summary.json" "$1.js"
}

case "${1:-}" in
  smoke|load|stress|spike) run "$1" ;;
  # Smoke must pass before load is applied; stress/spike are expected to cross thresholds, so keep going.
  all) run smoke && run load; run stress || true; run spike || true ;;
  *) echo "usage: $0 smoke|load|stress|spike|all" >&2; exit 1 ;;
esac
