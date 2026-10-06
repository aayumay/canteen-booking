import httpx
from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.user import User, UserRole

db = SessionLocal()
vendor = db.query(User).filter(User.role == UserRole.vendor).first()
print(f"vendor: id={vendor.id} name={vendor.name} approved={getattr(vendor,'is_approved',None)}")
db.close()

token = create_access_token(data={"sub": str(vendor.id), "role": vendor.role.value})
h = {"Authorization": f"Bearer {token}"}

base = "http://127.0.0.1:8000/api/v1"
for path in ["/vendor/analytics/demand-by-hour", "/vendor/settlements/summary"]:
    try:
        r = httpx.get(base + path, headers=h, timeout=20)
        print(f"\n{path}\n  status={r.status_code}\n  body={r.text[:300]}")
    except Exception as e:
        print(f"\n{path}\n  EXCEPTION {type(e).__name__}: {e}")
