# Production Deployment Guide

This document provides complete instructions for deploying the **Canteen Booking System** (FastAPI Backend + React Frontend + PostgreSQL) to production environments.

---

## 1. Architecture Overview

- **Backend**: FastAPI running behind Uvicorn (4 worker processes in Docker container).
- **Frontend**: React (Vite) single-page app built and served via Nginx with reverse proxy to `/api/` and client-side routing fallback.
- **Database**: PostgreSQL 16 (or managed PostgreSQL like Neon, Supabase, Railway, AWS RDS).
- **Observability**: Sentry error tracking + Structured JSON logging.
- **Security & Reliability**: Global and OTP rate limiting, JWT token rotation, bcrypt password hashing, and DB health check probes.

---

## 2. Environment Variables

### Backend (`.env` or Container Environment)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | — | Connection string (e.g. `postgresql+psycopg2://user:pass@host:5432/dbname`) |
| `JWT_SECRET_KEY` | **Yes** | — | Cryptographically secure random 32+ character string |
| `JWT_ALGORITHM` | No | `HS256` | JWT signing algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Access token lifespan in minutes |
| `REFRESH_TOKEN_EXPIRE_DAYS` | No | `7` | Refresh token lifespan in days |
| `TWILIO_ACCOUNT_SID` | **Yes** | — | Twilio Account SID for SMS OTP |
| `TWILIO_AUTH_TOKEN` | **Yes** | — | Twilio Auth Token |
| `TWILIO_FROM_NUMBER` | **Yes** | — | Twilio outbound phone number in E.164 format |
| `ADMIN_API_KEY` | **Yes** | — | Secret key used in `X-Admin-Key` header for vendor provisioning |
| `CORS_ORIGINS` | No | `*` | Comma-separated list of allowed origins (e.g. `https://canteen.yourdomain.com`) |
| `DEFAULT_RATE_LIMIT` | No | `60/minute` | Default SlowAPI rate limit per IP |
| `SENTRY_DSN` | No | `None` | Sentry DSN for backend error tracking and performance |
| `ENVIRONMENT` | No | `production` | Deployment environment name (`production`, `staging`, `development`) |

### Frontend (`frontend/.env` or build environment)

| Variable | Required | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | No | `/api/v1` or `http://localhost:8080` | API endpoint base URL. When served behind Nginx reverse proxy, leave empty or set to `/api/v1` |
| `VITE_SENTRY_DSN` | No | `None` | Sentry DSN for frontend React error boundary and tracking |

---

## 3. Database Setup & Migrations

### Option A: Managed PostgreSQL (Neon / Supabase / Railway / Render)
1. Create a PostgreSQL 15+ database instance on your provider.
2. Obtain the connection string (ensure it uses `postgresql+psycopg2://...`).
3. Set `DATABASE_URL` in your backend environment.

### Option B: Self-Hosted Docker Compose
The `docker-compose.prod.yml` starts a PostgreSQL 16 container with persistent volumes (`pgdata_prod`).

### Running Alembic Migrations
Before starting or after updating code, apply database migrations:

```bash
# Locally or inside the container:
alembic upgrade head
```

> **Note:** Alembic targets PostgreSQL only. Revision `0001_initial` emits a
> Postgres-only `DO $$ ... $$` block, so the chain cannot run against SQLite.
> Local/dev SQLite databases are built from the models at app startup
> (`Base.metadata.create_all` plus `app/db/auto_migrate.py`), which already
> reflects new columns and constraints automatically. Do not point `alembic` at
> a SQLite file.

---

## 3.1 HTTPS Requirement for the Pickup QR Scanner

The vendor pickup scanner at `/vendor/scan` uses `getUserMedia`, which browsers
only expose in a **secure context**:

| Environment | Camera |
| --- | --- |
| `https://...` | Allowed |
| `http://localhost` / `127.0.0.1` | Allowed (development) |
| `http://<any other host or IP>` | **Blocked** |

If the app is served over plain HTTP on a LAN or public IP, the scanner will
report a permission error. The scanner detects this and tells the vendor to use
the manual code entry or the ready-orders list instead, so the handover flow
stays usable — but to scan at all, terminate TLS at your load balancer/reverse
proxy and serve the app over HTTPS.

Camera access also requires the browser to grant permission for the origin; on
first use the vendor will be prompted, and a denial falls back to manual entry.

---

## 4. Production Deployment Methods

### Method 1: Docker Compose (Recommended for VPS / Single VM)

1. Clone the repository onto your production server (e.g. AWS EC2, DigitalOcean Droplet, Hetzner):
   ```bash
   git clone <repo-url>
   cd Pre-book
   ```

2. Create a `.env` file containing your production secrets:
   ```bash
   POSTGRES_USER=canteen
   POSTGRES_PASSWORD=your_secure_db_password
   POSTGRES_DB=canteen_booking
   JWT_SECRET_KEY=$(openssl rand -hex 32)
   ADMIN_API_KEY=$(openssl rand -hex 24)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_twilio_auth_token
   TWILIO_FROM_NUMBER=+1234567890
   CORS_ORIGINS=https://canteen.example.com
   SENTRY_DSN=https://xxx@yyy.ingest.sentry.io/zzz
   ```

3. Build and launch all containers:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

4. Run database migrations inside the backend container:
   ```bash
   docker compose -f docker-compose.prod.yml exec api alembic upgrade head
   ```

5. Verify services:
   ```bash
   curl -i http://localhost/health
   # Expected response: HTTP/1.1 200 OK {"status":"ok","database":"connected"}
   ```

---

### Method 2: Platform as a Service (Railway / Render / Fly.io)

1. **Database**: Provision PostgreSQL on the platform.
2. **Backend**:
   - Point the build to root directory using `Dockerfile.prod`.
   - Set environment variables listed in Section 2.
   - Set release command: `alembic upgrade head`.
   - Health check path: `/health`.
3. **Frontend**:
   - Deploy as a static site or Docker container (`frontend/Dockerfile.prod`).
   - Set `VITE_API_BASE_URL` to the public URL of your backend.

---

## 5. Health Checks & Monitoring

The backend exposes a DB-verifying health check:
- **Endpoint**: `GET /health`
- **Healthy (200 OK)**:
  ```json
  {"status": "ok", "database": "connected"}
  ```
- **Unhealthy (503 Service Unavailable)**:
  ```json
  {"status": "unhealthy", "detail": "Database connection failed"}
  ```

Use `GET /health` as the target for cloud load balancer health probes and container orchestrator liveness checks.

---

## 6. Admin Provisioning Workflow

To provision a new vendor shop:
```bash
curl -X POST https://api.canteen.example.com/api/v1/admin/vendors \
  -H "Content-Type: application/json" \
  -H "X-Admin-Key: <YOUR_ADMIN_API_KEY>" \
  -d '{
    "phone_number": "+919876543210",
    "name": "Main Canteen Vendor",
    "shop_name": "Campus Bites",
    "is_shop_open": true
  }'
```
