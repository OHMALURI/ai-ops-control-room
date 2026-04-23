# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

AI Operations Control Room — a full-stack platform for managing, monitoring, evaluating, and responding to AI/LLM service incidents and drift. Users register AI services, run evaluations via DeepEval, detect performance drift, and manage incidents/maintenance plans.

## Development Commands

### Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev        # Dev server at http://localhost:5173
npm run build      # Production build
npm run lint       # ESLint check
npm run preview    # Preview built app
```

### Backend (FastAPI + Python)
```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload  # Dev server at http://localhost:8000
pytest tests/ -v           # Run tests
```

### Environment Setup
Copy `backend/.env.example` to `backend/.env` and set:
```
OPENAI_KEY=...        # OpenAI API key for GPT calls
JWT_SECRET=...        # Secret for signing JWTs
PORT=8000
DRIFT_THRESHOLD=75    # Quality score threshold for drift alerts
```

The SQLite database (`backend/app.db`) is auto-created on first run with seed data.

## Architecture Overview

### Full-Stack Structure
```
frontend/src/          React SPA
backend/               FastAPI server
  main.py              App entry point, DB init, scheduler setup
  models.py            SQLAlchemy ORM (9 tables)
  auth.py              JWT auth, password hashing, role checks
  routes/              8 route modules (one per domain)
  services/evaluator.py  DeepEval evaluation engine (~1100 LOC)
```

### Frontend

**Entry**: `src/main.jsx` → `src/App.jsx`

**Routing** (`App.jsx`): All routes behind `ProtectedLayout` except `/login`. Routes: `/` (dashboard), `/registry`, `/operations`, `/maintenance`, `/audit`, `/policy`, `/users`, `/perf-logs`.

**State**: No centralized store. Components manage local state with `useState`, fetch data directly via Axios. JWT token, `effectiveRole`, and `isTempAdmin` are persisted in `localStorage`. `ProtectedLayout` polls `/auth/me` every 30 seconds to detect role changes.

**API client** (`src/api.js`): Axios with automatic JWT bearer token injection. Base URL is hardcoded to `http://localhost:8000/api`. Response interceptor appends `Z` to naive ISO timestamps from the backend.

### Backend

**All routes prefixed with `/api`**. Key route modules:
- `routes/users.py` — auth, user management, temp admin grants
- `routes/services.py` — AI service CRUD
- `routes/evaluations.py` — run evals (SSE streaming), dataset management
- `routes/incidents.py` — incident lifecycle
- `routes/maintenance.py` — maintenance plans and rollback strategies
- `routes/governance.py` — data policies and compliance
- `routes/drift_judge.py` — LLM-as-judge drift detection

**Auth**: JWT (HS256, 24-hour expiry). Three roles: `admin` (full access), `maintainer` (incident/maintenance ops), `user` (read-only). Temp admin grants let any user request elevated access with admin approval and a time limit.

**Database**: SQLite via SQLAlchemy. Tables: `User`, `Service`, `Evaluation`, `Incident`, `Maintenance`, `AuditLog`, `TempAdminGrant`, `DriftJudgeResult`. Cascade deletes from Service to its Evaluations/Incidents. No migration framework — missing columns are added via `ALTER TABLE` on startup.

**Evaluation pipeline**: `services/evaluator.py` runs in two passes — single-turn (5 golden Q&A samples) and multi-turn (2 conversation scenarios). For each sample it (1) queries the service's model and (2) sends the response to an OpenAI judge model (`JUDGE_MODEL`, default `gpt-4o-mini`) which returns JSON scores for accuracy, relevance, factuality, safety, and instruction-following. SSE streams progress back to the frontend. APScheduler reruns all evaluations every 60 minutes in the background.

**Drift detection**: A 30-point drop in any metric vs the previous evaluation, or an overall quality score below 60%, triggers a drift flag. `drift_judge.py` provides a separate on-demand drift analysis using OpenAI, Gemini, or Claude.

### CORS

Backend allows localhost ports `5173`, `5174`, `5175`.

## Key Patterns

- **SSE for long-running ops**: Evaluation runs stream progress via Server-Sent Events (`/evaluations/run-stream/{service_id}`). Frontend uses `EventSource`.
- **Role-gated UI**: NavBar and pages conditionally render based on `effectiveRole` from `localStorage`.
- **Background scheduler**: APScheduler runs `run_all_evaluations()` every 60 minutes; stop flags are tracked per service in memory.
- **No migration framework**: Schema changes are applied via raw `ALTER TABLE` in `main.py` on startup. New columns must be added there.
