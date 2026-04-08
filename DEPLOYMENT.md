# Deployment Guide

**Stack:** Vercel (frontend) · Render (6 backend services + PostgreSQL) · Aiven (Kafka)

> **Render free tier note:** Free web services sleep after 15 minutes of inactivity. Kafka consumers reconnect and catch up on all missed messages when they wake up — the pipeline still completes, just with a 30–60 second cold-start delay. The frontend shows a "Services are starting up" overlay automatically during this time.

---

## 1. Aiven Kafka (do this first — you need the credentials for Render)

Aiven offers a permanently free Kafka tier — no trial period, no credit card required, no expiry.

1. Go to [aiven.io](https://aiven.io) → sign up for a free account
2. Click **Create service** → choose **Apache Kafka** → select the **Free** plan → pick a region → **Create**
3. Once the cluster is ready, go to the service overview. Under **Connection information**, copy:
   - **Service URI** → this is your `KAFKA_BROKER` (format: `xxx.aivencloud.com:PORT`)
   - **User** → `KAFKA_SASL_USERNAME`
   - **Password** → `KAFKA_SASL_PASSWORD`

   > **Note:** Aiven uses SASL/SCRAM-SHA-256 with SSL — already configured in the services.

4. Go to **Topics** → **Create topic** and create these 5 topics (1 partition, default retention):
   - `loan-application-submitted`
   - `credit-check-completed`
   - `risk-assessment-completed`
   - `loan-decision-made`
   - `loan-account-created`

> **Free tier limits:** 5 topics · 250 KB/s throughput · 3-day retention · powers off after 24h idle (reactivate from the Aiven console — no data loss). This is fine for a portfolio demo.

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
| `KAFKA_BROKER` | from Aiven (e.g. `xxx.aivencloud.com:PORT`) |
| `KAFKA_SASL_USERNAME` | from Aiven |
| `KAFKA_SASL_PASSWORD` | from Aiven |
| `DATABASE_URL` | External Database URL from Render — **same value for all 6 services** |
| `FRONTEND_URL` | Your Vercel frontend URL (e.g. `https://lendstream.vercel.app`) — set after step 4 |
| `NODE_ENV` | `production` |

Additional variables for **loan-service only**:

| Variable | Value |
|---|---|
| `JWT_SECRET` | Any long random string (min 32 chars) |

Additional variables for **notification-service** and **loan-service**:

| Variable | Value |
|---|---|
| `BREVO_API_KEY` | Your Brevo API key (see Brevo setup below) |
| `EMAIL_FROM_ADDRESS` | The verified sender email you added in Brevo (e.g. `you@gmail.com`) |
| `EMAIL_FROM_NAME` | `LendStream` |

After all 6 services are deployed, note their public Render URLs — you'll need them for Vercel.

---

## 3a. Brevo (email delivery)

Render free tier blocks all outbound SMTP ports (25, 465, 587). Both `notification-service` and `loan-service` use the Brevo HTTP API (port 443) instead. Brevo is free for 300 emails/day — **no domain required**, just verify any email address you own.

1. Go to [brevo.com](https://brevo.com) → sign up (free)
2. Go to **Senders & IPs** → **Senders** → **Add a Sender**
   - Enter any email you own (e.g. your Gmail address)
   - Brevo sends a verification link to that address — click it
3. Go to **SMTP & API** → **API Keys** → **Generate a new API key** → copy it
4. In your Render environment variables, set the following on **both** `notification-service` and `loan-service`:
   - `BREVO_API_KEY` = the API key you copied
   - `EMAIL_FROM_ADDRESS` = the email address you verified in step 2
   - `EMAIL_FROM_NAME` = `LendStream`

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
