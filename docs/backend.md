# Backend Documentation

The backend is a **FastAPI (Python)** application that serves as the brain of Personal Learner — handling flashcard ingestion, spaced repetition scheduling, AI-powered content generation, and user progress tracking.

---

## Architecture Overview

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                  # FastAPI app bootstrap, CORS, lifespan
│   ├── api/
│   │   └── routes.py            # All REST API endpoints (295 lines)
│   ├── core/
│   │   ├── config.py            # Pydantic settings from .env
│   │   └── database.py          # Async SQLAlchemy engine + session factory
│   ├── models/
│   │   └── models.py            # ORM models: User, Topic, Flashcard, ReviewLog, TopicProficiency
│   ├── schemas/
│   │   └── schemas.py           # Pydantic request/response schemas
│   └── services/
│       ├── llm_service.py       # Gemini API abstraction layer
│       └── spaced_repetition.py # SM-2 algorithm implementation
├── watcher.py                   # Standalone Obsidian vault monitor
├── .env                         # Environment variables (not committed)
├── .env.example                 # Template for .env
└── requirements.txt             # Python dependencies
```

### Technology Stack

| Component | Technology |
|---|---|
| Web framework | FastAPI 0.115.6 (async) |
| Server | Uvicorn 0.34.0 (ASGI) |
| ORM | SQLAlchemy 2.0.36 (async) |
| Database | Microsoft SQL Server via `aioodbc` + `pyodbc` |
| AI | Google Gemini (`google-genai` SDK) |
| Validation | Pydantic v2 |
| Config | `pydantic-settings` from `.env` |

---

## Application Bootstrap (`app/main.py`)

The FastAPI app is created with a **lifespan context manager** that:

1. On startup: connects to the database and runs `Base.metadata.create_all` (creates any missing tables)
2. On shutdown: disposes of the database engine

**CORS** is configured to allow requests only from `http://localhost:3000` (the Next.js dev server), with all methods and headers permitted.

The single router from `app.api.routes` is included under the root path.

---

## Configuration (`app/core/config.py`)

Uses `pydantic-settings.BaseSettings` to load from `.env`:

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `mssql+aioodbc://sa:...` | MS SQL Server connection string with ODBC Driver 18 |
| `GEMINI_API_KEY` | `""` | Google Gemini API key |
| `APP_ENV` | `"development"` | Sets SQLAlchemy `echo` for query logging |
| `OBSIDIAN_VAULT_PATH` | `""` | Path to local Obsidian vault (used by watcher) |
| `DEFAULT_USER_ID` | `""` | UUID of the default user (used by watcher) |

---

## Database Layer (`app/core/database.py`)

Creates an **async SQLAlchemy engine** using `aioodbc` as the async driver for MS SQL Server:

```python
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.APP_ENV == "development"),
    pool_recycle=3600,    # Recycle connections after 1 hour
    pool_pre_ping=True,   # Verify connections before use
)
```

The `AsyncSessionLocal` factory creates sessions with `expire_on_commit=False`. The `get_db()` dependency yields a session per request and auto-closes it.

---

## ORM Models (`app/models/models.py`)

Five tables with full SQLAlchemy ORM mappings using `Uuid` primary keys with `NEWID()` server defaults.

### User

| Column | Type | Constraints |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK, default `NEWID()` |
| `username` | `VARCHAR(50)` | UNIQUE, NOT NULL |
| `email` | `VARCHAR(255)` | UNIQUE, NOT NULL |
| `created_at` | `DATETIME2` | default `CURRENT_TIMESTAMP` |

**Relationships:** `topics`, `flashcards`, `review_logs`, `proficiencies`

### Topic

| Column | Type | Constraints |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK |
| `user_id` | `UNIQUEIDENTIFIER` | FK → users.id, ON DELETE CASCADE |
| `name` | `VARCHAR(100)` | NOT NULL |
| `obsidian_file_path` | `VARCHAR(255)` | nullable |
| `created_at` | `DATETIME2` | default `CURRENT_TIMESTAMP` |

**Unique constraint:** `(user_id, name)` — prevents duplicate topic names per user.

**Relationships:** `user`, `flashcards`, `proficiencies`

### Flashcard

