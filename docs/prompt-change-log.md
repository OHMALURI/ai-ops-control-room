
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