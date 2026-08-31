#!/usr/bin/env bash
# Runs the automated RLS policy checks (avatar folders + email invitations).
#
# Usage:
#   SUPABASE_URL=... SUPABASE_ANON_KEY=... ACCESS_TOKEN=<admin user jwt> ./scripts/run-rls-checks.sh
#
# Exits non-zero if any scenario fails, so it can be wired into CI.
set -euo pipefail

: "${SUPABASE_URL:?set SUPABASE_URL}"
: "${SUPABASE_ANON_KEY:?set SUPABASE_ANON_KEY}"
: "${ACCESS_TOKEN:?set ACCESS_TOKEN (admin user JWT or service role key)}"

response=$(mktemp)
status=$(curl -s -X POST "$SUPABASE_URL/functions/v1/rls-selftest" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -o "$response" -w '%{http_code}')

cat "$response"
echo
[ "$status" = "200" ] || { echo "RLS checks failed (HTTP $status)"; exit 1; }
echo "All RLS checks passed."
