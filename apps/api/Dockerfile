# Build stage — context must be repo root (monorepo)
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm ci

COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY prisma/ ./prisma/

RUN npx prisma generate
RUN npm run build --workspace=api

# Runtime stage
FROM node:20-alpine
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/prisma ./prisma
COPY apps/api/start.sh ./start.sh
RUN chmod +x start.sh

RUN npx prisma generate

EXPOSE 4000
CMD ["sh", "start.sh"]
