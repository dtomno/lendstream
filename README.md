# LendStream — Event-Driven Loan Processing System

A production-quality microservices application demonstrating event-driven architecture with Apache Kafka, built with Node.js + TypeScript.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│          React Dashboard  :3000  (nginx reverse proxy)          │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST + JWT
                             ▼
                    ┌─────────────────┐
                    │  loan-service   │  :3001  Auth · Outbox · DLQ
                    └────────┬────────┘
                             │ loan-application-submitted
                             ▼
                    ┌─────────────────┐
                    │  Apache Kafka   │  :9092 (KRaft — no ZooKeeper)
                    │   Kafka UI ↗    │  :8080
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
    credit-service    risk-service    approval-service
       :3002             :3003            :3004
   credit score      DTI · risk     APPROVED / REJECTED
   (300–850)         scoring         + interest rate
            │                                 │
  credit-check-completed           loan-decision-made
                                             │
                          ┌──────────────────┼──────────────────┐
                          ▼                  ▼                  ▼
                  account-service    notification-service  loan-service
                     :3005               :3006           (status update)
                  account number      Nodemailer email
                  monthly payment     (Ethereal in dev)
```

**Choreography pattern** — no central orchestrator. Each service reacts to Kafka events and emits its own.

## Features

### Infrastructure Patterns
| Pattern | Implementation |
|---|---|
| **Outbox Pattern** | loan-service writes to DB + outbox table in a single transaction; a 1s poller publishes to Kafka (`FOR UPDATE SKIP LOCKED`), guaranteeing at-least-once delivery |
| **Dead Letter Queue** | Every consumer wraps `eachMessage` in try/catch; errors persist to `dlq_events` table and publish to `<service>.DLQ` Kafka topic |
| **Idempotent Consumers** | All `INSERT` statements use `ON CONFLICT DO NOTHING` — safe to replay any Kafka message |
| **Database-per-Service** | 6 independent PostgreSQL databases — no shared schema |
| **Correlation IDs** | UUID generated at loan submission, propagated through every Kafka event |

### Security
- **JWT authentication** — HS256, 1-hour expiry, `Authorization: Bearer` header
- **Role-based access control** — `APPLICANT` (own loans only) vs `LOAN_OFFICER` (all loans)
- **bcrypt password hashing** — cost factor 10
- **Helmet** — HTTP security headers on all services
- **Rate limiting** — 100 req/15 min general · 10 req/15 min on auth endpoints
- **Zod validation** — structured field-level error responses

### Observability
- **Prometheus metrics** — `http_requests_total`, `http_request_duration_seconds`, `kafka_events_processed_total` on every service at `/metrics`
- **Grafana dashboard** — pre-provisioned: HTTP rate, error rate, p99 latency, Kafka throughput, heap, event-loop lag
- **Winston structured logging** — JSON with timestamp, correlation ID, service name on every line
- **Swagger/OpenAPI** — interactive docs at `http://localhost:3001/api/docs`

### Email
- **Nodemailer** — sends approval/rejection and account creation emails
- **Ethereal auto-account** — zero-config dev email; preview URLs logged to console (no signup needed)

## Tech Stack

| Layer | Technology |
|---|---|
| Services | Node.js 20 + TypeScript |
| Messaging | Apache Kafka 3.7 (KRaft — no ZooKeeper) |
| Database | PostgreSQL 15 (one DB per service) |
| Auth | jsonwebtoken + bcryptjs |
| Validation | Zod |
| Logging | Winston (JSON) |
| Metrics | prom-client → Prometheus → Grafana |
| API Docs | swagger-jsdoc + swagger-ui-express |
| Frontend | React 18 + Vite + Tailwind CSS + react-router-dom |
| Gateway | nginx reverse proxy |
| Deploy | Docker Compose |
| CI | GitHub Actions (matrix typecheck + integration smoke test) |

## Quick Start

**Prerequisites:** Docker Desktop

```bash
git clone <repo-url>
cd loan-processing-system

# Optional: override secrets (or leave as-is for dev defaults)
cp .env.example .env

docker compose up --build
```

Wait ~60 seconds for Kafka to initialise.

| URL | Description |
|---|---|
| http://localhost:3000 | React dashboard — login or register to start |
| http://localhost:3001/api/docs | Swagger UI |
| http://localhost:8080 | Kafka UI — browse topics and messages |
| http://localhost:3007 | Grafana (admin / admin) |
| http://localhost:9090 | Prometheus |

---

## Docker Commands

### Full stack

```bash
# Build all images and start every container (first run or after code changes)
docker compose up --build

# Start without rebuilding (faster, when images are already built)
docker compose up

# Run in the background (detached)
docker compose up -d

# Stop all containers (keeps volumes/data)
docker compose stop

# Stop and remove containers + networks (keeps volumes/data)
docker compose down

# Stop, remove containers, AND wipe all data volumes (full reset)
docker compose down -v
```

### Individual services

Rebuild and restart a single service without touching the others:

```bash
# Syntax: docker compose up -d --build <service-name>

docker compose up -d --build loan-service
docker compose up -d --build credit-service
docker compose up -d --build risk-service
docker compose up -d --build approval-service
docker compose up -d --build account-service
docker compose up -d --build notification-service
docker compose up -d --build frontend
```

