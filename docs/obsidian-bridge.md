# Obsidian Bridge Documentation

The Obsidian Bridge is a standalone Python script (`watcher.py`) that monitors your local Obsidian vault for note changes and automatically syncs content to the Personal Learner backend. It enables a **two-way sync**: notes from Obsidian become study cards, and the backend can write auto-generated study material back into your vault.

---

## How It Works

```
Obsidian Vault (local folder)
    │
    │  You write/edit a .md note with YAML frontmatter
    │
    ▼
watcher.py (filesystem monitor)
    │
    ├─ Detects file modification
    ├─ Debounces (waits 3s for save spamming to stop)
    ├─ Reads the file
    ├─ Parses YAML frontmatter
    │
    ├─ sync_to_app: true? ──────────► POST /api/ingest → Flashcards generated
    │
    ├─ Body is empty? ──────────────► POST /api/generate-content → AI writes notes
    │                                       │
    │                                       └──► Writes back to .md file
    │
    └─ supplement_on_sync: true? ──► POST /api/supplement-content → AI adds missing concepts
                                           │
                                           └──► Writes back to .md file
```

---

## File: `backend/watcher.py`

### Dependencies

- **`watchdog`**: Monitors filesystem for `.md` file changes
- **`pyyaml`**: Parses YAML frontmatter
- **`requests`**: Sends HTTP POST requests to the FastAPI backend
- **`python-dotenv`**: Loads `.env` for vault path and user ID

### Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OBSIDIAN_VAULT_PATH` | Yes | Absolute path to your Obsidian vault folder |
| `DEFAULT_USER_ID` | Yes | UUID of the user to associate flashcards with |

These are set in `backend/.env`.

### Architecture

The watcher runs as a **long-lived process** independent of the FastAPI server. It uses the Observer pattern from the `watchdog` library:

```python
handler = ObsidianHandler(debounce_seconds=3)
observer = Observer()
observer.schedule(handler, str(vault), recursive=True)
observer.start()
```

### Debouncing

The `on_modified` event fires on every save (potentially multiple times if your editor triggers multiple filesystem events). The handler implements a **debounce timer**:

1. When a `.md` file modification is detected, it creates/cancels a `threading.Timer` for that file path
2. The timer waits 3 seconds
3. If the file is modified again within those 3 seconds, the timer is cancelled and restarted
4. Only after 3 seconds of inactivity does `_ingest_file()` fire

### Frontmatter Parsing (`_split_frontmatter_and_body`)

Uses a static method that:

1. Strips leading whitespace from the file content
2. Checks if the content starts with `---` (YAML frontmatter delimiter)
3. Splits on `---` to isolate the YAML block and the body
4. Parses the YAML block with `yaml.safe_load()`
5. Returns `(frontmatter_dict | None, body_text)`

Expected YAML frontmatter format:

```yaml
---
topic: Kubernetes
sync_to_app: true
last_synced: 2026-05-27T14:06:00
# Optional:
supplement_on_sync: true
---
```

### Supported Frontmatter Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `topic` or `topic_name` | `string` | Yes | The learning topic name (e.g., "Docker", "Kafka") |
| `sync_to_app` | `boolean` | For sync | When `true`, triggers flashcard generation |
| `supplement_on_sync` | `boolean` | No | When `true`, AI analyzes notes and adds missing concepts |
| `last_synced` | `datetime` | No | Tracking field (not used by the watcher itself) |

### Ingestion Logic (`_ingest_file`)

The file processing has three distinct paths:

#### Path 1: Empty Body → Auto-Generate Content

**Trigger:** The note body is empty OR contains only a heading matching the topic name (e.g., `# Kubernetes`).

**Process:**
1. Sends `POST /api/generate-content` with `{"topic_name": "Kubernetes"}`
2. The backend calls Gemini 3.5 Flash, which generates comprehensive Markdown study notes
3. The watcher writes the generated content back to the `.md` file with the original frontmatter preserved
4. The write-back triggers another file modification event **(which will then follow Path 3)**

This enables the "blank note" workflow: create a new Obsidian note with just frontmatter, and the entire study content is auto-generated.

#### Path 2: Supplement Notes with Missing Concepts

**Trigger:** `supplement_on_sync: true` in the frontmatter (and body is not empty).

**Process:**
1. Sends `POST /api/supplement-content` with `{"topic_name": "...", "markdown_text": "..."}`
2. The backend analyzes the existing notes, identifies missing foundational concepts, and generates supplemental Markdown
3. The watcher appends the supplemental content to the file and **sets `supplement_on_sync: false`** (prevents infinite loop on next file change)
4. The write-back triggers another file modification event

