from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.models import User, Topic, Flashcard
from app.schemas.schemas import UserCreate, UserResponse, TopicCreate, TopicResponse, FlashcardResponse

router = APIRouter()


@router.get("/api/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@router.post("/api/users", response_model=UserResponse, status_code=201, tags=["Users"])
async def create_user(payload: UserCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(
        select(User).where((User.email == payload.email) | (User.username == payload.username))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username or email already exists")

    user = User(username=payload.username, email=payload.email)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/api/topics", response_model=TopicResponse, status_code=201, tags=["Topics"])
async def create_topic(payload: TopicCreate, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Topic).where(Topic.user_id == payload.user_id, Topic.name == payload.name)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Topic already exists for this user")

    topic = Topic(
        user_id=payload.user_id,
        name=payload.name,
        obsidian_file_path=payload.obsidian_file_path,
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/api/flashcards/due/{user_id}", response_model=list[FlashcardResponse], tags=["Flashcards"])
async def get_due_flashcards(user_id: UUID, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Flashcard)
        .where(Flashcard.user_id == user_id, Flashcard.next_review_date <= now)
        .order_by(Flashcard.next_review_date)
    )
    return result.scalars().all()
