#!/bin/sh
echo "[start.sh] Running migrations..."
node_modules/.bin/prisma migrate deploy
echo "[start.sh] PRISMA EXIT: $?"
echo "[start.sh] Starting NestJS..."
node apps/api/dist/apps/api/src/main
echo "[start.sh] NODE EXIT: $?"
