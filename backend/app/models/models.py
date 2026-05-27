import uuid
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint, Index, Uuid,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.sql import text


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("NEWID()"))
    username = Column(String(50), unique=True, nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    topics = relationship("Topic", back_populates="user", cascade="all, delete-orphan")
    flashcards = relationship("Flashcard", back_populates="user")
    review_logs = relationship("ReviewLog", back_populates="user")
    proficiencies = relationship("TopicProficiency", back_populates="user")


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("NEWID()"))
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    obsidian_file_path = Column(String(255), nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("user_id", "name", name="uq_topics_user_name"),
    )

    user = relationship("User", back_populates="topics")
    flashcards = relationship("Flashcard", back_populates="topic", cascade="all, delete-orphan")
    proficiencies = relationship("TopicProficiency", back_populates="topic")


class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("NEWID()"))
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    topic_id = Column(Uuid(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    card_type = Column(String(20), nullable=False)
    difficulty_level = Column(Integer, default=1)
    front_content = Column(Text, nullable=False)
    back_content = Column(Text, nullable=False)
    extra_data = Column(JSON, nullable=True)

    repetition_count = Column(Integer, default=0)
    interval_days = Column(Float, default=0)
    ease_factor = Column(Float, default=2.5)
    next_review_date = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        Index("idx_flashcards_next_review", "user_id", "next_review_date"),
    )

    user = relationship("User", back_populates="flashcards")
    topic = relationship("Topic", back_populates="flashcards")
    review_logs = relationship("ReviewLog", back_populates="flashcard", cascade="all, delete-orphan")

    @property
    def topic_name(self) -> str:
        return self.topic.name if self.topic else ""


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("NEWID()"))
    flashcard_id = Column(Uuid(as_uuid=True), ForeignKey("flashcards.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)

    grade = Column(Integer, nullable=False)
    review_duration_ms = Column(Integer, nullable=True)
    reviewed_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    flashcard = relationship("Flashcard", back_populates="review_logs")
    user = relationship("User", back_populates="review_logs")


class TopicProficiency(Base):
    __tablename__ = "topic_proficiency"

    id = Column(Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("NEWID()"))
    user_id = Column(Uuid(as_uuid=True), ForeignKey("users.id"), nullable=False)
    topic_id = Column(Uuid(as_uuid=True), ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    mastery_score = Column(Float, default=0.0)
    cards_mastered = Column(Integer, default=0)
    needs_remedial_material = Column(Boolean, default=False)
    ready_for_advanced = Column(Boolean, default=False)
    last_evaluated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))

    __table_args__ = (
        UniqueConstraint("user_id", "topic_id", name="uq_topic_proficiency_user_topic"),
    )

    user = relationship("User", back_populates="proficiencies")
    topic = relationship("Topic", back_populates="proficiencies")
