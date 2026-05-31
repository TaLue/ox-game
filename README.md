# OX (Tic-Tac-Toe) Web Application

เว็บแอปพลิเคชันเกม Tic-Tac-Toe ที่ผู้เล่นต้อง login ผ่าน OAuth 2.0 แล้วแข่งกับ Bot มีระบบเก็บคะแนนแยกตามระดับความยาก (Easy / Hard) ให้โบนัสเมื่อชนะติดต่อกัน และมี leaderboard อัปเดต realtime สำหรับติดตามคะแนนของผู้เล่นทั้งหมด

---

## สารบัญ

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [OAuth Provider Setup](#oauth-provider-setup)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Design Decisions](#design-decisions)
- [Trade-offs](#trade-offs)
- [Future Work](#future-work)

---

## Features

- **OAuth 2.0 authentication** (Authorization Code + PKCE) ผ่าน Auth0 หรือ Google
- **Player vs Bot** มีให้เลือก 2 ระดับความยาก (EASY / HARD)
- **ระบบคะแนนแยก Easy / Hard** พร้อมโบนัสชนะติดต่อกัน (+1 พิเศษเมื่อชนะครบ 3 ครั้งติดกัน)
- **Leaderboard** แยกตามระดับความยาก อัปเดต realtime ผ่าน WebSocket (ดูได้โดยไม่ต้อง login)
- **เครื่องมือสำหรับ Admin** ดูคะแนนผู้เล่นทั้งหมดพร้อม pagination
- **Security ตามแนว OWASP** (CSRF, XSS, rate limiting, server-authoritative game logic)
- **Containerized** รันได้ด้วย `docker compose up` คำสั่งเดียว

---

## Tech Stack

- **Frontend** — Next.js 14 (App Router), React 18, Zustand 4
- **Backend** — NestJS 10, TypeScript 5
- **Database** — PostgreSQL 15 + Prisma 5 ORM
- **Cache / Realtime** — Redis 7
- **WebSocket** — Socket.IO 4
- **API Docs** — Swagger (OpenAPI)
- **Auth** — OAuth 2.0 ผ่าน Auth0 / Google
- **Container** — Docker + Docker Compose
- **Testing** — Jest, Supertest

---

## Architecture

ออกแบบเป็น **Modular Monolith** คือ NestJS แอปเดียวที่แบ่งโมดูลภายในชัดเจน (`auth`, `game`, `score`, `admin`) โดยใช้ PostgreSQL และ Redis เป็น data store

```
┌──────────────┐   OAuth2 (PKCE)   ┌────────────────────┐
│  Next.js FE   │ ────────────────▶ │  Identity Provider  │
│  (browser)    │ ◀──────────────── │   (Auth0 / Google)  │
└──────┬───────┘                    └────────────────────┘
       │ REST (HTTPS) + WebSocket (WSS)
       ▼
┌─────────────────────────────────────────────┐
│            NestJS Monolith (API)              │
│  AuthModule  GameModule  ScoreModule  Admin   │
└────────┬──────────┬───────────┬─────────┬─────┘
         ▼          ▼           ▼         ▼
   ┌──────────┐  ┌────────────────────────────┐
   │  Redis    │  │  PostgreSQL (via Prisma)    │
   │ leaderbd, │  │  users · scores · games      │
   │ streak,   │  └────────────────────────────┘
   │ ratelimit │
   └──────────┘
```

ดูรายละเอียดการออกแบบทั้งหมดได้ที่ [`OX_BUILD_SPEC.md`](./OX_BUILD_SPEC.md)

---

## Prerequisites

- **Docker Desktop** 20+ (วิธีที่ง่ายที่สุดในการรันทั้งระบบ)
- **Node.js** 20 LTS ขึ้นไป (เฉพาะกรณีต้องการรัน service นอก Docker)
- **บัญชี OAuth provider** (Auth0 free tier หรือ Google Cloud project) — ดูวิธีตั้งค่าที่ [OAuth Provider Setup](#oauth-provider-setup)

---

## Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd ox-game

# 2. คัดลอกไฟล์ env ตัวอย่าง แล้วใส่ OAuth credentials ของคุณ
cp .env.example .env

# 3. รันทั้งระบบ (api + web + postgres + redis)
docker compose up --build
```

หลัง container ขึ้นแล้ว เข้าถึงได้ที่:

- **Web app** — http://localhost:3000
- **API** — http://localhost:4000/api
- **Swagger** — http://localhost:4000/docs

วิธีหยุด:

```bash
docker compose down          # หยุด container (ข้อมูลยังอยู่)
docker compose down -v       # หยุด + ลบข้อมูลทั้งหมด (Postgres volume)
```

### Local development (ไม่ใช้ Docker สำหรับ app services)

```bash
# รัน infrastructure เฉพาะ postgres + redis
docker compose up postgres redis -d

# ติดตั้ง dependencies
npm install

# Apply DB migrations
npm run prisma:migrate

# รัน API (watch mode)
npm run dev:api          # http://localhost:4000/api

# รัน web (terminal แยก)
npm run dev:web          # http://localhost:3000
```

---

## Configuration

การตั้งค่าทั้งหมดทำผ่าน environment variables — copy `.env.example` เป็น `.env` แล้วกรอกค่าที่จำเป็น

### Required — ต้องตั้ง ไม่งั้น API ไม่ start

- **`DATABASE_URL`** — PostgreSQL connection string
- **`REDIS_URL`** — Redis connection string
- **`SESSION_SECRET`** — string สุ่มสำหรับ sign session cookie (อย่างน้อย 32 ตัวอักษร)

### OAuth — optional ใน schema แต่ในทางปฏิบัติต้องตั้งทุกตัวจึงจะ login ได้จริง

- **`OAUTH_PROVIDER`** — `auth0` หรือ `google`
- **`OAUTH_ISSUER_URL`** — OAuth issuer URL เช่น `https://YOUR_TENANT.auth0.com`
- **`OAUTH_CLIENT_ID`** — OAuth client ID จาก provider
- **`OAUTH_CLIENT_SECRET`** — OAuth client secret จาก provider
- **`OAUTH_REDIRECT_URI`** — ต้องตรงกับที่ตั้งไว้ใน provider เป๊ะ ๆ
- **`ADMIN_EMAILS`** — รายการ email (คั่นด้วย comma) ที่จะได้สิทธิ์ admin ตอน login

### Optional — มีค่า default

- **`PORT`** — port ของ API (default `4000`)
- **`NODE_ENV`** — `development` / `production` / `test` (default `development`)
- **`WEB_ORIGIN`** — origin ของ frontend สำหรับ CORS (default `http://localhost:3000`)
- **`SESSION_TTL_SECONDS`** — อายุของ session เป็นวินาที (default `3600`)
- **`NEXT_PUBLIC_WS_URL`** — WebSocket URL ที่ browser ใช้ต่อ (default `http://localhost:4000`)
- **`API_ORIGIN`** — API base URL สำหรับ Next.js rewrites (default `http://localhost:4000`)

API จะ validate ตัวแปรเหล่านี้ตอน startup และหยุดทำงานทันทีพร้อมข้อความชัดเจนถ้า `DATABASE_URL`, `REDIS_URL`, หรือ `SESSION_SECRET` ขาดไป

---

## OAuth Provider Setup

เลือก provider **ตัวใดตัวหนึ่ง** ทั้งสองตัวใช้ได้ แต่ Auth0 ตั้งค่าง่ายกว่าสำหรับการตรวจประเมิน

### ตัวเลือก A — Auth0 (แนะนำสำหรับการตรวจ)

1. สมัครที่ [auth0.com](https://auth0.com) (free tier เพียงพอ)
2. สร้าง application ใหม่ → เลือก **Regular Web Application**
3. ในหน้า settings ของ application ตั้งค่า:
   - **Allowed Callback URLs**: `http://localhost:4000/api/auth/callback`
   - **Allowed Logout URLs**: `http://localhost:3000`
   - **Allowed Web Origins**: `http://localhost:3000`
4. นำค่าเหล่านี้ไปใส่ใน `.env`:
   - `OAUTH_ISSUER_URL` = domain ของ Auth0 (เช่น `https://dev-xxxx.us.auth0.com`)
   - `OAUTH_CLIENT_ID` และ `OAUTH_CLIENT_SECRET` จากหน้า settings เดียวกัน
5. ตั้ง `OAUTH_PROVIDER=auth0` ใน `.env`

### ตัวเลือก B — Google

1. เปิด [Google Cloud Console](https://console.cloud.google.com/) → สร้างหรือเลือก project
2. **APIs & Services → OAuth consent screen** → ตั้งค่า (เลือก External user type ได้สำหรับทดสอบ)
3. **APIs & Services → Credentials → Create credentials → OAuth client ID** → เลือก Web application
4. **Authorized redirect URIs**: `http://localhost:4000/api/auth/callback`
5. นำ client ID และ secret ไปใส่ใน `.env` ตั้ง `OAUTH_PROVIDER=google` และ `OAUTH_ISSUER_URL=https://accounts.google.com`

### การให้สิทธิ์ admin กับตัวเอง

ใส่ email ที่ใช้ login ลงใน `ADMIN_EMAILS` (คั่นด้วย comma) ในไฟล์ `.env` — role จะถูกกำหนดตอน login ดังนั้นถ้าแก้ list แล้วต้อง logout แล้ว login ใหม่

```
ADMIN_EMAILS=you@example.com,coworker@example.com
```

---

## Running Tests

```bash
npm test                          # รัน unit + integration test ทั้งหมด (ทุก workspace)
npm test --workspace=api          # รันเฉพาะ test ของ API
npm run test:cov --workspace=api  # รัน test พร้อม coverage report
npm run lint                      # ESLint ทั้ง monorepo
```

Test ที่เขียนครอบคลุม:

- **Game logic** — การตรวจผู้ชนะ, การตรวจเสมอ, ความถูกต้องของ minimax, ความถูกต้องของ easy-bot
- **Scoring rules** — ตรงตาม truth table ทั้งหมดในสเปค §6.2 รวมถึง edge case การให้โบนัสเมื่อชนะติดกัน 3 ครั้ง และการป้องกัน race condition เมื่อจบเกมพร้อมกัน
- **API contracts** — auth guard, ownership check, status code ตามสเปค §7.4
- **WebSocket** — handshake auth, score:update, leaderboard:update

test แต่ละตัวจะอ้างถึง `RULE-*` ID จากสเปคใน comment เพื่อให้ traceability ชัดเจน

---

## Project Structure

```
ox-game/
├── apps/
│   ├── api/                  # NestJS backend
│   │   └── src/
│   │       ├── auth/         # OAuth flow, session, guards
│   │       ├── game/         # game logic, minimax bot, HTTP layer
│   │       │   └── dto/
│   │       ├── score/        # scoring, win-streak, leaderboard
│   │       ├── admin/        # admin endpoints
│   │       │   └── dto/
│   │       ├── ws/           # WebSocket gateway, Redis adapter
│   │       ├── common/       # filters, guards, decorators
│   │       ├── prisma/       # PrismaService module
│   │       ├── redis/        # RedisService module
│   │       └── config/       # env validation
│   └── web/                  # Next.js frontend
│       ├── app/              # /login /play /leaderboard
│       ├── components/       # Board, ThemeToggle
│       ├── store/            # Zustand state (auth, game)
│       └── lib/              # API client, Socket.IO client
├── packages/
│   └── shared/               # shared TypeScript types & DTOs
├── prisma/
│   └── schema.prisma         # database schema
├── docker-compose.yml
├── .env.example
├── OX_BUILD_SPEC.md          # spec ฉบับเต็ม
└── README.md
```

---

## API Documentation

หลังจาก API รันแล้ว เปิด Swagger documentation แบบ interactive ได้ที่:

**http://localhost:4000/docs**

### Public endpoints

- `GET /api/health` — Liveness check
- `GET /api/auth/login` — เริ่ม OAuth2 login flow
- `GET /api/auth/callback` — OAuth2 callback รับ code จาก IdP
- `GET /api/leaderboard` — อันดับผู้เล่น รองรับ `?difficulty=EASY|HARD&limit=N`

### Session required (ต้อง login ก่อน)

- `POST /api/auth/logout` — ลบ session
- `GET /api/me` — ข้อมูลผู้ใช้ปัจจุบัน + คะแนนทั้ง Easy/Hard
- `POST /api/games` — สร้างเกมใหม่
- `GET /api/games/:id` — ดู state ของเกม (เฉพาะเจ้าของ)
- `POST /api/games/:id/move` — ส่ง move (เจ้าของเท่านั้น, rate-limited 30 req/10 วินาที)
- `GET /api/scores/me` — ดูคะแนนตัวเอง

### Admin only

- `GET /api/admin/scores` — คะแนนผู้เล่นทั้งหมด (paginated, sortable)
- `GET /api/admin/players/:id` — คะแนน + ประวัติเกมล่าสุดของผู้เล่น

### WebSocket events (namespace `/ws`)

- `score:update` — push ไปยัง client เมื่อคะแนนของผู้ใช้เปลี่ยน
- `leaderboard:update` — broadcast ไปทุก client เมื่ออันดับ leaderboard เปลี่ยน

ดูสัญญา (contract) ฉบับเต็มที่สเปค §7–§8 ใน [`OX_BUILD_SPEC.md`](./OX_BUILD_SPEC.md)

---

## Design Decisions

การตัดสินใจสำคัญในการ implement (ดูรายการเต็มที่สเปค §2):

### D1 — Modular Monolith (ไม่ใช่ microservices)

scope งานเล็ก ทำให้ ship และ test แบบ end-to-end ง่ายกว่า โมดูลถูกแบ่งตาม domain boundary ชัดเจน ถ้าจะแยกเป็น service ในอนาคตทำได้โดยไม่ต้องเขียนใหม่มาก

### D9 — เสมอ (draw) รีเซ็ต win-streak เป็น 0

สเปคไม่ได้ระบุ การรีเซ็ตเมื่อเสมอทำให้คำว่า "ชนะติดต่อกัน" ตรงตามความหมายตรงตัว

### D10 — คะแนนรวมติดลบได้

สเปคไม่ได้กำหนดค่าต่ำสุด ปล่อยให้ติดลบได้ตรงไปตรงมามากกว่า ไม่ซ่อนผลแพ้

### D11 — Bot มี 2 ระดับความยาก (ค่าเริ่มต้น `EASY`)

bot แบบ minimax ล้วนจะไม่มีทางแพ้ ทำให้ feature โบนัสชนะติดต่อกันไม่มีโอกาสใช้งาน `EASY` ทำให้โบนัสเป็นไปได้จริง ส่วน `HARD` ไว้สำหรับคนที่อยากท้าทาย

### D12 — PostgreSQL เป็น source of truth, Redis เก็บค่า hot

Redis ให้การอ่าน leaderboard ระดับ sub-millisecond และ atomic streak update ผ่าน Lua script ส่วน Postgres รับประกัน durability และเป็นแหล่งสำหรับ rebuild Redis ถ้าหายไป

### D13 — Admin role ใช้ระบบ email allowlist

หลีกเลี่ยงการสร้าง UI จัดการ role ที่อยู่นอก scope งาน — กำหนด admin ผ่าน env `ADMIN_EMAILS`

### Atomic scoring (สเปค §6.1)

จุดที่อยากเน้นเป็นพิเศษคือการให้คะแนนถูก implement เป็น Redis Lua script ตัวเดียวเพื่อกัน race condition เมื่อมีหลายเกมจบพร้อมกันสำหรับผู้เล่นเดียวกัน ป้องกันไม่ให้ตัวนับ streak เพี้ยน ซึ่งเป็นปัญหาที่เกิดได้จริงเพราะการคำนวณโบนัสต้อง read-then-write ค่า streak

---

## Trade-offs

สิ่งที่ **ตั้งใจไม่ทำ** ใน implementation นี้พร้อมเหตุผล:

- **Microservices** — เกินความจำเป็นสำหรับ scope งานนี้ การออกแบบเปิดทางให้แยกได้ในอนาคต (boundary ระหว่าง game-finish กับ score-apply ถูกแยกไว้ในเชิง concept แล้ว)
- **ระบบ auth / membership เอง** — โจทย์อนุญาตให้ใช้ OAuth ผ่าน IdP ภายนอก การทำเองเพิ่มความเสี่ยงโดยไม่ได้ value
- **Kubernetes / multi-region** — Docker Compose พอแล้วสำหรับการ demo ระบบ การ deploy production อยู่นอก scope
- **Player vs Player realtime** — อยู่นอก scope ตามโจทย์ (ระบุชัดว่า player vs bot)
- **Custom UI design system** — ใช้ styling แบบมินิมอลเพื่อโฟกัสที่ความถูกต้องของ backend และ architecture ซึ่งเป็นจุดที่โจทย์ให้น้ำหนักจริง

---

## Future Work

ขั้นต่อไปที่สมเหตุสมผลถ้าโปรเจกต์นี้จะเติบโต:

- แยก `score` และ `admin` ออกเป็น service ต่างหาก เชื่อมด้วย event bus
- เพิ่ม OpenTelemetry tracing ข้ามโมดูล
- ทำระบบ Player vs Player พร้อม matchmaking ผ่าน WebSocket
- เพิ่ม internationalization (ปัจจุบัน UI เป็นภาษาอังกฤษอย่างเดียว)
- ตั้ง CI/CD pipeline ที่รัน test อัตโนมัติเมื่อมี PR
- Kubernetes manifests สำหรับ production deployment

---

## License

MIT
