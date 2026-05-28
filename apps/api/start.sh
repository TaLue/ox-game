#!/bin/sh
set -e
echo "[start.sh] Running migrations..."
node_modules/.bin/prisma migrate deploy
echo "[start.sh] Migrations done. Starting NestJS..."
exec node apps/api/dist/apps/api/src/main
