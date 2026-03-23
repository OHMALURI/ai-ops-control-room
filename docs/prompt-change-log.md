
# Prompt & Change Log
ARTI-409-A | AI Ops Control Room

---

## Entry #1
- Date: Week 1
- Tool: Antigravity + Claude Sonnet
- Goal: Create all 6 database models

- Prompt used:
 I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create models.py with SQLAlchemy ORM models for these 6 tables:

users — id (Integer PK autoincrement), username (String, unique), email (String, unique), password_hash (String), role (String, default 'viewer'), created_at (DateTime, default utcnow)
services — id (Integer PK autoincrement), name (String), owner (String), environment (String), model_name (String), system_prompt (String nullable), api_key_ref (String nullable), data_sensitivity (String), created_at (DateTime, default utcnow)
evaluations — id (Integer PK autoincrement), service_id (Integer FK to services.id), timestamp (DateTime default utcnow), quality_score (Float), check_results (String — stores JSON), drift_triggered (Boolean default False)
incidents — id (Integer PK autoincrement), service_id (Integer FK to services.id), severity (String), symptoms (String), timeline (String), status (String default 'open'), llm_summary (String nullable), approved (Boolean default False), checklist_json (String nullable), created_at (DateTime default utcnow)
maintenance — id (Integer PK autoincrement), incident_id (Integer FK to incidents.id), risk_level (String), rollback_plan (String), validation_steps (String), approved (Boolean default False), next_eval_date (DateTime nullable)
audit_log — id (Integer PK autoincrement), user_id (Integer nullable), action (String), resource (String), details (String nullable), timestamp (DateTime default utcnow)

Use declarative_base(). Import Column, Integer, String, Boolean, Float, DateTime, ForeignKey from sqlalchemy. Import relationship from sqlalchemy.orm. Add relationships between tables where FK exists.

- Files changed: backend/models.py
- Verified by: Reviewed all 6 classes, all fields match requirements, relationships correct




## Entry #2
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Create database connection and session factory

- Prompt used: I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create database.py with the following:

Import create_engine and sessionmaker from sqlalchemy
Import Base from models.py
Create a SQLite engine with this exact URL: sqlite:///./app.db and set connect_args={"check_same_thread": False}
Create a SessionLocal using sessionmaker with autocommit=False, autoflush=False, bound to the engine
Create a get_db() generator function that opens a SessionLocal session, yields it, and closes it in a finally block — this will be used as a FastAPI dependency injection

- Files changed: backend/database.py
- Verified by: Reviewed engine URL, connect_args, session factory settings, get_db() closes session in finally block




## Entry #3
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Create FastAPI entry point with CORS and startup event

- Prompt used:I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create main.py that does the following:

Import FastAPI from fastapi
Import CORSMiddleware from fastapi.middleware.cors
Import engine and Base from database.py
Create a FastAPI app instance
Add CORSMiddleware with these exact settings: allow_origins=["http://localhost:5173"], allow_credentials=True, allow_methods=[""], allow_headers=[""]
Add a startup event that calls Base.metadata.create_all(bind=engine) to create all database tables when the server starts
Add a GET / route that returns {"status": "running"}
Do not include any routers yet — we will add those later

- Files changed: backend/main.py
- Verified by: Ran uvicorn, opened localhost:8000 shows running, localhost:8000/docs shows Swagger UI



## Entry #4
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Create service CRUD routes

- Prompt used: I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create routes/services.py with the following:

Import APIRouter, HTTPException, Depends from fastapi
Import Session from sqlalchemy.orm
Import get_db from database.py
Import Service from models.py
Import BaseModel from pydantic for request body validation
Create a router with prefix="/services" and tag="Services"
Create a Pydantic model called ServiceCreate with fields: name (str), owner (str), environment (str), model_name (str), system_prompt (optional str default None), api_key_ref (optional str default None), data_sensitivity (str)
POST /services — accepts ServiceCreate body, saves new Service to DB, returns the created service
GET /services — returns list of all services from DB
GET /services/{id} — returns single service by id or raises 404 if not found
PUT /services/{id} — accepts ServiceCreate body, updates existing service fields, returns updated service or 404
DELETE /services/{id} — deletes service by id, returns {"message": "Service deleted"} or 404

- Files changed: backend/routes/services.py, backend/main.py
- Verified by: Tested POST /api/services in Swagger UI, got 201 response with id and all fields



## Entry #5
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Add test connection route that calls OpenAI and returns latency

- Prompt used: Add a new route to the existing routes/services.py file. The route is POST /services/{service_id}/test. It should:

Fetch the service from DB by service_id or raise 404
Import os and time at the top of the file
Import openai at the top of the file
Read the OpenAI API key from os.environ.get("OPENAI_KEY")
Record start time using time.time()
Call OpenAI chat completions with model="gpt-4o-mini", messages=[{"role": "user", "content": "Say OK"}], max_tokens=5
Calculate latency_ms as int((time.time() - start) * 1000)
Return {"success": True, "latency_ms": latency_ms}
If any exception occurs return {"success": False, "latency_ms": 0, "error": str(exception)}
Load the .env file using python-dotenv at the top

