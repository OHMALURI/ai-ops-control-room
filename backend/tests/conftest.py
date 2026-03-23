import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

# We assume that tests will be run from the `backend/` directory so `main` and `database` are top-level module imports.
from main import app
from database import Base, get_db

# Create a test SQLite engine pointing to test.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Create a TestingSessionLocal using sessionmaker bound to the test engine
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def client():
    # 1. Create all tables in test.db using Base.metadata.create_all
    Base.metadata.create_all(bind=engine)
    
    # Helper to override the database session specifically during tests
    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()
            
    # 2. Override the get_db dependency to use TestingSessionLocal instead
    app.dependency_overrides[get_db] = override_get_db
    
    # 3. Yield/Return a TestClient instance wrapped around our application
    yield TestClient(app)
    
    # 4. Drop all tables after the test is done
    Base.metadata.drop_all(bind=engine)
    
    # Clean up overriding dependency
    app.dependency_overrides.clear()
