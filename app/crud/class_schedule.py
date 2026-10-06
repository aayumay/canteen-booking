from datetime import date, datetime, time
from sqlalchemy.orm import Session
from app.models.class_schedule import ClassScheduleEntry
from app.schemas.class_schedule import ClassScheduleCreate, UpcomingBreakOut


def parse_time_str(time_str: str) -> time:
    parts = [int(p) for p in time_str.split(":")]
    return time(hour=parts[0], minute=parts[1])


def create_schedule_entry(
    db: Session, student_id: int, entry_in: ClassScheduleCreate
) -> ClassScheduleEntry:
    st = parse_time_str(entry_in.start_time)
    et = parse_time_str(entry_in.end_time)
    entry = ClassScheduleEntry(
        student_id=student_id,
        day_of_week=entry_in.day_of_week,
        class_name=entry_in.class_name,
        start_time=st,
        end_time=et,
        location=entry_in.location,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


def get_student_schedule(db: Session, student_id: int) -> list[ClassScheduleEntry]:
    return (
        db.query(ClassScheduleEntry)
        .filter(ClassScheduleEntry.student_id == student_id)
        .order_by(ClassScheduleEntry.day_of_week.asc(), ClassScheduleEntry.start_time.asc())
        .all()
    )


def get_schedule_entry_by_id(db: Session, entry_id: int) -> ClassScheduleEntry | None:
    return db.query(ClassScheduleEntry).filter(ClassScheduleEntry.id == entry_id).first()


def delete_schedule_entry(db: Session, entry: ClassScheduleEntry) -> None:
    db.delete(entry)
    db.commit()


def to_time_obj(t) -> time:
    if isinstance(t, time):
        return t
    if isinstance(t, str):
        parts = [int(p) for p in t.split(":")[:2]]
        return time(parts[0], parts[1])
    return t


def compute_upcoming_break(db: Session, student_id: int) -> UpcomingBreakOut:
    all_entries = (
        db.query(ClassScheduleEntry)
        .filter(ClassScheduleEntry.student_id == student_id)
        .all()
    )
    if not all_entries:
        return UpcomingBreakOut(
            has_schedule=False,
            suggestion_message="Add your class timetable to get smart meal reminders between lectures.",
        )

    now = datetime.now()
    today_day = now.weekday()
    current_time = now.time()

    today_classes = [
        e for e in all_entries if e.day_of_week == today_day
    ]
    today_classes.sort(key=lambda x: to_time_obj(x.start_time))

    if not today_classes:
        return UpcomingBreakOut(
            has_schedule=True,
            suggestion_message="No classes scheduled for today! Enjoy your day.",
        )

    # Check if student is currently in a class
    for idx, c in enumerate(today_classes):
        st = to_time_obj(c.start_time)
        et = to_time_obj(c.end_time)
        if st <= current_time < et:
            end_dt = datetime.combine(date.today(), et)
            mins_left = max(1, int((end_dt - now).total_seconds() / 60))
            next_class_name = today_classes[idx + 1].class_name if idx + 1 < len(today_classes) else None
            return UpcomingBreakOut(
                has_schedule=True,
                current_class=c.class_name,
                next_break_time=et.strftime("%H:%M"),
                minutes_until_break=mins_left,
                next_class=next_class_name,
                suggestion_message=f"Break in {mins_left} min ({et.strftime('%H:%M')}). Pre-order now so it's ready at the counter!",
            )

    # Check if there is an upcoming class today
    upcoming = [c for c in today_classes if to_time_obj(c.start_time) > current_time]
    if upcoming:
        first_up = upcoming[0]
        st = to_time_obj(first_up.start_time)
        start_dt = datetime.combine(date.today(), st)
        mins_until = max(1, int((start_dt - now).total_seconds() / 60))
        return UpcomingBreakOut(
            has_schedule=True,
            next_break_time=None,
            minutes_until_break=mins_until,
            next_class=first_up.class_name,
            suggestion_message=f"Free for {mins_until} min before {first_up.class_name} ({st.strftime('%H:%M')}). Grab a quick meal!",
        )

    return UpcomingBreakOut(
        has_schedule=True,
        suggestion_message="All classes completed for today! Time for a refreshing snack.",
    )
