from uuid import UUID
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from sqlalchemy import func

from app.models.models import User, Topic, Flashcard, TopicProficiency
from app.schemas.schemas import (
    UserCreate, UserResponse,
    TopicCreate, TopicResponse,
    FlashcardResponse,
    IngestPayload, FlashcardGenerationResponse,
    TopicWithProficiency, DueCardsCount,
)
from app.services.llm_service import get_llm_service

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


@router.post("/api/ingest", response_model=FlashcardGenerationResponse, status_code=201, tags=["Ingestion"])
async def ingest_markdown(payload: IngestPayload, db: AsyncSession = Depends(get_db)):
    if payload.topic_name and payload.user_id:
        result = await db.execute(
            select(Topic).where(
                Topic.user_id == payload.user_id,
                Topic.name == payload.topic_name,
            )
        )
        topic = result.scalar_one_or_none()
        if not topic:
            topic = Topic(
                user_id=payload.user_id,
                name=payload.topic_name,
            )
            db.add(topic)
            await db.flush()
    elif payload.topic_id:
        topic = await db.get(Topic, payload.topic_id)
        if not topic:
            raise HTTPException(status_code=404, detail="Topic not found")
    else:
        raise HTTPException(status_code=400, detail="Must provide either topic_id or (topic_name + user_id)")

    llm = get_llm_service()
    generated = await llm.generate_flashcards(payload.markdown_text)

    now = datetime.now(timezone.utc)
    for card_data in generated.flashcards:
        extra = getattr(card_data, "extra_data", None)
        extra = extra.model_dump() if extra else None
        flashcard = Flashcard(
            user_id=topic.user_id,
            topic_id=topic.id,
            card_type=card_data.card_type,
            difficulty_level=card_data.difficulty_level,
            front_content=card_data.front_content,
            back_content=card_data.back_content,
            extra_data=extra,
            repetition_count=0,
            interval_days=0,
            ease_factor=2.5,
            next_review_date=now,
            created_at=now,
            updated_at=now,
        )
        db.add(flashcard)

    await db.commit()
    return generated


@router.get("/api/topics/by-user/{user_id}", response_model=list[TopicWithProficiency], tags=["Topics"])
async def get_topics_by_user(user_id: UUID, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(
            Topic,
            func.coalesce(TopicProficiency.mastery_score, 0.0).label("mastery_score"),
            func.count(Flashcard.id).label("cards_total"),
            func.sum(
                func.iif(Flashcard.next_review_date <= now, 1, 0)
            ).label("cards_due"),
        )
        .outerjoin(TopicProficiency, (TopicProficiency.topic_id == Topic.id) & (TopicProficiency.user_id == user_id))
        .outerjoin(Flashcard, Flashcard.topic_id == Topic.id)
        .where(Topic.user_id == user_id)
        .group_by(Topic.id, TopicProficiency.mastery_score)
        .order_by(Topic.name)
    )

    topics = []
    for row in result.all():
        topic, mastery, total, due = row
        topics.append(TopicWithProficiency(
            id=topic.id,
            user_id=topic.user_id,
            name=topic.name,
            obsidian_file_path=topic.obsidian_file_path,
            created_at=topic.created_at,
            mastery_score=mastery,
            cards_total=total,
            cards_due=due or 0,
        ))
    return topics


@router.get("/api/flashcards/due/count/{user_id}", response_model=DueCardsCount, tags=["Flashcards"])
async def get_due_flashcards_count(user_id: UUID, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(func.count(Flashcard.id))
        .where(Flashcard.user_id == user_id, Flashcard.next_review_date <= now)
    )
    count = result.scalar() or 0
    return DueCardsCount(count=count)
