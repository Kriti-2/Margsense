# ParkSense AI — Production Roadmap

What you have today vs what full production requires.

---

## Current state (hackathon / pilot)

| Layer | Status |
|-------|--------|
| Real Bengaluru violation data | ✅ 298K police records |
| Live WebSocket (30s) | ✅ Dashboard + Analytics |
| Violation replay stream | ✅ Simulates BTP feed |
| Ingest webhook | ✅ `POST /ingest/violation` |
| Traffic speeds | ⚠️ Google/TomTom if API key, else violation-density model |
| Caching | ✅ In-memory singleton |
| Database | ❌ SQLite configured but unused |
| Auth | ❌ Open APIs |
| BTP live feed | ❌ Needs government partnership |

---

## Phase 1 — Production data (4–8 weeks)

### 1. BTP / SCITA integration
- Sign MoU with Bangalore Traffic Police
- Replace replay engine with webhook from SCITA (same schema as hackathon CSV)
- Fields: `latitude`, `longitude`, `violation_type`, `created_datetime`, `police_station`

### 2. PostgreSQL + PostGIS
```
violations          — live + historical
traffic_snapshots   — speed per zone, timestamped
predictions_cache   — Prophet output
audit_logs          — who accessed what
```
- Replace `ViolationDataStore` in-memory CSV with DB queries
- Spatial indexes for corridor buffer queries

### 3. Redis
- Cache KPIs, heatmap tiles, analytics (sub-10ms reads)
- Pub/sub for WebSocket fan-out across multiple API instances

### 4. Live traffic (mandatory for production)
- `GOOGLE_MAPS_API_KEY` or TomTom enterprise contract
- Poll every 5 minutes per corridor
- Store in `traffic_snapshots` for historical analysis

---

## Phase 2 — Production backend (2–4 weeks)

| Change | Status |
|--------|--------|
| **Authentication** | ✅ JWT + API keys for ingest; officer JWT for shift-planner / severity / jobs |
| **Rate limiting** | ✅ slowapi tiers (public / ingest / officer / auth) |
| **Celery workers** | ✅ Prophet forecast + cache warming via `/jobs/*` |
| **Structured logging** | ⏳ JSON logs → Datadog / CloudWatch |
| **Health checks** | ✅ `/health` (+ DB + Redis in Docker smoke test) |
| **Docker + CI/CD** | ✅ `docker-compose.yml` + GitHub Actions |
| **Secrets manager** | ⏳ No API keys in `.env` files (use cloud secrets) |

See [PHASE2.md](PHASE2.md) for setup and curl examples.

---

## Phase 3 — Production frontend (1–2 weeks)

| Change | Why |
|--------|-----|
| **Auth UI** | Officer login, role-based views |
| **Error boundaries** | Graceful degradation if WebSocket drops |
| **CDN deploy** | Vercel / Cloudflare for static assets |
| **Environment config** | `VITE_API_URL` per staging/production |
| **PWA / mobile** | Field officers on patrol |

---

## Phase 4 — Compliance & ops (ongoing)

- **DPDP Act 2023** — hash vehicle numbers, no public PII
- **Data retention policy** — e.g. 90-day violation window
- **SLA** — 99.5% uptime for corridor monitoring
- **On-call** — PagerDuty for emergency corridor BLOCKED status
- **Backup** — daily DB snapshots

---

## Phase 5 — Scale (city-wide)

- Expand beyond 6 zones to full BBMP wards
- Integrate BBMP parking sensors, BMTC ITS
- Mobile app for enforcement officers
- Integration with tow-truck dispatch systems

---

## Environment variables (production)

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
GOOGLE_MAPS_API_KEY=...
JWT_SECRET=...
CORS_ORIGINS=https://parksense.bengaluru.gov.in
LIVE_MODE=true
SENTRY_DSN=...
```

---

## Recommended cloud architecture

```
                    ┌─────────────┐
  BTP SCITA ───────►│ Ingest API  │
  Google Maps ─────►│  (FastAPI)  │◄── WebSocket clients
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
         PostgreSQL     Redis      Celery workers
         + PostGIS      cache       (Prophet, ETL)
```

---

## What to tell judges today

> *"Production architecture is in place: live WebSocket, ingest webhook, real violation data. For city deployment we connect SCITA's live feed and Google traffic API — the pipeline is ready."*

See also: [LIVE.md](LIVE.md)
