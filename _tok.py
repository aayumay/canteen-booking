from app.core.security import create_access_token
from app.db.session import SessionLocal
from app.models.user import User, UserRole
db = SessionLocal()
v = db.query(User).filter(User.role == UserRole.vendor).first()
db.close()
print(create_access_token(data={"sub": str(v.id), "role": v.role.value}))
