from database import SessionLocal
from models import User

db = SessionLocal()
users = db.query(User).all()
for u in users:
    print(f"ID: {u.id} | Username: {u.username} | Role: {u.role}")
db.close()