Restart a service that is already built (no rebuild):

```bash
docker compose restart loan-service
docker compose restart credit-service
docker compose restart risk-service
docker compose restart approval-service
docker compose restart account-service
docker compose restart notification-service
docker compose restart frontend
```

Start/stop individual services:

```bash
docker compose start <service-name>
docker compose stop <service-name>
```

### Infrastructure only

Useful when developing services locally and you only need Kafka + Postgres:

```bash
# Start only infrastructure (no microservices, no frontend)
docker compose up -d postgres kafka kafka-ui

# Add monitoring stack
docker compose up -d postgres kafka kafka-ui prometheus grafana
```

### Logs

```bash
# Stream logs from all containers
docker compose logs -f

# Stream logs from a specific service
docker compose logs -f loan-service
docker compose logs -f credit-service
docker compose logs -f kafka

# Show last N lines
docker compose logs --tail=100 loan-service
```

### Status and inspection

```bash
# Show running containers and their status
docker compose ps

# Show resource usage (CPU, memory)
docker stats

# Open a shell inside a container
docker exec -it lps-loan-service sh
docker exec -it lps-postgres psql -U postgres

# Connect to a specific database
docker exec -it lps-postgres psql -U postgres -d loans_db
docker exec -it lps-postgres psql -U postgres -d credit_db
```

---

## Local Development (without Docker)

Run the services directly on your machine for a faster edit → reload cycle. You still need Docker for Kafka and PostgreSQL.

### Prerequisites

- Node.js 20+
- Docker Desktop (for infrastructure only)

### Step 1 — Start infrastructure

```bash
docker compose up -d postgres kafka kafka-ui
```

Wait ~15 seconds for Kafka to be ready.

### Step 2 — Create the databases

The databases are normally created by the Docker init script. When running services locally, create them manually once:

```bash
docker exec -it lps-postgres psql -U postgres -c "
  CREATE DATABASE loans_db;
  CREATE DATABASE credit_db;
  CREATE DATABASE risk_db;
  CREATE DATABASE approval_db;
  CREATE DATABASE accounts_db;
  CREATE DATABASE notifications_db;
"
```

> Skip this step if you've already run `docker compose up` before — the databases will already exist.

### Step 3 — Create a `.env` file for each service

Each service reads its config from environment variables. The easiest approach is to `export` them in your shell, or create a `.env` in the service directory.

Example for **loan-service** (`services/loan-service/.env`):

```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=loans_db
DB_USER=postgres
DB_PASSWORD=postgres123
KAFKA_BROKER=localhost:9094
JWT_SECRET=super-secret-jwt-key-change-in-production-min-32-chars
LOG_LEVEL=info
KAFKAJS_NO_PARTITIONER_WARNING=1
```

Use the same pattern for each service, changing `PORT`, `DB_NAME`, and removing `JWT_SECRET` where not needed:

| Service | PORT | DB_NAME |
|---|---|---|
| loan-service | 3001 | loans_db |
| credit-service | 3002 | credit_db |
| risk-service | 3003 | risk_db |
| approval-service | 3004 | approval_db |
| account-service | 3005 | accounts_db |
| notification-service | 3006 | notifications_db |

> Note: use `KAFKA_BROKER=localhost:9094` (external port) when running outside Docker, not `kafka:9092`.

### Step 4 — Install dependencies and start services

Open a separate terminal for each service you want to run:

```bash
# loan-service
cd services/loan-service
npm install
npm run dev        # uses ts-node-dev for hot reload
# or: npm start    # compiles then runs

# credit-service
cd services/credit-service
npm install
npm run dev

# risk-service
cd services/risk-service
npm install
npm run dev

# approval-service
cd services/approval-service
npm install
npm run dev

# account-service
cd services/account-service
npm install
npm run dev

# notification-service
cd services/notification-service
npm install
npm run dev
```

