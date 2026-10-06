from sqlalchemy.orm import Session

from app.models.user import User, UserRole


def get_user_by_id(db: Session, user_id: int) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_phone(db: Session, phone_number: str) -> User | None:
    return db.query(User).filter(User.phone_number == phone_number).first()


def get_vendor_by_phone(db: Session, phone_number: str) -> User | None:
    return (
        db.query(User)
        .filter(User.phone_number == phone_number, User.role == UserRole.vendor)
        .first()
    )


def get_admin_by_phone(db: Session, phone_number: str) -> User | None:
    return (
        db.query(User)
        .filter(User.phone_number == phone_number, User.role == UserRole.admin)
        .first()
    )


def create_student(db: Session, phone_number: str, name: str) -> User:
    user = User(phone_number=phone_number, role=UserRole.student, name=name)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_vendor(
    db: Session,
    phone_number: str,
    name: str,
    shop_name: str,
    is_shop_open: bool = False,
    is_approved: bool = True,
    stall_photo_url: str | None = None,
) -> User:
    user = User(
        phone_number=phone_number,
        role=UserRole.vendor,
        name=name,
        shop_name=shop_name,
        is_shop_open=is_shop_open,
        is_approved=is_approved,
        stall_photo_url=stall_photo_url,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_admin(
    db: Session,
    phone_number: str,
    name: str,
) -> User:
    user = User(
        phone_number=phone_number,
        role=UserRole.admin,
        name=name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

