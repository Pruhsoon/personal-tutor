# Personal Learner

> An AI-powered spaced-repetition flashcard app with two-way Obsidian sync, built on Gemini 2.5 Flash.

Personal Learner bridges the gap between writing study notes and actually retaining them. Write notes in Obsidian, and the app automatically generates flashcards — including code multiple-choice questions with syntax highlighting. A SuperMemo-2 algorithm schedules reviews for maximum retention, and a GitHub-style heatmap shows your daily progress at a glance.

## Why This Exists

Most study workflows break at the handoff: you write great notes in Obsidian, then never revisit them. Personal Learner is built to close that loop. It watches your vault, turns your Markdown notes into adaptive flashcards using Google's Gemini, and schedules your reviews so knowledge actually sticks. The AI also fills in gaps — if your notes are missing foundational concepts, it writes supplemental content directly back into your vault.

## How It Works

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Obsidian   │────▶│  Python        │────▶│  FastAPI         │
│   Vault      │     │  Watcher       │     │  Backend         │
│  (Markdown)  │◀────│  (watchdog)   │◀────│  (port 8000)     │
└──────────────┘     └────────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  Gemini 2.5     │
                                            │  Flash          │
                                            └────────┬────────┘
                                                     │
                                                     ▼
┌──────────────┐                          ┌─────────────────┐
│   Next.js    │◀─────────────────────────│  MS SQL Server  │
│   Frontend   │     Flashcards,          │  (Docker/local)  │
│  (port 3000) │     Progress, Topics     └─────────────────┘
└──────────────┘
```

## Screenshots

<img width="1384" height="904" alt="Landing page" src="https://github.com/user-attachments/assets/2679d531-5cae-4154-ad12-2833eb8a58ba" />
<img width="706" height="535" alt="Flashcard review" src="https://github.com/user-attachments/assets/d542b4f1-0e7d-408b-82b7-448aaa9d57f7" />
<img width="751" height="516" alt="Code MCQ" src="https://github.com/user-attachments/assets/fdd89e90-3174-4cfd-b5a2-9f6f94d58455" />
<img width="959" height="1030" alt="Obsidian integration" src="https://github.com/user-attachments/assets/b35b5c7f-3c50-449c-a088-92e6e68a9628" />

## Documentation

| Document | Covers |
|---|---|
| **[Setup Guide](docs/setup.md)** | Prerequisites, database setup, backend/frontend/ watcher configuration, environment variables, troubleshooting |
| **[Backend Architecture](docs/backend.md)** | API endpoints, request/response schemas, SM-2 algorithm, database layer, data flow |
| **[Frontend Architecture](docs/frontend.md)** | Pages, components, design system, API client, navigation flow |
| **[Database Schema](docs/database.md)** | Tables, columns, relationships, query patterns, mastery score calculation, card lifecycle |
| **[Obsidian Bridge](docs/obsidian-bridge.md)** | Watcher internals, frontmatter fields, auto-generation, supplement flow, file write-back |
| **[AI Pipeline](docs/ai-pipeline.md)** | Gemini integration, prompts, abstraction layer, Pydantic validation, async architecture |