| Column | Type | Constraints |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK |
| `user_id` | `UNIQUEIDENTIFIER` | FK → users.id |
| `topic_id` | `UNIQUEIDENTIFIER` | FK → topics.id, ON DELETE CASCADE |
| `card_type` | `VARCHAR(20)` | `"standard"`, `"mcq"`, or `"code_mcq"` |
| `difficulty_level` | `INT` | 1 (Beginner) to 5 (Advanced) |
| `front_content` | `Text` (NVARCHAR(MAX)) | The question/code shown on the front |
| `back_content` | `Text` (NVARCHAR(MAX)) | The answer/explanation |
| `extra_data` | `JSON` | Flexible payload for MCQs (language, options, correct_index, explanation) |
| `repetition_count` | `INT` | Number of consecutive correct reviews (SM-2) |
| `interval_days` | `FLOAT` | Current review interval in days (SM-2) |
| `ease_factor` | `FLOAT` | Ease factor, minimum 1.3 (SM-2) |
| `next_review_date` | `DATETIME2` | When this card is next due |
| `created_at` | `DATETIME2` | Creation timestamp |
| `updated_at` | `DATETIME2` | Last update timestamp |

**Index:** `idx_flashcards_next_review` on `(user_id, next_review_date)` for fast due-card queries.

**Relationships:** `user`, `topic`, `review_logs`

**Computed property:** `topic_name` → delegates to `self.topic.name`

### ReviewLog

| Column | Type | Constraints |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK |
| `flashcard_id` | `UNIQUEIDENTIFIER` | FK → flashcards.id, ON DELETE CASCADE |
| `user_id` | `UNIQUEIDENTIFIER` | FK → users.id |
| `grade` | `INT` | 1 (Again) to 4 (Easy) |
| `review_duration_ms` | `INT` | Time spent reviewing (nullable) |
| `reviewed_at` | `DATETIME2` | default `CURRENT_TIMESTAMP` |

This table logs every single answer submission — it powers the progress calendar heatmap and future analytics.

### TopicProficiency

| Column | Type | Constraints |
|---|---|---|
| `id` | `UNIQUEIDENTIFIER` | PK |
| `user_id` | `UNIQUEIDENTIFIER` | FK → users.id |
| `topic_id` | `UNIQUEIDENTIFIER` | FK → topics.id, ON DELETE CASCADE |
| `mastery_score` | `FLOAT` | 0.0 to 100.0 |
| `cards_mastered` | `INT` | Count of cards with `repetition_count >= 4` |
| `needs_remedial_material` | `BIT` | Flag for AI intervention (future use) |
| `ready_for_advanced` | `BIT` | Flag for advanced content (future use) |
| `last_evaluated_at` | `DATETIME2` | Last recalculation timestamp |

**Unique constraint:** `(user_id, topic_id)`

---

## Pydantic Schemas (`app/schemas/schemas.py`)

All request/response validation uses Pydantic v2 with `model_config = {"from_attributes": True}` for ORM compatibility.

### Request Schemas

| Schema | Fields | Used By |
|---|---|---|
| `UserCreate` | `username`, `email` | `POST /api/users` |
| `TopicCreate` | `user_id`, `name`, `obsidian_file_path?` | `POST /api/topics` |
| `SM2ReviewInput` | `grade` (1-4) | `PATCH /api/review/{flashcard_id}` |
| `IngestPayload` | `markdown_text`, `topic_id?`, `topic_name?`, `user_id?` | `POST /api/ingest` |
| `GenerateContentRequest` | `topic_name` | `POST /api/generate-content` |
| `SupplementContentRequest` | `topic_name`, `markdown_text` | `POST /api/supplement-content` |

### Response Schemas

| Schema | Key Fields |
|---|---|
| `UserResponse` | `id`, `username`, `email`, `created_at` |
| `TopicResponse` | `id`, `user_id`, `name`, `obsidian_file_path`, `created_at` |
| `FlashcardResponse` | All flashcard fields including `topic_name` (computed) |
| `FlashcardGenerationResponse` | `flashcards: list[StandardFlashcardSchema \| CodeMCQSchema]` |
| `TopicWithProficiency` | All topic fields + `mastery_score`, `cards_total`, `cards_due` |
| `DueCardsCount` | `count: int` |
| `DailyProgress` | `date: str` (YYYY-MM-DD), `count: int` |

