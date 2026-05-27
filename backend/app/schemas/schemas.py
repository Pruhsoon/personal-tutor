from datetime import datetime
from uuid import UUID
from typing import Literal, Optional
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


# ── LLM Structured Output Schemas ──────────────────────────────────────────

class StandardFlashcardSchema(BaseModel):
    card_type: Literal["standard"] = "standard"
    front_content: str = Field(..., description="The question or prompt on the front of the card")
    back_content: str = Field(..., description="The answer or explanation on the back of the card")
    difficulty_level: int = Field(..., ge=1, le=5, description="Perceived difficulty: 1 (easiest) to 5 (hardest)")


class CodeMCQExtraData(BaseModel):
    language: str = Field(..., description="Programming language of the code snippet (e.g. python, javascript, rust)")
    options: list[str] = Field(..., min_length=2, description="Multiple-choice answer options")
    correct_index: int = Field(..., ge=0, description="Zero-based index of the correct option")
    explanation: str = Field(..., description="Explanation of why the correct answer is right")


class CodeMCQSchema(BaseModel):
    card_type: Literal["code_mcq"] = "code_mcq"
    front_content: str = Field(..., description="The code snippet shown on the front of the card")
    back_content: str = Field(..., description="The correct answer text shown on the back")
    difficulty_level: int = Field(..., ge=1, le=5, description="Perceived difficulty: 1 (easiest) to 5 (hardest)")
    extra_data: CodeMCQExtraData = Field(..., description="Full MCQ metadata: language, options, correct_index, explanation")


class FlashcardGenerationResponse(BaseModel):
    flashcards: list[StandardFlashcardSchema | CodeMCQSchema] = Field(
        ..., description="Mixed list of standard and code-MCQ flashcards"
    )


# ── Ingest Endpoint Schemas ────────────────────────────────────────────────

class IngestPayload(BaseModel):
    markdown_text: str = Field(..., min_length=1, description="Raw Markdown content from Obsidian note")
    topic_id: Optional[UUID] = Field(None, description="Target topic UUID for the generated flashcards")
    topic_name: Optional[str] = Field(None, description="Topic name — looked up or created if not found")
    user_id: Optional[UUID] = Field(None, description="User ID for topic ownership when using topic_name")


# ── Dashboard Schemas ─────────────────────────────────────────────────────

class TopicWithProficiency(BaseModel):
    id: UUID
    user_id: UUID
    name: str
    obsidian_file_path: Optional[str] = None
    created_at: datetime
    mastery_score: float = 0.0
    cards_total: int = 0
    cards_due: int = 0

    model_config = {"from_attributes": True}


class DueCardsCount(BaseModel):
    count: int
