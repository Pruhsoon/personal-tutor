# Personal Learner

> An AI-powered spaced-repetition flashcard app with two-way Obsidian sync, built on Gemini 3.5 Flash.

Personal Learner turns your Obsidian study notes into an adaptive flashcard review system. Write notes in Markdown, and the AI automatically generates high-quality flashcards — including code multiple-choice questions with syntax highlighting. A SuperMemo-2 spaced repetition algorithm schedules reviews for maximum retention, and a GitHub-style heatmap tracks your daily progress.

---

## Screenshots

<img width="1384" height="904" alt="image" src="https://github.com/user-attachments/assets/2679d531-5cae-4154-ad12-2833eb8a58ba" />
<img width="706" height="535" alt="image" src="https://github.com/user-attachments/assets/d542b4f1-0e7d-408b-82b7-448aaa9d57f7" />

<!-- Add screenshots here -->

### Dashboard

<!-- ![Dashboard](screenshots/dashboard.png) -->
*Screenshot placeholder — add a screenshot of the dashboard showing the hero section, calendar heatmap, and topic grid.*

### Flashcard Review (Standard)

<!-- ![Review - Standard](screenshots/review-standard.png) -->
*Screenshot placeholder — add a screenshot of the review page showing a standard Q&A flashcard with the "Show Answer" button.*

### Flashcard Review (Code MCQ)

<!-- ![Review - Code MCQ](screenshots/review-code-mcq.png) -->
*Screenshot placeholder — add a screenshot of a code MCQ flashcard with syntax highlighting and multiple-choice options.*

### Completion Screen

<!-- ![All Caught Up](screenshots/completion.png) -->
*Screenshot placeholder — add a screenshot of the "You're all caught up for today!" completion screen.*

### Obsidian Note with Frontmatter

<!-- ![Obsidian Note](screenshots/obsidian-note.png) -->
*Screenshot placeholder — add a screenshot of an Obsidian note showing the YAML frontmatter with `sync_to_app: true`.*

---

## How It Works

```
┌──────────────┐     ┌────────────────┐     ┌─────────────────┐
│   Obsidian   │────▶│  Python        │────▶│  FastAPI        │
│   Vault      │     │  Watcher       │     │  Backend        │
│  (Markdown)  │◀────│  (watchdog)   │◀────│  (port 8000)    │
└──────────────┘     └────────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │  Gemini 3.5     │
                                            │  Flash          │
                                            └────────┬────────┘
                                                     │
                                                     ▼
┌──────────────┐                          ┌─────────────────┐
│   Next.js    │◀─────────────────────────│  MS SQL Server  │
│   Frontend   │     Flashcards,          │  (Docker/local) │
│  (port 3000) │     Progress, Topics     └─────────────────┘
└──────────────┘
```

1. **Write notes in Obsidian** with YAML frontmatter (`sync_to_app: true`)
2. **Watcher detects changes** and sends the Markdown to the backend
3. **Gemini 3.5 Flash** generates standard Q&A cards + code MCQ cards from your notes
4. **Cards appear in the dashboard** — study them with the SM-2 spaced repetition engine
5. **Progress is tracked** with a GitHub-style heatmap and per-topic mastery scores
6. **The loop closes** — AI can write supplemental content back into your Obsidian vault

---

## Table of Contents

