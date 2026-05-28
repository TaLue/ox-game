# Build stage — context must be repo root (monorepo)
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci

COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/

ARG API_ORIGIN=http://localhost:4000
ENV API_ORIGIN=$API_ORIGIN
ENV NEXT_OUTPUT=standalone

RUN npm run build --workspace=web

# Runtime stage — Next.js standalone output
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Standalone bundle from Next.js (includes only used node_modules)
COPY --from=builder /app/apps/web/.next/standalone ./
# Static assets must be placed alongside the standalone server
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
