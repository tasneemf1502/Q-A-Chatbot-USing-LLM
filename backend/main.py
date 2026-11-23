import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

from backend.database import (
    create_chat,
    delete_chat,
    get_chat,
    init_db,
    list_chats,
    list_documents,
    rename_chat,
    save_document,
    save_message,
)

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

app = FastAPI(title="MindSpace API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


class ChatPrompt(BaseModel):
    content: str
    mode: str = "Study Buddy"
    answer_length: str = "Medium"
    document_context: list[dict[str, str]] | None = None


class RenameRequest(BaseModel):
    title: str


def get_cohere_client():
    api_key = os.getenv("COHERE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Cohere API key is missing.")
    try:
        import cohere
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="The cohere package is not installed.") from exc
    return cohere.Client(api_key)


def extract_text_from_upload(file: UploadFile) -> str:
    payload = file.file.read()
    if file.filename.lower().endswith(".pdf"):
        try:
            reader = PdfReader(__import__("io").BytesIO(payload))
            extracted_pages = []
            for page in reader.pages:
                text = page.extract_text() or ""
                if text:
                    extracted_pages.append(text)
            return "\n\n".join(extracted_pages)
        except Exception as exc:  # pragma: no cover - error surfaced to caller
            raise ValueError(f"Could not read PDF: {file.filename}") from exc

    try:
        return payload.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError(f"File must be UTF-8 text: {file.filename}") from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/chats")
def get_chats() -> list[dict[str, Any]]:
    return list_chats()


@app.post("/api/chats")
def create_new_chat() -> dict[str, Any]:
    return create_chat()


@app.get("/api/chats/{chat_id}")
def chat_detail(chat_id: str) -> dict[str, Any]:
    chat = get_chat(chat_id)
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@app.patch("/api/chats/{chat_id}/rename")
def rename_chat_route(chat_id: str, payload: RenameRequest) -> dict[str, Any]:
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Title cannot be empty.")
    chat = rename_chat(chat_id, payload.title.strip()[:60])
    if chat is None:
        raise HTTPException(status_code=404, detail="Chat not found.")
    return chat


@app.delete("/api/chats/{chat_id}")
def delete_chat_route(chat_id: str) -> dict[str, str]:
    delete_chat(chat_id)
    return {"status": "deleted"}


@app.post("/api/chats/{chat_id}/message")
def send_message(chat_id: str, payload: ChatPrompt) -> dict[str, str]:
    if not payload.content or not payload.content.strip():
        raise HTTPException(status_code=400, detail="Message content is required.")

    existing = get_chat(chat_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Chat not found.")

    save_message(chat_id, "user", payload.content.strip())

    history = [(item["role"], item["content"]) for item in existing.get("messages", [])]
    prompt = payload.content.strip()
    if payload.document_context:
        document_block = "\n\n".join(
            f"[Document: {item.get('filename', 'Source')} ]\n{item.get('content', '')}"
            for item in payload.document_context[:4]
        )
        prompt = (
            "Use the uploaded document excerpts carefully and answer only from the supplied context "
            "when it is relevant.\n\n"
            f"Document context:\n{document_block}\n\nUser question:\n{payload.content.strip()}"
        )

    cohere_client = get_cohere_client()
    chat_history = [
        {"role": "USER" if role == "user" else "CHATBOT", "message": message}
        for role, message in history
    ]

    temperature = 0.2 if payload.answer_length == "Short" else 0.5 if payload.answer_length == "Medium" else 0.7
    system_message = (
        "You are MindSpace, a warm and intelligent assistant. "
        f"Answer in {payload.mode} style. "
        f"Keep the answer {payload.answer_length.lower()} in length and be accurate."
    )

    try:
        response = cohere_client.chat(
            model="command-r-plus",
            message=prompt,
            chat_history=chat_history,
            temperature=temperature,
            preamble=system_message,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cohere request failed: {exc}") from exc
    reply = getattr(response, "text", None)
    if not isinstance(reply, str) or not reply.strip():
        raise HTTPException(status_code=502, detail="Cohere returned an empty response.")
    save_message(chat_id, "assistant", reply)
    return {"reply": reply}


@app.get("/api/documents")
def get_uploaded_documents() -> list[dict[str, Any]]:
    return list_documents()


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)) -> dict[str, Any]:
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected.")

    allowed_suffixes = {".pdf", ".txt", ".md"}
    suffix = Path(file.filename).suffix.lower()
    if suffix not in allowed_suffixes:
        raise HTTPException(status_code=400, detail="Only PDF, TXT, and Markdown files are supported.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(payload) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="The uploaded file exceeds the 10 MB limit.")
    file.file.seek(0)

    try:
        content = extract_text_from_upload(file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    summary = content.strip()
    if len(summary) > 2000:
        summary = f"{summary[:2000]}..."
    return save_document(file.filename, summary)
