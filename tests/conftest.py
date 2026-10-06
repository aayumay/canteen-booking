import os
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

TEST_DB_PATH = "test_canteen.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{TEST_DB_PATH}"

# Set test environment variables before imports
os.environ["DATABASE_URL"] = SQLALCHEMY_DATABASE_URL
os.environ["JWT_SECRET_KEY"] = "test-jwt-secret-key-1234567890"
os.environ["TWILIO_ACCOUNT_SID"] = "ACtest"
os.environ["TWILIO_AUTH_TOKEN"] = "authtoken"
os.environ["TWILIO_FROM_NUMBER"] = "+1234567890"
os.environ["ADMIN_API_KEY"] = "test-admin-key-secret"
os.environ["DEFAULT_RATE_LIMIT"] = "1000/minute"

import app.db.session as app_db_session
import app.main as app_main
from app.core.config import get_settings
from app.core.deps import get_db
from app.core.security import create_access_token, create_refresh_token
from app.crud.order_status_transition import seed_transitions
from app.main import app
from app.models import Base, MenuItem, Order, OrderItem, User
from app.models.user import UserRole

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Patch app session and engine
app_db_session.engine = engine
app_db_session.SessionLocal = TestingSessionLocal
app_main.SessionLocal = TestingSessionLocal


@pytest.fixture(scope="session", autouse=True)
def setup_db():
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    seed_transitions(db)
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)
    if os.path.exists(TEST_DB_PATH):
        try:
            os.remove(TEST_DB_PATH)
        except OSError:
            pass


@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)
    
    # Ensure transitions are present
    seed_transitions(session)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def student_user(db) -> User:
    user = User(
        phone_number="+919876543210",
        role=UserRole.student,
        name="Test Student",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def vendor_user(db) -> User:
    user = User(
        phone_number="+919876543211",
        role=UserRole.vendor,
        name="Test Vendor 1",
        shop_name="Snack Corner",
        is_shop_open=True,
        is_approved=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def vendor_user_2(db) -> User:
    user = User(
        phone_number="+919876543212",
        role=UserRole.vendor,
        name="Test Vendor 2",
        shop_name="Juice Bar",
        is_shop_open=True,
        is_approved=True,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def student_auth_headers(student_user: User) -> dict:
    token = create_access_token(data={"sub": str(student_user.id), "role": student_user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def vendor_auth_headers(vendor_user: User) -> dict:
    token = create_access_token(data={"sub": str(vendor_user.id), "role": vendor_user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def vendor_2_auth_headers(vendor_user_2: User) -> dict:
    token = create_access_token(data={"sub": str(vendor_user_2.id), "role": vendor_user_2.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_user(db) -> User:
    user = User(
        phone_number="+919876543999",
        role=UserRole.admin,
        name="Test Admin",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture
def admin_auth_headers(admin_user: User) -> dict:
    token = create_access_token(data={"sub": str(admin_user.id), "role": admin_user.role.value})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def admin_headers() -> dict:
    settings = get_settings()
    return {"X-Admin-Key": settings.admin_api_key}


@pytest.fixture
def menu_item(db, vendor_user: User) -> MenuItem:
    item = MenuItem(
        vendor_id=vendor_user.id,
        name="Veg Burger",
        description="Delicious veg burger",
        price=50.00,
        category="Snacks",
        is_available=True,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item