### LLM Structured Output Schemas

- **`StandardFlashcardSchema`**: `card_type="standard"`, `front_content`, `back_content`, `difficulty_level` (1-5)
- **`CodeMCQSchema`**: `card_type="code_mcq"`, `front_content` (code snippet), `back_content`, `difficulty_level`, `extra_data` (with nested `CodeMCQExtraData`: `language`, `options[4]`, `correct_index`, `explanation`)

These schemas are embedded in the Gemini prompt and enforced via `response_mime_type: "application/json"`.

---

## API Endpoints (`app/api/routes.py`)

All endpoints are prefixed with `/api` and served under the root router.

### Health Check

**`GET /api/health`**

Returns `{"status": "ok", "timestamp": "<ISO-8601>"}`. No authentication required. Used to verify the backend is running.

---

### Users

**`POST /api/users`** — Create a new user

- **Request body:** `UserCreate { username, email }`
- **Response:** `201 Created` with `UserResponse`
- **Validation:** Checks uniqueness of both username and email; returns `400` if either exists
- **Status codes:** `201` | `400`

---

### Topics

**`POST /api/topics`** — Create a new learning topic

- **Request body:** `TopicCreate { user_id, name, obsidian_file_path? }`
- **Response:** `201 Created` with `TopicResponse`
- **Validation:** User must exist (`404`); topic name must be unique per user (`400`)

**`GET /api/topics/by-user/{user_id}`** — Get all topics with proficiency

- **Response:** `list[TopicWithProficiency]`
- **Query logic:** LEFT JOINs `TopicProficiency` and `Flashcard` tables. Uses `func.coalesce` for null mastery scores. Groups by topic and computes:
  - `cards_total`: total flashcards in the topic
  - `cards_due`: sum of flashcards where `next_review_date <= now`
  - `mastery_score`: from `TopicProficiency` (0.0 if not yet calculated)
- Results sorted alphabetically by topic name.

---

### Flashcards — Due Retrieval

**`GET /api/flashcards/due/{user_id}`** — Get all due flashcards

- **Query params:** `topic_id` (optional UUID filter)
- **Response:** `list[FlashcardResponse]`
- **Logic:** Selects flashcards where `user_id` matches AND `next_review_date <= now`. Eager-loads the `topic` relationship. If `topic_id` is provided, filters further. Results ordered by `next_review_date` ascending.

**`GET /api/flashcards/due/count/{user_id}`** — Get count of due cards

- **Response:** `DueCardsCount { count: int }`
- Uses `func.count` for efficiency — returns just the number, not the card objects.

---

### Review Submission

**`PATCH /api/review/{flashcard_id}`** — Submit a review grade

- **Request body:** `SM2ReviewInput { grade: 1-4 }`
- **Logic:**
  1. Validates the flashcard exists (`404`)
  2. Validates grade is 1-4 (`400`)
  3. Calls `calculate_sm2()` with current ease, interval, reps, and grade
  4. Updates the flashcard's SM-2 fields and `next_review_date`
  5. Inserts a `ReviewLog` entry
  6. **Recalculates topic proficiency** (see below)
- **Response:** `{"status": "ok", "next_review_date": "<ISO-8601>"}`

#### Topic Proficiency Recalculation

After every review submission, the endpoint recalculates the parent topic's mastery:

1. Queries all flashcards in the topic to get their `repetition_count` values
2. `cards_mastered` = count of cards with `repetition_count >= 4`
3. `mastery_score` = sum of `min(100, reps * 25)` across all cards / total cards
4. Creates or updates the `TopicProficiency` row for that user+topic

---

### Ingestion

**`POST /api/ingest`** — Ingest Markdown and generate flashcards

- **Request body:** `IngestPayload { markdown_text, topic_id?, topic_name?, user_id? }`
- **Topic resolution logic:**
  - If `topic_name` and `user_id` are provided: looks up or creates the topic
  - If `topic_id` is provided: looks up the topic (must exist)
  - If neither: returns `400`
