import sqlite3
from pathlib import Path
from typing import Any

DB_PATH = Path(__file__).resolve().parent.parent / "mindspace.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS chats (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                pinned INTEGER NOT NULL DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                chat_id TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                filename TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def list_chats() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at, c.pinned,
                   (SELECT m.content FROM messages AS m
                    WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS preview
            FROM chats AS c
            ORDER BY c.updated_at DESC
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_chat(chat_id: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        chat = conn.execute(
            "SELECT id, title, created_at, updated_at, pinned FROM chats WHERE id = ?",
            (chat_id,),
        ).fetchone()
        if chat is None:
            return None
        messages = conn.execute(
            """
            SELECT id, chat_id, role, content, created_at
            FROM messages WHERE chat_id = ? ORDER BY created_at ASC
            """,
            (chat_id,),
        ).fetchall()
        result = dict(chat)
        result["messages"] = [dict(message) for message in messages]
        return result


def create_chat(title: str = "New chat") -> dict[str, Any]:
    import uuid
    from datetime import datetime, timezone

    chat_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO chats (id, title, created_at, updated_at, pinned) VALUES (?, ?, ?, ?, 0)",
            (chat_id, title, now, now),
        )
        conn.commit()
    return {"id": chat_id, "title": title, "created_at": now, "updated_at": now, "pinned": 0, "messages": []}


def update_chat_timestamp(chat_id: str) -> None:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            "UPDATE chats SET updated_at = ? WHERE id = ?",
            (now, chat_id),
        )
        conn.commit()


def save_message(chat_id: str, role: str, content: str) -> dict[str, Any]:
    import uuid
    from datetime import datetime, timezone

    message_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO messages (id, chat_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            (message_id, chat_id, role, content, now),
        )
        conn.commit()
    update_chat_timestamp(chat_id)
    return {"id": message_id, "chat_id": chat_id, "role": role, "content": content, "created_at": now}


def rename_chat(chat_id: str, title: str) -> dict[str, Any] | None:
    with get_connection() as conn:
        conn.execute("UPDATE chats SET title = ? WHERE id = ?", (title, chat_id))
        conn.commit()
    return get_chat(chat_id)


def delete_chat(chat_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM chats WHERE id = ?", (chat_id,))
        conn.commit()


def save_document(filename: str, content: str) -> dict[str, Any]:
    import uuid
    from datetime import datetime, timezone

    document_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO documents (id, filename, content, created_at) VALUES (?, ?, ?, ?)",
            (document_id, filename, content, now),
        )
        conn.commit()
    return {"id": document_id, "filename": filename, "content": content, "created_at": now}


def list_documents() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, filename, content, created_at FROM documents ORDER BY created_at DESC"
        ).fetchall()
        return [dict(row) for row in rows]
