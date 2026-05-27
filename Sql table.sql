-- 1. Create a new database for your project (Only run this once!)
-- CREATE DATABASE MyProjectDB;
-- GO

-- 2. Switch to your new database so you aren't working in 'master'
-- USE MyProjectDB;
-- GO

CREATE TABLE users
(
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
);
GO

CREATE TABLE topics
(
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    -- e.g., "Docker", "Micro-frontends"
    obsidian_file_path VARCHAR(255),
    -- Links back to the specific note in your vault
    created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);
GO

CREATE TABLE flashcards
(
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    topic_id UNIQUEIDENTIFIER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

    -- Card Context
    card_type VARCHAR(20) NOT NULL,
    -- 'standard', 'mcq', 'code_mcq'
    difficulty_level INT DEFAULT 1,
    -- 1 (Beginner) to 5 (Advanced)

    -- Content (NVARCHAR(MAX) replaces TEXT)
    front_content NVARCHAR(MAX) NOT NULL,
    back_content NVARCHAR(MAX) NOT NULL,

    -- Flexible payload for MCQs (Stored as text, can be validated as JSON)
    extra_data NVARCHAR(MAX),

    -- Spaced Repetition (SM-2 / FSRS Algorithm Data)
    repetition_count INT DEFAULT 0,
    interval_days FLOAT DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    next_review_date DATETIME2 DEFAULT CURRENT_TIMESTAMP,

    created_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
);
GO

-- Index to quickly find cards due for review today
CREATE INDEX idx_flashcards_next_review ON flashcards(user_id, next_review_date);
GO

-- Logs every single answer to track trends and trigger the AI
CREATE TABLE review_logs
(
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    flashcard_id UNIQUEIDENTIFIER NOT NULL REFERENCES flashcards(id) ON DELETE CASCADE,
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    -- No cascade here to avoid cycle errors

    grade INT NOT NULL,
    -- e.g., 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
    review_duration_ms INT,
    reviewed_at DATETIME2 DEFAULT CURRENT_TIMESTAMP
);
GO

-- Aggregates your overall mastery per topic
CREATE TABLE topic_proficiency
(
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    user_id UNIQUEIDENTIFIER NOT NULL REFERENCES users(id),
    -- No cascade here to avoid cycle errors
    topic_id UNIQUEIDENTIFIER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

    mastery_score FLOAT DEFAULT 0.0,
    -- 0.0 to 100.0
    cards_mastered INT DEFAULT 0,

    -- Agent Flags (BIT replaces BOOLEAN, 0 = FALSE)
    needs_remedial_material BIT DEFAULT 0,
    ready_for_advanced BIT DEFAULT 0,

    last_evaluated_at DATETIME2 DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, topic_id)
);
GO