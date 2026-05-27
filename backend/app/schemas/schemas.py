from datetime import datetime
from uuid import UUID
from typing import Optional
from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str = Field(..., min_length=1, max_length=50)
    email: str = Field(..., max_length=255)


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TopicCreate(BaseModel):
    user_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    obsidian_file_path: Optional[str] = Field(None, max_length=255)


class TopicResponse(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    obsidian_file_path: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FlashcardResponse(BaseModel):
    id: UUID
    user_id: UUID
    topic_id: UUID
    card_type: str
    difficulty_level: int
    front_content: str
    back_content: str
    extra_data: Optional[dict] = None
    repetition_count: int
    interval_days: float
    ease_factor: float
    next_review_date: datetime

    model_config = {"from_attributes": True}


class SM2Input(BaseModel):
    ease_factor: float
    interval_days: float
    repetition_count: int
    grade: int = Field(..., ge=1, le=4, description="1=Again, 2=Hard, 3=Good, 4=Easy")


class SM2Output(BaseModel):
    ease_factor: float
    interval_days: float
    repetition_count: int
    next_review_date: datetime
