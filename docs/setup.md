# Setup Guide

Everything you need to get Personal Learner running locally.

---

## Prerequisites

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
