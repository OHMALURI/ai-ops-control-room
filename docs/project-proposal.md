# Project Proposal
ARTI-409-A | AI Systems & Governance | AI Ops Control Room

## Problem Statement
Organizations deploying AI tools (chatbots, assistants, recommendation engines) have no 
single place to monitor health, detect quality issues, document incidents, and prove 
compliance. This tool solves that by providing a centralized AI Operations Control Room.


## Team Roles
- Ohm: Full backend development (FastAPI, database, all routes, OpenAI integration, evaluation harness) + project lead
- Rethiek: Frontend development (React pages, components, Tailwind styling)
- Monu: Testing (writing unit tests and integration tests) + README
- Krisha: Documentation (prompt change log, risk register, eval dataset card, maintenance runbook)

## Architecture
- Frontend: React 18 + Vite running on http://localhost:5173
- Backend: FastAPI (Python) running on http://localhost:8000
- Database: SQLite (app.db) — 6 tables: users, services, evaluations, incidents, maintenance, audit_log
- LLM: OpenAI GPT-4o — called by backend only for test connections, evaluation harness, and incident summaries
- Background Job: APScheduler runs evaluation automatically every 60 minutes

## Data Flow
1. User interacts with React frontend
2. React calls FastAPI backend via HTTP (Axios)
3. FastAPI reads/writes to SQLite database
4. FastAPI calls OpenAI API for LLM features (backend only)
5. Results returned to React and displayed

## Feature Plan

### Module 1 — Service Registry (Week 1) ✅
- Register AI services with name, owner, environment, model name, data sensitivity
- Test Connection button — pings OpenAI, returns latency and pass/fail
- Full CRUD operations (create, read, update, delete)
- API keys stored in backend .env only

### Module 2 — Monitoring Dashboard (Week 2)
- Dashboard showing latency, error rate, quality score per service
- Evaluation harness with 2 categories: formatting check and policy/PII check
- Evaluation results stored with timestamps
- Drift flag when quality score drops below threshold
- APScheduler background job runs every 60 minutes

### Module 3 — Incident Triage (Week 3)
- Create incidents with severity, symptoms, timeline
- Troubleshooting checklist with 5 categories
- LLM-generated incident summary with human approval before saving
- Maintenance planner with update plan template and approval checkbox

### Module 4 — Governance (Week 4)
- RBAC: Admin, Maintainer, Viewer roles enforced on all routes
- Audit log recording all actions with timestamps
- Data handling policy page
- Compliance evidence export as JSON

## Model Connection Plan
- Provider: OpenAI GPT-4o
- Connection: REST API via OpenAI Python SDK
- API key stored in backend/.env as OPENAI_KEY — never in frontend code
- Privacy: Only the backend touches the API key. No user data is sent to OpenAI except synthetic test prompts.

## Risk Register
See docs/risk-register.md for full details.
Top 5 risks: Hallucination, PII Leakage, Model Drift, Service Outage, Bias in Outputs.