#### Path 3: Normal Sync → Generate Flashcards

**Trigger:** `sync_to_app: true` in the frontmatter and body has content.

**Process:**
1. Sends `POST /api/ingest` with:
   ```json
   {
     "markdown_text": "<full file content including frontmatter>",
     "topic_name": "Kubernetes",
     "user_id": "<DEFAULT_USER_ID from .env>"
   }
   ```
2. The backend sends the markdown to Gemini 3.5 Flash, which generates a mix of standard and code-MCQ flashcards
3. Flashcards are stored in the database with initial SM-2 values (due immediately)
4. The watcher logs the number of flashcards created

---

## Logging

The watcher logs to stdout with timestamps. Example output:

```
14:22:01 [INFO] Watching: C:\Users\sharm\Documents\ObsidianVault
14:22:01 [INFO] User ID:  c2b27bf8-40d5-4015-9023-7aea7c615495
14:22:15 [INFO] Change queued: Kubernetes.md
14:22:18 [INFO] Ingested Kubernetes.md → topic 'Kubernetes' (12 flashcards)
```

---

## Running the Watcher

### Prerequisites

- The FastAPI backend must be running on `http://localhost:8000`
- `.env` must have `OBSIDIAN_VAULT_PATH` and `DEFAULT_USER_ID` set
- The Obsidian vault path must exist and be readable

### Command

```bash
cd backend
python watcher.py
```

The watcher runs until interrupted with `Ctrl+C`, which triggers a graceful shutdown.

---

## Obsidian Note Workflow

### Creating a New Study Topic

1. In Obsidian, create a new note (e.g., `Kubernetes.md`)
2. Add the YAML frontmatter:

```yaml
---
topic: Kubernetes
sync_to_app: true
---
```

3. Save the file. The watcher detects the change, sees the body is empty, and calls `/api/generate-content`
4. Gemini generates comprehensive study notes and the watcher writes them back to the file
5. On the next file modification event, the watcher sees the populated body + `sync_to_app: true` and calls `/api/ingest`
6. Flashcards are generated and appear in the dashboard

### Updating Existing Notes

1. Edit the note body with new content
2. Ensure `sync_to_app: true` is still in the frontmatter
3. Save. The watcher re-ingests the full markdown and generates new flashcards
4. **Note:** New flashcards are additive — existing cards are not deleted. Each re-sync creates additional cards.

### Getting AI to Fill Knowledge Gaps

1. Add `supplement_on_sync: true` to the frontmatter:

```yaml
---
topic: Kubernetes
sync_to_app: true
supplement_on_sync: true
---
```

2. Save. The watcher calls `/api/supplement-content`, which analyzes your notes and adds missing foundational concepts
3. The `supplement_on_sync` flag is automatically set to `false` after the supplement is applied (prevents re-triggering)

### Working Without Sync

To work with Obsidian notes but NOT trigger sync:
- Either omit `sync_to_app` entirely
- Or set `sync_to_app: false`

The watcher will skip these files.

---

## Architecture Notes

### Why a Separate Script Instead of an Obsidian Plugin?

For the MVP, a filesystem watcher was chosen over an Obsidian plugin because:

1. **Simplicity:** No need to learn Obsidian's plugin API or deal with plugin lifecycle
2. **Independence:** The watcher works with any Markdown editor, not just Obsidian
3. **Reliability:** Filesystem events are simpler to handle than plugin state management
4. **No rebuilds:** Plugin changes require reloading Obsidian; the watcher is just a Python process

A native Obsidian plugin could be built later for a more integrated experience, potentially offering:
- In-app sync status indicators
- One-click sync buttons in the Obsidian sidebar
- Real-time status without polling

### Hardcoded URLs

The watcher currently uses hardcoded `http://localhost:8000` for API calls. This is fine for local development. In a production setup, this would be configurable via `.env`.

### Write-Back Triggers Re-Ingestion

When the watcher writes generated/supplemented content back to a `.md` file, this triggers another `on_modified` event. The watcher handles this naturally — the new event goes through the same three-path logic:

- **After auto-generation:** The file now has content, so it follows Path 3 (normal sync → generate flashcards)
- **After supplementation:** `supplement_on_sync` is now `false`, so it falls through to Path 3 if `sync_to_app` is still `true`
