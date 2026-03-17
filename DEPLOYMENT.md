# Deployment Guide

**Stack:** Vercel (frontend) · Render (6 backend services + PostgreSQL) · Redpanda Cloud (Kafka)

> **Note:** Upstash Kafka was shut down on March 11, 2025. Redpanda Cloud is the recommended free replacement — it is fully Kafka-compatible so no code changes are needed.

> **Render free tier note:** Free web services sleep after 15 minutes of inactivity. Kafka consumers reconnect and catch up on all missed messages when they wake up — the pipeline still completes, just with a 30–60 second cold-start delay. The frontend shows a "Services are starting up" overlay automatically during this time.

---

## 1. Redpanda Cloud Kafka (do this first — you need the credentials for Render)

1. Go to [cloud.redpanda.com](https://cloud.redpanda.com) → sign up for a free account
2. Click **Create Cluster** → choose **Serverless** (free tier) → pick a region → **Create**
3. Once the cluster is ready, go to **Connect** → **Kafka API**. Copy:
   - **Bootstrap server URL** → this is your `KAFKA_BROKER` (format: `xxx.redpanda.com:9092`)
   - **Username** → `KAFKA_SASL_USERNAME`
   - **Password** → `KAFKA_SASL_PASSWORD`
4. Go to **Topics** → **Create Topic** and create these 7 topics (default settings, 1 partition each):
   - `loan-application-submitted`
   - `credit-check-completed`
   - `risk-assessment-completed`
   - `loan-decision-made`
   - `loan-account-created`
   - `user-registered`
   - `loan-service.DLQ`

---

## 2. Render PostgreSQL (1 shared database)

Render only allows **one free PostgreSQL instance per account**. All 6 services share it — each service automatically creates its own isolated PostgreSQL schema on startup (`loan_service`, `credit_service`, etc.), so there is no table conflict.

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **PostgreSQL**
2. Fill in:
   - **Name:** `lendstream-db`
   - **Region:** pick one (e.g. Oregon)
   - **Plan:** Free
3. Click **Create Database** and wait for it to be ready
4. Copy the **External Database URL** — all 6 services will use this same value as `DATABASE_URL`

> **Note:** Free Render PostgreSQL instances expire after 90 days. Delete and recreate to stay free (data will be lost — fine for a demo project).

---

## 3. Render Web Services (6 backend services)

Deploy each of the 6 services as a separate Render **Web Service**.

For each service:

1. Go to [dashboard.render.com](https://dashboard.render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Fill in:
   - **Name:** `lendstream-<service>` (e.g. `lendstream-loan-service`)
   - **Region:** same as your PostgreSQL database
   - **Root Directory:** `services/<service-name>` (e.g. `services/loan-service`)
   - **Runtime:** Docker
   - **Plan:** Free
4. Click **Create Web Service**
5. Once deployed, copy its public URL (e.g. `https://lendstream-loan-service.onrender.com`)
6. Go to **Environment** and add the variables from the table below

Repeat for all 6 services:

| Service | Root Directory |
|---|---|
| loan-service | `services/loan-service` |
| credit-service | `services/credit-service` |
| risk-service | `services/risk-service` |
| approval-service | `services/approval-service` |
| account-service | `services/account-service` |
| notification-service | `services/notification-service` |

### Environment variables per service

All 6 services need these:

| Variable | Value |
|---|---|
| `KAFKA_BROKER` | from Redpanda (e.g. `xxx.redpanda.com:9092`) |
| `KAFKA_SASL_USERNAME` | from Redpanda |
| `KAFKA_SASL_PASSWORD` | from Redpanda |
| `DATABASE_URL` | External Database URL from Render — **same value for all 6 services** |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g. `https://lendstream.vercel.app`) — set after step 4 |
| `NODE_ENV` | `production` |

Additional variables for **loan-service only**:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Any long random string (min 32 chars) |

After all 6 services are deployed, note their public Render URLs — you'll need them for Vercel.

---

## 4. Vercel (frontend)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import this GitHub repo
2. Set **Root Directory** to `frontend`
3. Framework preset will auto-detect as **Vite**
4. Under **Environment Variables**, add:

| Variable | Value |
|---|---|
| `VITE_LOAN_SERVICE_URL` | Render URL for loan-service (e.g. `https://lendstream-loan-service.onrender.com`) |
| `VITE_CREDIT_SERVICE_URL` | Render URL for credit-service |
| `VITE_RISK_SERVICE_URL` | Render URL for risk-service |
| `VITE_APPROVAL_SERVICE_URL` | Render URL for approval-service |
| `VITE_ACCOUNT_SERVICE_URL` | Render URL for account-service |
| `VITE_NOTIFICATION_SERVICE_URL` | Render URL for notification-service |
| `VITE_PLATFORM` | `render` |

5. Click **Deploy**
6. Copy your Vercel URL (e.g. `https://lendstream.vercel.app`)

> `VITE_PLATFORM=render` enables the "Services are starting up" overlay on the frontend, which appears when Render services are waking from sleep and disappears once they're ready.

### 4a. Update FRONTEND_URL on Render

Go back to each Render service → **Environment** → set `FRONTEND_URL` to your Vercel URL.
This is required for CORS and for email verification links to work correctly.

---

## 5. Verify everything works

1. Open your Vercel URL — if services are asleep you'll see the waking overlay (disappears in ~30–60s)
2. Register a new account — you should receive a verification email
3. Verify your email and log in
4. Submit a loan application
5. Open the pipeline modal — all 6 stages should complete

---

## Local development (unchanged)

```bash
docker compose up --build
```

Everything runs locally via Docker Compose exactly as before. No env vars needed — defaults are used. The waking overlay is not shown locally (no `VITE_PLATFORM=render`).

---

## Re-deploying after Render DB expiry (every 90 days)

1. Delete the expired Render PostgreSQL instance
2. Create a new free one with the same name (`lendstream-db`)
3. Copy the new External Database URL
4. Update `DATABASE_URL` in **all 6** Render services' Environment variables (same URL for all)
5. Render will automatically redeploy — schemas and tables are recreated on startup