### Step 5 — Start the frontend dev server

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173` — Vite proxies all `/api/*` requests to the correct backend ports automatically (configured in `vite.config.ts`).

### TypeScript type-checking

```bash
# Check a single service
cd services/loan-service
npx tsc --noEmit

# Check all services at once (from root)
for svc in loan-service credit-service risk-service approval-service account-service notification-service; do
  echo "=== $svc ===" && (cd services/$svc && npx tsc --noEmit)
done
```

## API Reference

### Auth — `POST /api/auth/register` · `POST /api/auth/login`

```bash
# Register (role: APPLICANT or LOAN_OFFICER)
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123","role":"LOAN_OFFICER"}'

# Login → { token, user }
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"password123"}'
```

### Loans

```bash
# Submit (requires JWT)
curl -X POST http://localhost:3001/api/loans \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "applicantName": "Jane Smith",
    "email": "jane@example.com",
    "amount": 25000,
    "purpose": "Home Renovation",
    "income": 75000,
    "employmentStatus": "EMPLOYED"
  }'

# List (LOAN_OFFICER sees all; APPLICANT sees own)
curl http://localhost:3001/api/loans -H "Authorization: Bearer <token>"

# Get single
curl http://localhost:3001/api/loans/<id> -H "Authorization: Bearer <token>"
```

### Pipeline read endpoints (no auth)

```
GET /api/credit/:loanId        credit-service       :3002
GET /api/risk/:loanId          risk-service         :3003
GET /api/decisions/:loanId     approval-service     :3004
GET /api/accounts/:loanId      account-service      :3005
GET /api/notifications/:loanId notification-service :3006
```

## Kafka Topics

| Topic | Producer | Consumers |
|---|---|---|
| `loan-application-submitted` | loan-service | credit-service |
| `credit-check-completed` | credit-service | risk-service |
| `risk-assessment-completed` | risk-service | approval-service |
| `loan-decision-made` | approval-service | loan-service · account-service · notification-service |
| `loan-account-created` | account-service | notification-service |
| `*.DLQ` | each service (on error) | — |

## Databases

| Service | Database | Key tables |
|---|---|---|
| loan-service | loans_db | loan_applications · users · outbox_events · dlq_events |
| credit-service | credit_db | credit_assessments · dlq_events |
| risk-service | risk_db | risk_assessments · dlq_events |
| approval-service | approval_db | loan_decisions · dlq_events |
| account-service | accounts_db | loan_accounts · dlq_events |
| notification-service | notifications_db | notifications · dlq_events |

## Scoring & Decision Logic

### Credit Score (300–850)
Deterministic per `loanId` (reproducible), driven by employment (+90 for EMPLOYED), income bracket, and loan-to-income ratio. Grades A–F.

### Risk Score (0–100)
Credit risk (0–50) + debt-to-income risk (0–50).

| Score | Level |
|---|---|
| 0–20 | LOW |
| 21–40 | MEDIUM |
| 41–65 | HIGH |
| 66–100 | VERY_HIGH |

### Decision
LOW/MEDIUM risk loans are approved at rates from 5.5% (score ≥ 750) to 14.5% (score ≥ 600). HIGH/VERY_HIGH → REJECTED.

## CI Pipeline

GitHub Actions runs on every push to `main`/`develop`:

1. **Typecheck** — `tsc --noEmit` for all 6 services in parallel (matrix build)
2. **Frontend build** — `npm run build`
3. **Integration smoke test** — spins up full Docker Compose stack, registers a user, logs in, submits a loan, waits for processing, verifies final status, checks Prometheus `/metrics`

## Project Structure

```
loan-processing-system/
├── services/
│   ├── loan-service/src/
│   │   ├── auth/          # JWT middleware, register/login routes
│   │   ├── validation/    # Zod schemas + Express middleware
│   │   ├── outbox/        # Outbox poller
│   │   ├── logger.ts      # Winston
│   │   ├── metrics.ts     # prom-client
│   │   ├── swagger.ts     # OpenAPI spec
│   │   ├── db.ts          # PostgreSQL pool + schema
│   │   ├── kafka.ts       # Producer · consumer · DLQ
│   │   ├── routes.ts      # Loan CRUD
│   │   └── index.ts       # Express app
│   ├── credit-service/
│   ├── risk-service/
│   ├── approval-service/
│   ├── account-service/
│   └── notification-service/src/
│       └── emailService.ts  # Nodemailer + Ethereal
├── frontend/src/
│   ├── context/AuthContext.tsx
│   ├── pages/LoginPage.tsx · RegisterPage.tsx
│   ├── components/Navbar.tsx · PrivateRoute.tsx
│   │             LoanForm.tsx · LoanList.tsx · PipelineModal.tsx
│   └── api.ts              # axios + JWT interceptor
├── postgres/init/           # SQL: creates 6 databases
├── monitoring/
│   ├── prometheus.yml
│   └── grafana/provisioning/ # Pre-built dashboard JSON
├── .github/workflows/ci.yml
└── docker-compose.yml
```

## Environment Variables

Set in `docker-compose.yml`. Key ones to change for production:

| Variable | Default | Notes |
|---|---|---|
| `JWT_SECRET` | `super-secret-jwt-key-…` | **Must change** — min 32 chars |
| `EMAIL_HOST` | *(empty)* | Leave blank → Ethereal auto-account |
| `EMAIL_PORT` | `587` | SMTP port |
| `EMAIL_USER` | *(empty)* | SMTP username |
| `EMAIL_PASS` | *(empty)* | SMTP password |

## Design Decisions

**Why the Outbox Pattern?**
Directly publishing to Kafka inside a DB transaction isn't atomic — if Kafka is unavailable at commit time, the loan is saved but the event is silently lost. Writing to an `outbox_events` table in the same transaction, then polling it independently, gives exactly-once DB writes with at-least-once Kafka delivery.

**Why choreography over orchestration?**
Each service is independently deployable and testable. Adding a new step (e.g. fraud detection) means subscribing to an existing topic — no changes to other services.

**Why `service_started` instead of a Kafka healthcheck?**
Kafka readiness is nuanced (broker up ≠ topic ready). Services implement their own retry loop (10 attempts × 5s) which is more reliable and avoids needing `kafka-topics.sh` inside the container.

## License

MIT
