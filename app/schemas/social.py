from pydantic import BaseModel, ConfigDict


class SocialProfileUpdate(BaseModel):
    name: str | None = None
    hostel_block: str | None = None
    department: str | None = None
    leaderboard_opt_in: bool | None = None


class SocialProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str | None
    phone_number: str
    hostel_block: str | None
    department: str | None
    leaderboard_opt_in: bool


class LeaderboardEntryOut(BaseModel):
    rank: int
    student_id: int
    name: str
    hostel_block: str | None = None
    department: str | None = None
    total_orders: int


class LeaderboardOut(BaseModel):
    entries: list[LeaderboardEntryOut]
    opted_in_count: int