- **Processing:**
  1. Calls `llm.generate_flashcards(markdown_text)` → Gemini 3.5 Flash
  2. Parses the JSON response into `FlashcardGenerationResponse`
  3. Iterates over generated flashcards, creating `Flashcard` ORM instances with:
     - Initial SM-2 values: `repetition_count=0`, `interval_days=0`, `ease_factor=2.5`
     - `next_review_date` = current time (due immediately)
     - `extra_data` serialized from the Pydantic model
  4. Commits all cards to the database
- **Response:** `201 Created` with `FlashcardGenerationResponse` (the generated flashcards)

---

### Content Generation

**`POST /api/generate-content`** — Generate complete study notes for a topic

- **Request body:** `GenerateContentRequest { topic_name }`
- **Response:** `GenerateContentResponse { markdown_text }`
- **Use case:** When a user creates a new Obsidian note with an empty body, the watcher calls this endpoint to auto-generate comprehensive study notes. The LLM produces structured Markdown covering fundamentals, intermediate, and advanced concepts.

**`POST /api/supplement-content`** — Supplement existing notes with missing foundations

- **Request body:** `SupplementContentRequest { topic_name, markdown_text }`
- **Response:** `SupplementContentResponse { markdown_text }`
- **Use case:** When the watcher detects `supplement_on_sync: true` in frontmatter, it calls this to analyze the student's notes and generate supplemental content for missing core concepts. The LLM avoids repeating already-covered material.

---

### Progress Tracking

**`GET /api/users/{user_id}/progress`** — Get daily review counts

- **Response:** `list[DailyProgress]`
- **Query:** Groups `ReviewLog` entries by date (`cast(reviewed_at, Date)`) and counts reviews per day. Used by the dashboard heatmap to show review activity over time.

---

## Spaced Repetition Engine (`app/services/spaced_repetition.py`)

Implements the **SuperMemo-2 (SM-2)** algorithm with two functions:

### `calculate_sm2(ease_factor, interval_days, repetition_count, grade)`

**Algorithm logic:**

| Grade | Meaning | Interval Update | Rep Update |
|---|---|---|---|
| 1 (Again) | Forgotten | Reset to 1 day | Reset to 0 |
| 2 (Hard) | Remembered with difficulty | Reset to 1 day | Reset to 0 |
| 3 (Good) | Remembered normally | 1st: 1 day, 2nd: 6 days, 3rd+: `interval * ease` | +1 |
| 4 (Easy) | Remembered easily | 1st: 1 day, 2nd: 6 days, 3rd+: `interval * ease` | +1 |

**Ease factor formula:**
```
new_ease = ease + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
```
Ease factor is floored at `1.3`.

### `get_next_review_date(interval_days)`

Returns `datetime.now(UTC) + timedelta(days=interval_days)`.

---

## Running the Backend

### Prerequisites

- Python 3.10+
- MS SQL Server (local or Docker — see main README)
- ODBC Driver 18 for SQL Server installed
- Google Gemini API key

### Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate     # Windows
# source venv/bin/activate  # macOS/Linux

pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and GEMINI_API_KEY
```

### Running

```bash
# Start the FastAPI server (dev mode with hot reload)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In a separate terminal, start the Obsidian watcher
python watcher.py
```

### API Documentation

Once running, interactive docs are available at:
- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## How Data Flows Through the Backend

```
Obsidian Note Saved
    │
    ▼
watcher.py detects .md change
    │
    ├─ body is empty? ──► POST /api/generate-content → LLM writes study notes back to file
    │
    ├─ supplement_on_sync: true? ──► POST /api/supplement-content → LLM appends missing concepts
    │
    └─ sync_to_app: true ──► POST /api/ingest
                                  │
                                  ▼
                            Gemini 3.5 Flash
                            generates flashcards
                                  │
                                  ▼
                            Store in flashcards table
                            (SM-2: interval=0, ease=2.5, due immediately)
                                  │
                                  ▼
                            Frontend fetches via
                            GET /api/flashcards/due/{user_id}
                                  │
                                  ▼
                            User studies → grades card
                                  │
                                  ▼
                            PATCH /api/review/{flashcard_id}
                                  │
                                  ├─ SM-2 updates interval/ease factor
                                  ├─ ReviewLog inserted
                                  └─ TopicProficiency recalculated
```
