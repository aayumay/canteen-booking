from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.announcement import Announcement
from app.schemas.announcement import AnnouncementOut

router = APIRouter(prefix="/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementOut])
def get_active_announcements(
    db: Annotated[Session, Depends(get_db)],
):
    now = datetime.now(timezone.utc)
    return (
        db.query(Announcement)
        .filter(
            Announcement.is_active.is_(True),
            or_(
                Announcement.expires_at.is_(None),
                Announcement.expires_at > now,
            ),
        )
        .order_by(Announcement.created_at.desc())
        .all()
    )