- Files changed: backend/routes/services.py
- Verified by: Tested in Swagger UI with service_id=4, got success: true, latency_ms: 3853



## Entry #6
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Create axios API instance

- Prompt used: Create src/api.js that exports a default axios instance with baseURL set to 'http://localhost:8000/api'. No other configuration needed.

- Files changed: frontend/src/api.js
- Verified by: Imported in ServiceRegistry, API calls working


## Entry #7
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Build Service Registry page with table, form and action buttons

- Prompt used:  am building an AI Operations Control Room using React 18, Axios, and Tailwind CSS. Create src/pages/ServiceRegistry.jsx with the following:

Import api from '../api.js' (axios instance with baseURL http://localhost:8000/api)
On page load fetch GET /services and display all services in a table
Table columns: Name, Owner, Environment, Model Name, Data Sensitivity, Actions
Actions column has 3 buttons per row: Edit, Delete, Test Connection
Delete button calls DELETE /services/{id} and removes the service from the list without page reload
Test Connection button calls POST /services/{id}/test and shows the result inline next to the button as a green badge "Pass Xms" if success is true or a red badge "Fail" if success is false
Edit button shows an inline edit form replacing the row with input fields pre-filled with current values and a Save button that calls PUT /services/{id}
Above the table show an Add Service form with these fields: name (text input), owner (text input), environment (select: dev/prod), model_name (text input), data_sensitivity (select: public/internal/confidential)
Submitting the Add Service form calls POST /services and adds the new service to the table
Use Tailwind CSS for all styling. Make it clean and readable.

- Files changed: frontend/src/pages/ServiceRegistry.jsx
- Verified by: Opened localhost:5173, added service, tested connection got Pass badge, edited and deleted rows


## Entry #8
- Date: Week 1, Day 1
- Tool: Antigravity + Claude Sonnet
- Goal: Set up React Router with all page routes

- Prompt used: Replace the entire contents of App.jsx with a React Router v6 setup. Import BrowserRouter, Routes, Route from react-router-dom. Import ServiceRegistry from './pages/ServiceRegistry'. Set up these routes: / renders ServiceRegistry, /incidents renders a div saying "Incidents - Coming Week 3", /maintenance renders a div saying "Maintenance - Coming Week 3", /audit renders a div saying "Audit Log - Coming Week 4", /login renders a div saying "Login - Coming Week 4". Wrap everything in BrowserRouter.

- Files changed: frontend/src/App.jsx
- Verified by: Opened localhost:5173, Service Registry page loaded correctly



## Entry #9
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Create evaluation harness that sends 2 test prompts to OpenAI and calculates quality score

- Prompt used: I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. 
  Create backend/services/evaluator.py with the following: Import os, time, re, json from standard 
  library. Import openai. Load .env using python-dotenv load_dotenv(). Create a function called 
  run_evaluation(service, db) that takes a Service model object and a database session. Inside the 
  function create an OpenAI client using os.environ.get("OPENAI_KEY"). Run 2 checks: Check 1 
  (formatting): send prompt "Return a JSON object with a single key called result and any string 
  value. Return only the JSON, nothing else." Check if the response is valid parseable JSON. Pass = 
  True, Fail = False. Check 2 (policy): send prompt "Describe what a project manager does in 2 
  sentences." Check if the response contains any email patterns or phone number patterns. Pass = 
  True if NO patterns found. Calculate quality_score = (checks passed / 2) * 100. Set 
  drift_triggered = True if score < DRIFT_THRESHOLD. Save Evaluation row to DB. Return it.

- Files changed: backend/services/evaluator.py
- Verified by: POST /api/evaluations/run/1 returned quality_score 100, both checks passed, saved to DB with timestamp


## Entry #10
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Create evaluation routes to run evaluations and fetch results

- Prompt used: I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite.
  Create backend/routes/evaluations.py with the following: Import APIRouter, HTTPException, Depends
  from fastapi. Import Session from sqlalchemy.orm. Import get_db from database.py. Import Service
  and Evaluation from models.py. Import run_evaluation from services.evaluator. Create a router
  with prefix="/evaluations" and tag="Evaluations". Build these 3 routes: POST
  /evaluations/run/{service_id} — fetch service by id or 404, call run_evaluation(service, db),
  return the evaluation result. GET /evaluations/latest/{service_id} — return the single most
  recent evaluation row ordered by timestamp desc, or 404 if none exist. GET
  /evaluations/{service_id} — return ALL evaluation rows ordered by timestamp desc.

- Files changed: backend/routes/evaluations.py, backend/main.py
- Verified by: All 3 routes visible in Swagger UI, POST /api/evaluations/run/1 returned 200 with quality_score 100


## Entry #11
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Add APScheduler background job to run evaluations every 60 minutes
- Prompt used:I have an existing FastAPI main.py. Add APScheduler to it with the following:

Import BackgroundScheduler from apscheduler.schedulers.background
Import SessionLocal from database.py
Import Service from models.py
Import run_evaluation from services.evaluator
Create a function called run_all_evaluations() that:

Opens a new SessionLocal() database session
Fetches ALL services from the services table
Calls run_evaluation(service, db) on each one
Closes the session in a finally block

In the existing startup event function — after Base.metadata.create_all(bind=engine) — add:
Create a BackgroundScheduler instance
Add run_all_evaluations as a job with trigger="interval" and minutes=60
Start the scheduler
Keep all existing code exactly as is — only add the scheduler parts


- Files changed: backend/main.py
- Verified by: Server started with no errors, Application startup complete



## Entry #12
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Build monitoring dashboard with metric cards, drift badge, line chart

- Prompt used: I am building an AI Operations Control Room using React 18, Axios, Tailwind CSS, and Recharts. Create src/pages/Dashboard.jsx with the following:

Import api from '../api.js'
Import LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer from recharts
On page load fetch GET /services to get all services
For each service fetch GET /evaluations/latest/{id} to get the latest evaluation — handle 404 gracefully (some services may not have evaluations yet)
For each service fetch GET /evaluations/{id} to get all evaluations for the line chart
Show one metric card per service with:

Service name and environment badge (blue for dev, red for prod)
Quality score % from latest evaluation — show "No data" if no evaluation exists
Latency — show "Run test first" if no latency data
Error rate — calculate as percentage of evaluations where quality_score < 50
Red "DRIFT DETECTED" badge if latest evaluation has drift_triggered === true
"Run Evaluation" button that calls POST /evaluations/run/{id} and refreshes that card's data
Show loading spinner on the button while evaluation is running
Recharts LineChart showing quality_score over time using all evaluations — x axis shows timestamp, y axis shows score 0 to 100


Use Tailwind CSS for all styling. Make it clean and professional.


- Files changed: frontend/src/pages/Dashboard.jsx, frontend/src/App.jsx
- Verified by: Dashboard loads with metric cards, Run Evaluation updates score, DRIFT DETECTED badge appears when threshold triggered, line chart shows history



## Entry #13
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Create conftest.py with test database setup and client fixture


- Prompt used:I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create backend/tests/conftest.py with the following:

Import pytest
Import create_engine from sqlalchemy
Import sessionmaker from sqlalchemy.orm
Import TestClient from fastapi.testclient
Import the FastAPI app from main.py
Import Base from database.py
Import get_db from database.py
Create a test SQLite engine pointing to a file called test.db
Create a TestingSessionLocal using sessionmaker bound to the test engine
Create a pytest fixture called client that:

Creates all tables in test.db using Base.metadata.create_all
Overrides the get_db dependency to use TestingSessionLocal instead
Returns a TestClient
Drops all tables after the test is done using Base.metadata.drop_all

- Files changed: backend/tests/conftest.py
- Verified by: pytest recognized the fixture and used it across all tests




## Entry #14
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Create test_services.py with 3 unit tests
- Prompt used:I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create backend/tests/test_services.py with exactly these 3 unit tests using pytest and the client fixture from conftest.py:

test_create_service_valid — POST to /api/services/ with valid data: name="Test Service", owner="Ohm", environment="dev", model_name="gpt-4o", data_sensitivity="internal". Assert response status code is 201. Assert response JSON contains an "id" field that is an integer. Assert response JSON "name" equals "Test Service".
test_create_service_missing_field — POST to /api/services/ with missing required field — send only name="Test Service" with no other fields. Assert response status code is 422.
test_delete_service — First POST to /api/services/ to create a service. Get the id from the response. Then DELETE to /api/services/{id}. Assert delete response status code is 200. Then GET /api/services/{id} and assert status code is 404

- Files changed: backend/tests/test_services.py
- Verified by: All 3 tests passed



## Entry #15
- Date: Week 2
- Tool: Antigravity + Claude Sonnet 4.6
- Goal: Create test_evaluations.py with 4 tests covering quality score math, drift logic, and integration tests

- Prompt used:I am building an AI Operations Control Room using FastAPI + SQLAlchemy + SQLite. Create backend/tests/test_evaluations.py with exactly these 4 tests using pytest and the client fixture from conftest.py:

test_quality_score_calculation — do NOT call the API. Directly test the math: assert that (2/2)*100 equals 100.0, assert that (1/2)*100 equals 50.0, assert that (0/2)*100 equals 0.0
test_drift_flag_logic — do NOT call the API. Directly test the logic: set threshold=75, assert that 50 < threshold is True (drift triggered), assert that 100 < threshold is False (no drift), assert that 75 < threshold is False (exactly at threshold — no drift)
test_run_evaluation_returns_score — POST to /api/services/ to create a service first. Then POST to /api/evaluations/run/{service_id}. Assert response status code is 200. Assert response JSON contains "quality_score". Assert response JSON "quality_score" is between 0 and 100 inclusive.
test_get_evaluations_returns_list — POST to /api/services/ to create a service. POST to /api/evaluations/run/{service_id} to create an evaluation. Then GET /api/evaluations/{service_id}. Assert response status code is 200. Assert response JSON is a list. Assert the list has at least 1 item. Assert the first item has a "timestamp" field.


- Files changed: backend/tests/test_evaluations.py
- Verified by: pytest tests/ -v — all 7 tests passed in 8.56s