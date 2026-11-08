# Examora

**Build. Conduct. Verify.**

Examora is a smart college examination platform. Faculty upload existing
question papers and Examora automatically structures them into online
examinations; students take exams through a secure interface while an
intelligent monitoring system flags potentially suspicious activity for
faculty to review. Examora never accuses — it surfaces evidence, and the
final academic decision always belongs to authorized faculty.

This is a working full-stack application, not a mockup:

- **Backend**: Python, FastAPI, SQLAlchemy, JWT auth, a real document-parsing
  pipeline (PDF/DOCX/image + OCR), a rules-based question extraction engine,
  and a transparent weighted risk-scoring engine.
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, TanStack Query,
  Recharts.
- **Proctoring**: runs *in the browser* — real face detection (face-api.js)
  and object/phone detection (TensorFlow.js coco-ssd), plus native
  tab/fullscreen/focus monitoring — so no GPU server is required.
- **Database**: SQLite by default (zero setup) on SQLAlchemy, so switching to
  PostgreSQL for production is a one-line `DATABASE_URL` change with no code
  changes.

---

## 1. Quick start (local, no Docker)

You'll run two processes: the FastAPI backend and the Vite frontend.

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # defaults work out of the box

# Load realistic demo data (faculty + student accounts, a published exam,
# sample proctoring events). Safe to skip if you'd rather start empty.
python -m app.seed

uvicorn app.main:app --reload --port 8000
```

The API is now live at `http://localhost:8000`. Interactive docs are at
`http://localhost:8000/docs`.

### Frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

The app is now live at **`http://localhost:5173`**. In dev mode, Vite
proxies `/api/*` requests straight to the backend on port 8000 — no extra
configuration needed.

### Log in

Open `http://localhost:5173` and either register a new account, or use the
seeded demo credentials (also shown on the login screen):

| Role    | Email                  | Password  |
|---------|------------------------|-----------|
| Faculty | `faculty@examora.app`  | `Demo@123`|
| Student | `student@examora.app`  | `Demo@123`|

The seeded faculty account already has a **live, published exam**
("Database Management Systems — Mid Semester Examination", access code
`DBMS-28A7`) with 30 questions across 3 sections, plus a completed quiz with
sample results and proctoring events — so you can explore Live Monitoring,
Results, and Reports immediately without building anything yourself.

To try the full builder flow from scratch, log in as faculty and choose
**Create Examination → Upload Existing Question Paper**.

---

## 2. Quick start (Docker)

If you'd rather not install Python/Node locally:

```bash
docker compose up --build
docker compose exec backend python -m app.seed   # optional demo data
```

This runs a real PostgreSQL instance, the backend on `:8000`, and the
frontend on `:5173`.

---

## 3. Project structure

```
examora/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers (auth, exams, attempts, proctor, ...)
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # document parsing, question extraction, risk engine,
│   │   │                  # grading, reports, audit, storage
│   │   ├── ai/             # pluggable LLM extraction seam (optional)
│   │   ├── auth/           # JWT + password hashing + RBAC dependencies
│   │   ├── config.py       # all environment-driven settings
│   │   ├── main.py         # FastAPI app entrypoint
│   │   └── seed.py         # demo data
│   ├── tests/               # pytest suite
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── pages/faculty/   # dashboard, exam builder, monitoring, results, reports
│       ├── pages/student/   # dashboard, exam-taking flow, results
│       ├── pages/public/    # landing, login, register
│       ├── proctoring/      # in-browser face/object detection + browser monitors
│       ├── components/      # shared UI (layout, badges, logo)
│       ├── hooks/           # auth context
│       └── lib/             # API client, formatters
└── docker-compose.yml
```

---

## 4. Running tests

```bash
cd backend
source venv/bin/activate
pytest -q
```

Covers authentication/authorization, exam creation and publishing rules,
the question-extraction engine (including "no answer key found → flag for
review" behavior), the full student attempt lifecycle (start → answer →
submit → duplicate-submission rejection), and the risk engine.

---

## 5. Configuration

All configuration lives in environment variables — see
`backend/.env.example`. The important ones:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | SQLite by default; set to a `postgresql://...` URL for production | `sqlite:///./examora.db` |
| `JWT_SECRET` | Signing key for auth tokens — **change this in production** | placeholder |
| `AI_PROVIDER` | `rules` (built-in, no API key) or `llm` (route document understanding through an LLM you wire up in `app/ai/llm_provider.py`) | `rules` |
| `PROCTORING_MODE` | `live` (only real browser-detected events) or `demo` | `live` |
| `CORS_ORIGINS` | Comma-separated list of allowed frontend origins | localhost dev ports |

For the frontend, set `VITE_API_URL` if the backend isn't reachable at
`/api` relative to the frontend (e.g. when frontend and backend are
deployed as separate services — see below).

---

## 6. Deploying

The brief's target stack is **Vercel (frontend) + Render (backend) +
hosted PostgreSQL**:

1. **Database**: provision a managed PostgreSQL instance (Render, Supabase,
   Neon, etc.) and copy its connection string.
2. **Backend on Render**: create a new Web Service pointed at `backend/`,
   set `DATABASE_URL` to your Postgres connection string, set a strong
   `JWT_SECRET`, and set `CORS_ORIGINS` to your deployed frontend's URL.
   Render will build using `backend/Dockerfile` (or run
   `pip install -r requirements.txt` + `uvicorn app.main:app --host 0.0.0.0
   --port $PORT` directly).
3. **Frontend on Vercel**: import `frontend/`, set the build command to
   `npm run build`, output directory `dist`, and set the environment
   variable `VITE_API_URL` to your Render backend's URL.
4. Run `python -m app.seed` once against the production database if you
   want the demo account/exam available there too (optional).

---

## 7. Notes on scope and design decisions

A few pragmatic choices were made to keep this genuinely runnable rather
than a slide-deck architecture:

- **SQLite default, Postgres-ready**: every model uses SQLAlchemy's ORM, so
  there is no code difference between the two — only `DATABASE_URL`
  changes. SQLite means anyone can clone this and run it in under a minute
  with zero external services.
- **In-browser proctoring, not a server-side GPU service**: face detection
  and phone/object detection run client-side via TensorFlow.js models
  loaded from a CDN. This is arguably *more* realistic for a college
  deployment than requiring GPU infrastructure, and it still produces real
  detections, not scripted fakes. The backend risk engine, event
  deduplication, and cooldown logic are all real and independent of
  whether events originate from the browser's CV models or (in `demo`
  mode) a seed script.
- **Rules-based document extraction by default**: a tuned regex/heuristics
  engine reads sections, question numbers, options, marks schemes, and
  answer keys with per-field confidence scoring — no API key required. An
  `AI_PROVIDER=llm` seam exists in `app/ai/llm_provider.py` for teams who
  want to route extraction through an LLM for messier documents; it's left
  as a clean extension point rather than hard-wired to one vendor.
- **Privacy by design**: raw webcam video is never sent to or stored by the
  backend. Only discrete events (type, confidence, duration, timestamp) and
  optional minimal evidence metadata are persisted.
