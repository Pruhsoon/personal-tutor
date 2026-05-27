import os
import sys
import logging
from pathlib import Path
from threading import Timer

import requests
import yaml
from dotenv import load_dotenv
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

load_dotenv()

VAULT_PATH = os.getenv("OBSIDIAN_VAULT_PATH")
DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID")
INGEST_URL = "http://localhost:8000/api/ingest"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("watcher")


class ObsidianHandler(FileSystemEventHandler):
    def __init__(self, debounce_seconds: float = 3) -> None:
        self._debounce_seconds = debounce_seconds
        self._debounce_timers: dict[str, Timer] = {}

    def on_modified(self, event: FileSystemEventHandler) -> None:
        if event.is_directory:
            return
        path = event.src_path
        if not path.endswith(".md"):
            return

        if path in self._debounce_timers:
            self._debounce_timers[path].cancel()

        timer = Timer(self._debounce_seconds, self._ingest_file, args=[path])
        self._debounce_timers[path] = timer
        timer.start()
        logger.info("Change queued: %s", Path(path).name)

    def _ingest_file(self, path: str) -> None:
        self._debounce_timers.pop(path, None)

        try:
            content = Path(path).read_text(encoding="utf-8")
        except OSError as exc:
            logger.error("Failed to read %s: %s", path, exc)
            return

        frontmatter = self._parse_frontmatter(content)
        if frontmatter is None:
            logger.info("No frontmatter in %s — skipping", Path(path).name)
            return
        if not frontmatter.get("sync_to_app"):
            logger.info("sync_to_app not enabled in %s — skipping", Path(path).name)
            return

        topic_name = frontmatter.get("topic_name") or frontmatter.get("topic")
        if not topic_name:
            logger.warning("No topic_name in frontmatter of %s — skipping", Path(path).name)
            return

        payload = {
            "markdown_text": content,
            "topic_name": topic_name,
            "user_id": DEFAULT_USER_ID,
        }

        try:
            resp = requests.post(INGEST_URL, json=payload, timeout=120)
            if resp.status_code == 201:
                card_count = len(resp.json().get("flashcards", []))
                logger.info("Ingested %s → topic '%s' (%d flashcards)", Path(path).name, topic_name, card_count)
            else:
                logger.error("Ingest failed for %s: %d — %s", Path(path).name, resp.status_code, resp.text[:200])
        except requests.RequestException as exc:
            logger.error("Request failed for %s: %s", Path(path).name, exc)

    @staticmethod
    def _parse_frontmatter(content: str) -> dict | None:
        stripped = content.lstrip()
        if not stripped.startswith("---"):
            return None

        parts = stripped.split("---", 2)
        if len(parts) < 3:
            return None

        yaml_str = parts[1].strip()
        if not yaml_str:
            return None

        try:
            parsed = yaml.safe_load(yaml_str)
            return parsed if isinstance(parsed, dict) else None
        except yaml.YAMLError as exc:
            logger.warning("YAML parse error: %s", exc)
            return None


def main() -> None:
    if not VAULT_PATH:
        logger.error("OBSIDIAN_VAULT_PATH is not set in .env")
        sys.exit(1)
    if not DEFAULT_USER_ID:
        logger.error("DEFAULT_USER_ID is not set in .env")
        sys.exit(1)

    vault = Path(VAULT_PATH)
    if not vault.exists():
        logger.error("Vault path does not exist: %s", VAULT_PATH)
        sys.exit(1)

    logger.info("Watching: %s", VAULT_PATH)
    logger.info("User ID:  %s", DEFAULT_USER_ID)

    handler = ObsidianHandler(debounce_seconds=3)
    observer = Observer()
    observer.schedule(handler, str(vault), recursive=True)
    observer.start()

    try:
        while observer.is_alive():
            observer.join(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        observer.stop()
        observer.join()


if __name__ == "__main__":
    main()
