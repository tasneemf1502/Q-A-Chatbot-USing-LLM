# Q&A Chatbot

A learning and document Q&A project with two interfaces:

- **BloomBot** is a standalone Streamlit chat app.
- **MindSpace** is a React interface backed by a FastAPI service.

Both use Cohere for AI-generated answers. Run either interface locally; the React app requires the API service, while Streamlit runs on its own.

## Features

### BloomBot (Streamlit)

- Chat modes and answer-length settings.
- Local chat history, rename, export, feedback, and retry controls.
- PDF, TXT, and Markdown uploads.
- Local text extraction and lexical retrieval of relevant excerpts, with document citations in answers.
- File excerpts are sent to Cohere only when document context is enabled.

### MindSpace (React + FastAPI)

- Create, revisit, rename, and delete conversations.
- Markdown-rendered chat messages and selectable response styles.
- Upload PDF, TXT, and Markdown files and use their extracted text as chat context.
- SQLite persistence for conversations, messages, and uploaded document text.
- FastAPI health check and interactive API documentation.

## Requirements

- Python 3.10 or later
- Node.js 18 or later and npm
- A Cohere API key

## Configuration

Create a `.env` file in the project root and add your Cohere key:

```dotenv
COHERE_API_KEY=your_cohere_api_key
```

You can copy the template with PowerShell:

```powershell
Copy-Item .env.example .env
```

Then replace the placeholder value in `.env`. Keep this file private; it is excluded from Git. Never put API keys in source code or commit them.

## Run MindSpace (React + FastAPI)

Open two terminals in the project root.

### 1. Start the API

Create the Python environment and install dependencies (once):

```powershell
py -3 -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

Start the API:

```powershell
.\venv\Scripts\python.exe -m uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

The API health check is at <http://127.0.0.1:8000/api/health>, and the interactive API docs are at <http://127.0.0.1:8000/docs>.

### 2. Start the React app

In the second terminal:

```powershell
Set-Location .\frontend
npm ci
npm run dev -- --host 127.0.0.1
```

Open <http://127.0.0.1:5173>.

If `npm run dev` has trouble when the project path contains an ampersand (`&`), start Vite directly from the `frontend` directory:

```powershell
node .\node_modules\vite\bin\vite.js --host 127.0.0.1
```

The frontend calls the API at `http://localhost:8000`.

## Run BloomBot (Streamlit)

Streamlit does not require the FastAPI service. From the project root:

```powershell
.\venv\Scripts\python.exe -m streamlit run app.py
```

Open the local URL printed by Streamlit, usually <http://localhost:8501>. BloomBot also reads `COHERE_API_KEY` from the root `.env` file.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check whether the API is running |
| `GET` | `/api/chats` | List conversations |
| `POST` | `/api/chats` | Create a conversation |
| `GET` | `/api/chats/{chat_id}` | Get a conversation and its messages |
| `PATCH` | `/api/chats/{chat_id}/rename` | Rename a conversation |
| `DELETE` | `/api/chats/{chat_id}` | Delete a conversation |
| `POST` | `/api/chats/{chat_id}/message` | Send a message and get a Cohere response |
| `GET` | `/api/documents` | List uploaded documents |
| `POST` | `/api/documents/upload` | Extract and store an uploaded document |

Uploaded files are limited to PDF, TXT, or Markdown and 10 MB per file. PDF text extraction does not perform OCR, so scanned/image-only PDFs may not yield searchable text. The MindSpace API stores at most the first 2,000 extracted characters per uploaded file for document context.

## Local data and privacy

- MindSpace creates `mindspace.db` in the project root.
- BloomBot saves chats in `chat_garden.json`.
- These local files, `.env`, Python environments, frontend dependencies, and build output are excluded from Git.
- Chat history and document text are stored locally without encryption.
- Chat prompts and any included document excerpts are sent to Cohere to generate answers. Do not upload sensitive information.
- This project has no authentication and is intended for local development. Do not expose the API or Streamlit server publicly without adding appropriate access controls and deployment security.

## Build and basic checks

Build the React frontend:

```powershell
Set-Location .\frontend
npm ci
npm run build
```

Check Python syntax from the project root:

```powershell
.\venv\Scripts\python.exe -m py_compile app.py backend\main.py backend\database.py
```