- [Quick Start](#quick-start)
- [Prerequisites](#prerequisites)
- [Setting Up MS SQL Server](#setting-up-ms-sql-server)
  - [Option 1: Docker (Recommended)](#option-1-docker-recommended)
  - [Option 2: Local SQL Server](#option-2-local-sql-server)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [Obsidian Watcher Setup](#obsidian-watcher-setup)
- [Using the App](#using-the-app)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Tech Stack](#tech-stack)
- [Environment Variables](#environment-variables)

---

## Quick Start

If you already have SQL Server running and all prerequisites installed:

```bash
# 1. Database
# Run table_schema.sql against your SQL Server instance
sqlcmd -S localhost -U sa -P YourPassword123 -i table_schema.sql

# 2. Backend
cd backend
cp .env.example .env
# Edit .env with your DATABASE_URL and GEMINI_API_KEY
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 3. Frontend (in a new terminal)
cd frontend
npm install
npm run dev

# 4. Watcher (in a new terminal — optional)
cd backend
# Add OBSIDIAN_VAULT_PATH and DEFAULT_USER_ID to .env
python watcher.py
```

Open **http://localhost:3000** to see the dashboard.

---

## Prerequisites

### Required Software

| Software | Version | Why |
|---|---|---|
| **Python** | 3.10+ | Backend (FastAPI) and watcher |
| **Node.js** | 18+ | Frontend (Next.js) |
| **npm** | 9+ | Package management |
| **ODBC Driver 18 for SQL Server** | 18.x | Database connectivity from Python |
| **Docker Desktop** | Latest | Run MS SQL Server in a container (Option 1) |
| **Google Gemini API Key** | — | AI flashcard and content generation |

### Getting a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" in the left sidebar
4. Create a new API key
5. Copy it for the `.env` configuration

---

## Setting Up MS SQL Server

Choose one of the two options below.

### Option 1: Docker (Recommended)

Docker is the easiest way to run SQL Server on any platform without installing it natively.

#### Step 1: Install Docker Desktop

- **Windows/macOS:** Download from [docker.com](https://www.docker.com/products/docker-desktop/)
- **Linux:** Follow the [Docker Engine install guide](https://docs.docker.com/engine/install/)

Verify installation:
```bash
docker --version
# Docker version 27.x.x or later
```

#### Step 2: Pull and Run SQL Server

```bash
# Pull the SQL Server 2022 image
docker pull mcr.microsoft.com/mssql/server:2022-latest

# Run the container
docker run -d \
  --name personal-learner-db \
  -e "ACCEPT_EULA=Y" \
  -e "MSSQL_SA_PASSWORD=YourPassword123" \
  -p 1433:1433 \
  mcr.microsoft.com/mssql/server:2022-latest
```

**Important:** The SA password must meet SQL Server's complexity requirements:
- At least 8 characters
- Contains uppercase, lowercase, digits, AND special characters
- Use a strong password and update it in your `.env`

#### Step 3: Verify the Container is Running

```bash
docker ps
# Should show personal-learner-db with status "Up"
```

#### Step 4: Create the Database

```bash
# Connect to SQL Server
docker exec -it personal-learner-db /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P YourPassword123 -C -N

# Inside sqlcmd, run:
CREATE DATABASE personal_learner;
GO
USE personal_learner;
GO

# Exit sqlcmd
QUIT
```

#### Step 5: Run the Table Schema

```bash
docker exec -i personal-learner-db /opt/mssql-tools18/bin/sqlcmd \
  -S localhost -U sa -P YourPassword123 -C -N < table_schema.sql
```

#### Docker Commands Reference

```bash
# Stop the container
docker stop personal-learner-db

# Start it again
docker start personal-learner-db

# View logs
docker logs personal-learner-db

# Remove container and data (WARNING: deletes all data)
docker rm -f personal-learner-db
```

### Option 2: Local SQL Server

#### Windows

1. Download **SQL Server 2022 Developer Edition** from [Microsoft](https://www.microsoft.com/en-us/sql-server/sql-server-downloads) (free for development)
2. During installation:
   - Choose "Mixed Mode" authentication
   - Set the SA password (remember this)
   - Install **SQL Server Management Studio (SSMS)** when prompted
3. Open SSMS, connect to `localhost` with SA credentials
4. Create a new database named `personal_learner`
5. Open `table_schema.sql` in SSMS and execute it against the `personal_learner` database

#### macOS

SQL Server doesn't run natively on macOS. Use **Docker (Option 1)** or run a cloud instance.

#### Linux

SQL Server is available for Ubuntu, RHEL, and SUSE. See [Microsoft's Linux install guide](https://learn.microsoft.com/en-us/sql/linux/quickstart-install-connect-ubuntu).

### Install ODBC Driver 18

The Python backend needs the ODBC driver to connect to SQL Server.

#### Windows

The driver is typically included with SQL Server installation. If not:

1. Download from [Microsoft ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
2. Run the installer

#### macOS (using Homebrew)

```bash
brew tap microsoft/mssql-release https://github.com/Microsoft/homebrew-mssql-release
brew update
brew install msodbcsql18 mssql-tools18
```

#### Ubuntu/Debian

```bash
curl https://packages.microsoft.com/keys/microsoft.asc | sudo apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list | sudo tee /etc/apt/sources.list.d/mssql-release.list
sudo apt-get update
sudo ACCEPT_EULA=Y apt-get install -y msodbcsql18 mssql-tools18
```

---

## Backend Setup

### Step 1: Set Up Python Environment

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate it
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `backend/.env` with your values:

```env
DATABASE_URL=mssql+aioodbc://sa:YourPassword123@localhost:1433/personal_learner?driver=ODBC+Driver+18+for+SQL+Server&TrustServerCertificate=yes
GEMINI_API_KEY=your-gemini-api-key-here
APP_ENV=development
OBSIDIAN_VAULT_PATH=C:\Users\YourName\Documents\ObsidianVault
DEFAULT_USER_ID=c2b27bf8-40d5-4015-9023-7aea7c615495
```

**DATABASE_URL breakdown:**
```
mssql+aioodbc://sa:YourPassword123@localhost:1433/personal_learner
│             │  │              │          │    │
│             │  username       password   host port database
│             │
│             async ODBC driver
│
SQLAlchemy MS SQL dialect
```

### Step 3: Run the Server

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify it's running:
```bash
curl http://localhost:8000/api/health
# {"status":"ok","timestamp":"2026-05-27T..."}
```

Interactive API docs:
- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)

---

## Frontend Setup

### Step 1: Install Dependencies

```bash
cd frontend
npm install
```

### Step 2: Configure Environment

The `.env.local` should already exist with these values:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_DEFAULT_USER_ID=c2b27bf8-40d5-4015-9023-7aea7c615495
```

The `DEFAULT_USER_ID` must match the UUID seeded in `table_schema.sql`. If you changed it, update both files.

### Step 3: Run the Dev Server

```bash
npm run dev
```

Open **http://localhost:3000** in your browser.

You should see the dashboard with "No topics yet" and the empty heatmap calendar.

---

## Obsidian Watcher Setup

The watcher is optional — you can also ingest content directly via the API. But it's what makes the Obsidian integration work.

### Step 1: Create Your Obsidian Vault

If you don't already have one:

1. Download [Obsidian](https://obsidian.md/)
2. Create a new vault (or use an existing one)
3. Note the full path to the vault folder

### Step 2: Configure the Watcher

Ensure these are set in `backend/.env`:

```env
OBSIDIAN_VAULT_PATH=C:\Users\YourName\Documents\ObsidianVault
DEFAULT_USER_ID=c2b27bf8-40d5-4015-9023-7aea7c615495
```

### Step 3: Run the Watcher

```bash
cd backend
# Make sure your venv is activated
python watcher.py
```

You should see:
```
14:22:01 [INFO] Watching: C:\Users\YourName\Documents\ObsidianVault
14:22:01 [INFO] User ID:  c2b27bf8-40d5-4015-9023-7aea7c615495
```

### Step 4: Test the Sync

1. In Obsidian, create a new note (e.g., `Python Basics.md`)
2. Add this frontmatter at the top:

```yaml
---
topic: Python
sync_to_app: true
---
```

3. Save the file
4. Watch the watcher terminal — it should detect the change, see the empty body, and trigger auto-generation
5. Wait a moment for Gemini to generate study notes
6. The file will be updated with comprehensive content, then re-ingested to generate flashcards
7. Go to **http://localhost:3000** — you should see "Python" in your topic list with due cards

---

## Using the App

### Creating Study Material

**Option A: Obsidian + Watcher (Automatic)**

1. Create a `.md` file in your vault with frontmatter:
```yaml
---
topic: Your Topic Name
sync_to_app: true
---
```

2. Write your study notes below the frontmatter, OR leave it empty for AI to generate everything
3. Save — the watcher handles the rest

**Option B: Direct API Call (Manual)**

```bash
curl -X POST http://localhost:8000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "markdown_text": "# Docker\n\nDocker is a platform for developing, shipping, and running applications in containers...",
    "topic_name": "Docker",
    "user_id": "c2b27bf8-40d5-4015-9023-7aea7c615495"
  }'
```

### Reviewing Cards

1. Open the dashboard at **http://localhost:3000**
2. Click **"Start Daily Review"** (or click a specific topic)
3. Read the question/code, then click **"Show Answer"**
4. Grade yourself:
   - **Again (1)** — Completely forgot; see it again in 1 day
   - **Hard (2)** — Remembered with difficulty; see it again in 1 day
   - **Good (3)** — Remembered normally; interval increases
   - **Easy (4)** — Effortlessly remembered; interval increases more
5. The next card appears automatically
6. When done, you'll see: **"You're all caught up for today!"**

### Getting AI to Fill Knowledge Gaps

Add `supplement_on_sync: true` to your note's frontmatter:

```yaml
---
topic: Kubernetes
sync_to_app: true
supplement_on_sync: true
---
```

The watcher will analyze your existing notes, identify missing foundational concepts, and append supplemental content directly to your `.md` file.

---

## Project Structure

```
Personal learner/
├── backend/                        # FastAPI backend
│   ├── app/
│   │   ├── main.py                 # App bootstrap, CORS, lifespan
│   │   ├── api/routes.py           # All REST endpoints
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic settings
│   │   │   └── database.py         # Async SQLAlchemy engine
│   │   ├── models/models.py        # ORM models (User, Topic, Flashcard, etc.)
│   │   ├── schemas/schemas.py      # Pydantic request/response schemas
│   │   └── services/
│   │       ├── llm_service.py      # Gemini API abstraction layer
│   │       └── spaced_repetition.py # SM-2 algorithm
│   ├── watcher.py                  # Obsidian vault file monitor
│   ├── .env                        # Environment variables (gitignored)
│   ├── .env.example                # Template for .env
│   └── requirements.txt            # Python dependencies
│
├── frontend/                       # Next.js frontend
│   ├── app/
│   │   ├── globals.css             # Design tokens, scrollbar styling
│   │   ├── layout.tsx              # Root layout
│   │   ├── page.tsx                # Dashboard page
│   │   └── review/page.tsx         # Study room / flashcard review
│   ├── components/
│   │   ├── Flashcard.tsx           # Flashcard renderer (standard + code MCQ)
│   │   └── ui/                     # shadcn/ui primitives
│   │       ├── button.tsx
│   │       ├── card.tsx
│   │       └── progress.tsx
│   ├── lib/
│   │   ├── api.ts                  # API client (fetch wrappers + types)
│   │   └── utils.ts                # cn() utility
│   ├── .env.local                  # Frontend env vars
│   └── package.json
│
├── docs/                           # Comprehensive documentation
│   ├── backend.md                  # Backend architecture & APIs
│   ├── frontend.md                 # Frontend architecture & components
│   ├── database.md                 # DB schema, relationships, queries
│   ├── obsidian-bridge.md          # Watcher, frontmatter, sync logic
│   └── ai-pipeline.md              # Gemini prompts, abstraction, validation
│
├── table_schema.sql                # Database DDL
├── Obsidian-setup.md               # Obsidian frontmatter guide
├── Plan.md                         # Original project blueprint
└── README.md                       # This file
```

---

## Documentation

Comprehensive docs are in the `docs/` folder:

| Document | Covers |
|---|---|
| **[Backend Architecture](docs/backend.md)** | Every API endpoint, request/response schemas, SM-2 algorithm, database layer, how data flows through the system |
| **[Frontend Architecture](docs/frontend.md)** | Pages, components, design system, Tailwind/scrollbar config, API client layer, navigation flow |
| **[Database Schema](docs/database.md)** | All 5 tables with columns/constraints/relationships, query patterns, mastery score calculation, card lifecycle |
| **[Obsidian Bridge](docs/obsidian-bridge.md)** | Watcher script internals, frontmatter fields, auto-generation logic, supplement flow, file write-back behavior |
| **[AI Pipeline](docs/ai-pipeline.md)** | Gemini integration, all 4 prompts in full, abstraction layer, Pydantic validation chain, async architecture, provider swapping |

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS 3, shadcn/ui |
| **Backend** | FastAPI 0.115, Python 3.10+, Uvicorn (ASGI), SQLAlchemy 2.0 (async) |
| **Database** | Microsoft SQL Server 2022 (Docker or local), `aioodbc` + `pyodbc` |
| **AI** | Google Gemini 3.5 Flash (`google-genai` SDK) |
| **Obsidian Bridge** | `watchdog` (filesystem events), `pyyaml` (frontmatter), `requests` (HTTP) |
| **Syntax Highlighting** | `react-syntax-highlighter` (Prism + oneLight theme) |
| **Icons** | Lucide React |
| **Validation** | Pydantic v2 (backend), TypeScript (frontend) |

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | MS SQL connection string with `aioodbc` |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI features |
| `APP_ENV` | No | `"development"` enables SQL query logging |
| `OBSIDIAN_VAULT_PATH` | For watcher | Absolute path to your Obsidian vault |
| `DEFAULT_USER_ID` | For watcher | UUID of the user for card ownership |

### Frontend (`frontend/.env.local`)

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Backend URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_DEFAULT_USER_ID` | Yes | UUID of the seeded user |

---

## Troubleshooting

### "Can't connect to database"

- Ensure SQL Server is running: `docker ps` (Docker) or check Services (Windows)
- Verify the port: `netstat -an | findstr 1433` (Windows) or `lsof -i :1433` (macOS/Linux)
- Check the SA password in `.env` matches what you set during setup
- Confirm ODBC Driver 18 is installed: `odbcinst -q -d` (should show "ODBC Driver 18 for SQL Server")

### "Gemini API key not valid"

- Verify the key in `backend/.env` has no extra whitespace or quotes
- Check the key is active at [Google AI Studio](https://aistudio.google.com/)
- Ensure billing is enabled if you're using a paid tier

### "Watcher doesn't detect changes"

- Verify the vault path in `.env` is an absolute path with correct slashes
- Windows: Use forward slashes or escaped backslashes: `C:\\Users\\...` or `C:/Users/...`
- Ensure the watcher is running (check terminal for "[INFO] Watching: ...")
- Check that the `.md` file has valid frontmatter with `sync_to_app: true`

### "Frontend shows no data"

- Ensure the backend is running on port 8000
- Check `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local`
- Verify the seeded user UUID matches in both `.env` and `.env.local`
- Check browser console for CORS errors

### "Port already in use"

```bash
# Windows: find what's using a port
netstat -ano | findstr :8000
netstat -ano | findstr :3000
netstat -ano | findstr :1433

# macOS/Linux
lsof -i :8000
```
