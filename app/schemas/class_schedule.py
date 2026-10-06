from pydantic import BaseModel, ConfigDict, Field


class ClassScheduleCreate(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6, description="0=Monday, 6=Sunday")
    class_name: str = Field(..., min_length=1, max_length=100)
    start_time: str = Field(..., description="HH:MM format, e.g. 09:30")
    end_time: str = Field(..., description="HH:MM format, e.g. 11:00")
    location: str | None = Field(default=None, max_length=100)


class ClassScheduleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    student_id: int
    day_of_week: int
    class_name: str
    start_time: str
    end_time: str
    location: str | None = None


class UpcomingBreakOut(BaseModel):
    has_schedule: bool
    current_class: str | None = None
    next_break_time: str | None = None
    minutes_until_break: int | None = None
    next_class: str | None = None
    suggestion_message: str | None = None
