# AI Operations Control Room
ARTI-409-A | AI Systems & Governance

## Prerequisites
- Python 3.10+
- Node.js 18+

## Backend Setup
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Fill in OPENAI_KEY in .env
uvicorn main:app --reload

## Frontend Setup
cd frontend
npm install
npm run dev

## Open
http://localhost:5173

## Test Users
- admin / admin123
- maintainer / maint123
- viewer / view123

## Run Tests
cd backend
pytest tests/ -v