#!/bin/sh
set -e

cd /app

mkdir -p /app/.wrangler

# Write .dev.vars from container environment (wrangler dev does not read all env vars directly).
{
  [ -n "${ACCESS_TEAM_DOMAIN:-}" ] && printf 'ACCESS_TEAM_DOMAIN=%s\n' "$ACCESS_TEAM_DOMAIN"
  [ -n "${ACCESS_AUD:-}" ] && printf 'ACCESS_AUD=%s\n' "$ACCESS_AUD"
} > /app/.dev.vars

echo "Applying D1 migrations (local)..."
wrangler d1 migrations apply ternssh --local --config wrangler.jsonc

echo "Starting ternssh on 0.0.0.0:${PORT:-8787}..."
exec wrangler dev \
  --config wrangler.jsonc \
  --ip 0.0.0.0 \
  --port "${PORT:-8787}" \
  --local
