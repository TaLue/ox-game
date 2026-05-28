# OX Game — Tic-Tac-Toe

Single-player Tic-Tac-Toe (human vs bot) with OAuth2 login, win-streak scoring, real-time leaderboard, and an admin view.

## Stack

| Layer | Technology |
|-------|-----------|
| API | NestJS + TypeScript (modular monolith) |
| Frontend | Next.js 14 (App Router) + Zustand |
| Database | PostgreSQL 15 via Prisma |
| Cache / realtime store | Redis 7 |
| Real-time push | Socket.IO |
| Auth | OAuth2 Authorization Code + PKCE (Auth0 / Google) |
| API docs | Swagger at `/docs` |

## Quick start with Docker Compose

```bash
# 1. Copy env template and fill in OAuth credentials (see "Environment variables" below)
cp .env.example .env

# 2. Build and start all services (api, web, postgres, redis)
docker compose up --build

# 3. Open the app
open http://localhost:3000        # game UI
open http://localhost:4000/docs   # Swagger / OpenAPI
```

On first boot the API runs `prisma migrate deploy` automatically before accepting traffic.

## Local development (without Docker for app services)

Requires: Node.js ≥ 20, a running PostgreSQL 15 instance, a running Redis 7 instance.

```bash
# Start only the infrastructure
docker compose up postgres redis -d

# Install dependencies
npm install

# Apply DB migrations
npx prisma migrate dev

# Run API in watch mode
npm run dev:api          # http://localhost:4000

# Run web in watch mode (separate terminal)
npm run dev:web          # http://localhost:3000
```

## Running tests

```bash
# All workspaces
npm test

# API only (unit + integration — requires Docker postgres + redis)
npm test --workspace=api

# API unit tests only (no Docker needed)
cd apps/api && npx jest --testPathPattern="(logic|bot|guard|pkce|gateway|service|filter)"

# Lint
npm run lint
```

## Environment variables

Copy `.env.example` to `.env` and fill in the required values.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SESSION_SECRET` | Yes | Random string for session signing (min 32 chars) |
| `OAUTH_PROVIDER` | Yes | `auth0` or `google` |
| `OAUTH_ISSUER_URL` | Yes | IdP issuer URL (e.g. `https://tenant.auth0.com`) |
| `OAUTH_CLIENT_ID` | Yes | OAuth2 client ID |
| `OAUTH_CLIENT_SECRET` | Yes | OAuth2 client secret |
| `OAUTH_REDIRECT_URI` | Yes | Callback URL — must match IdP config |
| `ADMIN_EMAILS` | No | Comma-separated emails granted ADMIN role at login |
| `PORT` | No | API port (default `4000`) |
| `NODE_ENV` | No | `development` \| `production` \| `test` |
| `SESSION_TTL_SECONDS` | No | Session idle timeout (default `3600`) |
| `NEXT_PUBLIC_WS_URL` | No | WebSocket URL as seen by the browser (default `http://localhost:4000`) |
| `API_ORIGIN` | No | API base URL for Next.js rewrites (default `http://localhost:4000`) |

### Auth0 setup

1. Create a **Regular Web Application** in your Auth0 tenant.
2. Set **Allowed Callback URLs** to `http://localhost:4000/api/auth/callback`.
3. Set **Allowed Logout URLs** to `http://localhost:3000/login`.
4. Copy the **Domain**, **Client ID**, and **Client Secret** into `.env`.

## Architecture & fixed decisions

| # | Decision | Value |
|---|----------|-------|
| D1 | Architecture | Modular Monolith — one NestJS app with `auth`, `game`, `score`, `admin` modules |
| D2 | Backend | NestJS + TypeScript |
| D3 | Frontend | Next.js (App Router) + React + Zustand |
| D4 | ORM / DB | Prisma + PostgreSQL |
| D5 | Cache / realtime | Redis |
| D6 | Realtime push | Socket.IO (`/ws` namespace, Redis adapter) |
| D7 | API docs | Swagger at `/docs` |
| D8 | Auth provider | Auth0 or Google (configurable via `OAUTH_PROVIDER`) |
| D9 | Draw effect on streak | A draw **resets** `currentStreak` to 0 |
| D10 | Negative total score | Allowed — total score may go below 0 |
| D11 | Bot difficulty | `EASY` (heuristic, beatable) or `HARD` (minimax, unbeatable). Default `EASY` |
| D12 | Score source of truth | PostgreSQL is durable source; Redis holds hot values + leaderboard (rebuildable) |
| D13 | Who is admin | User is admin if their email is in `ADMIN_EMAILS` env list; role assigned at login |

## Scoring rules

| Event | Points | Streak |
|-------|--------|--------|
| Win | +1 | +1 |
| 3rd consecutive win (bonus) | +2 total, +0 streak (resets to 0) |
| Loss | −1 | reset to 0 |
| Draw | 0 | reset to 0 |

Total score may go negative. The 3-in-a-row bonus fires on the 3rd win and resets streak; the 4th consecutive win starts a new streak at 1.

## API overview

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/health` | Public | Liveness check |
| GET | `/api/auth/login` | Public | Redirect to IdP |
| GET | `/api/auth/callback` | Public | OAuth2 callback |
| POST | `/api/auth/logout` | Session | Clear session |
| GET | `/api/me` | Session | Current user |
| POST | `/api/games` | Session | Create game |
| GET | `/api/games/:id` | Session | Get game state |
| POST | `/api/games/:id/move` | Session | Make a move (rate-limited: 30 req/10 s) |
| GET | `/api/scores/me` | Session | My score |
| GET | `/api/leaderboard` | Session | Top N scores |
| GET | `/api/admin/scores` | Admin | All players (paginated) |
| GET | `/api/admin/players/:id` | Admin | Player detail |

Full OpenAPI spec is available at `http://localhost:4000/docs` when the API is running.

## Repo layout

```
ox-game/
├── apps/
│   ├── api/          # NestJS: auth, game, score, admin, ws, common
│   └── web/          # Next.js: /login /play /leaderboard
├── packages/
│   └── shared/       # Shared TypeScript types & DTOs
├── prisma/
│   └── schema.prisma
├── docker-compose.yml
├── .env.example
└── README.md
```
