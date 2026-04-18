# 📚 AI-Powered Book Insight Platform

A full-stack web application that scrapes book data, stores it in MySQL, generates AI insights using OpenAI (or a local LLM via LM Studio), and implements a complete RAG pipeline for semantic Q&A with source citations.

---

## ✨ Features

| Feature | Details |
|---|---|
| **Web Scraping** | Selenium-based scraper for books.toscrape.com + openlibrary.org |
| **Bulk Scraping** | Queue up to 50 URLs — processed async via Celery |
| **AI Summary** | Per-book 3-sentence summary (OpenAI / LM Studio) |
| **Genre Classification** | Auto-tags genres from a fixed taxonomy |
| **Sentiment Analysis** | Tone/mood analysis of book descriptions |
| **RAG Q&A** | Semantic search with ChromaDB + LLM-powered answers |
| **Source Citations** | Every answer links back to the books it used |
| **Chat History** | Full conversation persistence per session |
| **Embedding Cache** | MD5-keyed cache avoids re-embedding same text |
| **Skeleton UI** | Loading skeletons on all async pages |
| **Responsive Design** | Mobile-first Next.js + Tailwind UI |

---

## 🗂 Project Structure

```
book-insight-platform/
├── backend/                        # Django REST Framework
│   ├── config/
│   │   ├── settings.py             # All settings + env var support
│   │   ├── urls.py                 # Root URL router
│   │   ├── celery.py               # Celery app
│   │   └── wsgi.py
│   ├── books/
│   │   ├── models.py               # Book, AIInsight, ChatSession, ScrapeJob
│   │   ├── serializers.py          # DRF serializers
│   │   ├── views.py                # All API endpoints
│   │   ├── urls.py
│   │   └── fixtures/
│   │       └── sample_books.json   # 5 sample books for testing
│   ├── rag/
│   │   ├── pipeline.py             # SemanticChunker + RAGPipeline
│   │   ├── views.py                # /embed endpoints
│   │   └── urls.py
│   ├── scraper/
│   │   ├── scraper.py              # Selenium scraper (multi-source)
│   │   ├── tasks.py                # Celery tasks
│   │   ├── views.py                # Task status endpoint
│   │   └── urls.py
│   ├── requirements.txt
│   ├── manage.py
│   └── .env.example
│
└── frontend/                       # Next.js 14 + Tailwind CSS
    └── src/
        ├── app/
        │   ├── page.tsx             # Dashboard (book grid)
        │   ├── books/[id]/page.tsx  # Book detail + AI insights
        │   ├── ask/page.tsx         # RAG Q&A chat interface
        │   ├── upload/page.tsx      # Single & bulk scrape UI
        │   ├── layout.tsx           # Root layout + navbar
        │   └── globals.css          # Tailwind + custom CSS
        ├── components/
        │   ├── books/
        │   │   ├── BookCard.tsx     # Card with cover, rating, genres
        │   │   └── InsightsPanel.tsx # Accordion for AI insights
        │   ├── chat/
        │   │   └── ChatInterface.tsx # Full chat UI with streaming dots
        │   └── ui/
        │       ├── Navbar.tsx
        │       ├── Skeleton.tsx     # Shimmer loading skeletons
        │       └── StarRating.tsx
        ├── lib/
        │   ├── api.ts               # Axios API client
        │   └── hooks.ts             # useDebounce
        └── types/
            └── index.ts             # TypeScript interfaces
```

---

## ⚙️ Setup Guide

### Prerequisites

- Python 3.10+
- Node.js 18+
- Redis (for Celery)
- Google Chrome + ChromeDriver (for Selenium)
- MySQL (optional, SQLite works for dev)
- OpenAI API key **OR** LM Studio running locally

---

### 1. Backend Setup

```bash
# Clone the project
git clone <your-repo> book-insight-platform
cd book-insight-platform/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env — at minimum set OPENAI_API_KEY
nano .env

# Run migrations
python manage.py migrate

# Load sample data (5 books for testing)
python manage.py loaddata books/fixtures/sample_books.json

# Create superuser (optional, for admin panel)
python manage.py createsuperuser

# Start development server
python manage.py runserver
```

> Backend will run on `http://localhost:8000`

---

### 2. Start Celery Worker (background jobs)

In a **separate terminal**:

```bash
cd backend
source venv/bin/activate
celery -A config worker --loglevel=info
```

---

### 3. Frontend Setup

```bash
cd frontend
npm install

# Configure API URL
cp .env.local.example .env.local
# Default: NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1

npm run dev
```

> Frontend will run on `http://localhost:3000`

---

### 4. MySQL Setup (Production)

```sql
-- Create database
CREATE DATABASE book_insight CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'bookuser'@'localhost' IDENTIFIED BY 'yourpassword';
GRANT ALL PRIVILEGES ON book_insight.* TO 'bookuser'@'localhost';
FLUSH PRIVILEGES;
```

Then update `.env`:
```env
DB_ENGINE=django.db.backends.mysql
DB_NAME=book_insight
DB_USER=bookuser
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=3306
```

---

### 5. LM Studio Setup (Local LLM — No OpenAI Required)

1. Download [LM Studio](https://lmstudio.ai)
2. Download a model (e.g. `mistral-7b-instruct` or `llama-3-8b`)
3. Go to **Local Server** tab → Load model → Start server on port **1234**
4. Update `.env`:
   ```env
   LLM_PROVIDER=lmstudio
   LMSTUDIO_BASE_URL=http://localhost:1234/v1
   LMSTUDIO_MODEL=local-model
   ```

---

## 🌐 API Reference

### Books

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/books/` | List all books (paginated) |
| `GET` | `/api/v1/books/?search=dune` | Search by title/author |
| `GET` | `/api/v1/books/?min_rating=4` | Filter by minimum rating |
| `GET` | `/api/v1/books/{id}/` | Get book detail + AI insights |
| `GET` | `/api/v1/recommend/{id}/` | Get semantically similar books |

### Scraping

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/upload-book/` | Scrape + embed a single book URL |
| `POST` | `/api/v1/bulk-scrape/` | Bulk scrape multiple URLs (async) |
| `GET` | `/api/v1/scrape-status/{job_id}/` | Check bulk scrape job progress |
| `GET` | `/api/v1/task-status/{task_id}/` | Poll a Celery task status |

### RAG / AI

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/ask/` | Ask a question (RAG-powered answer + sources) |
| `POST` | `/api/v1/embed/{id}/` | Manually embed a specific book |
| `POST` | `/api/v1/embed-all/` | Embed all un-embedded books |

### Chat Sessions

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/sessions/` | List all chat sessions |
| `GET` | `/api/v1/sessions/{session_id}/` | Get full chat history |
| `DELETE` | `/api/v1/sessions/{session_id}/` | Delete a session |

---

## 📡 Example API Requests

### Upload a single book
```bash
curl -X POST http://localhost:8000/api/v1/upload-book/ \
  -H "Content-Type: application/json" \
  -d '{"url": "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html", "generate_insights": true}'

# Response:
# {"message": "Scraping started.", "task_id": "abc123-..."}
```

### Bulk scrape
```bash
curl -X POST http://localhost:8000/api/v1/bulk-scrape/ \
  -H "Content-Type: application/json" \
  -d '{
    "urls": [
      "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
      "https://books.toscrape.com/catalogue/soumission_998/index.html"
    ],
    "generate_insights": true
  }'

# Response:
# {"message": "Bulk scrape started for 2 URLs.", "job_id": 1}
```

### Ask a question (RAG Q&A)
```bash
curl -X POST http://localhost:8000/api/v1/ask/ \
  -H "Content-Type: application/json" \
  -d '{"question": "What books deal with themes of power and politics?", "top_k": 3}'

# Response:
# {
#   "session_id": "uuid-...",
#   "answer": "Based on the books in the library, Dune by Frank Herbert...",
#   "sources": [
#     {"book_id": 3, "title": "Dune"},
#     {"book_id": 2, "title": "To Kill a Mockingbird"}
#   ]
# }
```

### Continue a conversation (chat history)
```bash
curl -X POST http://localhost:8000/api/v1/ask/ \
  -H "Content-Type: application/json" \
  -d '{"question": "Tell me more about the first one", "session_id": "uuid-from-previous-response"}'
```

### Get recommendations
```bash
curl http://localhost:8000/api/v1/recommend/3/?top_k=4

# Returns 4 books similar to book ID 3 (Dune)
```

### Embed all books
```bash
curl -X POST http://localhost:8000/api/v1/embed-all/

# Response:
# {"embedded": 5, "failed": 0, "errors": []}
```

---

## 🧪 Sample Test Queries

After loading sample data, try these in the `/ask` UI or via API:

| Query | Expected Behavior |
|---|---|
| "What is Dune about?" | Summarizes the Arrakis spice universe |
| "Which book is best for motivation?" | Returns Atomic Habits |
| "Recommend something like The Hitchhiker's Guide" | Finds sci-fi/comedy books |
| "Who wrote The Name of the Wind?" | Returns Patrick Rothfuss |
| "Books about social justice" | Returns To Kill a Mockingbird |
| "Compare the ratings of all books" | Lists books with ratings |

---

## 🖼 Screenshots

> _Replace these placeholders with actual screenshots_

| Page | Screenshot |
|---|---|
| Dashboard / Book Library | `screenshots/dashboard.png` |
| Book Detail + AI Insights | `screenshots/book-detail.png` |
| Q&A Chat Interface | `screenshots/ask-page.png` |
| Upload / Bulk Scrape | `screenshots/upload.png` |

---

## 🚀 Production Deployment

### Backend (Gunicorn + Nginx)

```bash
# Collect static files
python manage.py collectstatic

# Run with Gunicorn
gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 4

# Run Celery in production
celery -A config worker --loglevel=warning --concurrency=2
```

### Frontend (Vercel or Static Export)

```bash
# Build for production
npm run build
npm start

# Or deploy to Vercel (zero config)
npx vercel --prod
```

### Environment Variables (Production Checklist)

- [ ] `DJANGO_SECRET_KEY` — strong random key
- [ ] `DEBUG=False`
- [ ] `ALLOWED_HOSTS` — your domain
- [ ] `DB_*` — MySQL connection details
- [ ] `REDIS_URL` — Redis connection string
- [ ] `OPENAI_API_KEY` — or configure LM Studio
- [ ] `CORS_ORIGINS` — your frontend domain

---

## 🏗 Architecture Overview

```
User → Next.js Frontend
          │
          ▼
   Django REST API
   ┌──────────────────────────────┐
   │  /books      → MySQL DB      │
   │  /ask        → RAG Pipeline  │
   │  /upload     → Celery Task   │
   └──────────────────────────────┘
          │              │
          ▼              ▼
     ChromaDB         Celery Worker
   (Vector Store)    (Async Jobs)
          │              │
          ▼              ▼
    OpenAI API      Selenium Scraper
  (or LM Studio)   (books.toscrape.com)
```

### RAG Pipeline Flow

```
User Question
     │
     ▼
  Embed question (OpenAI/LM Studio)
     │
     ▼
  ChromaDB cosine similarity search
     │
     ▼
  Retrieve top-K chunks + metadata
     │
     ▼
  Build prompt: system + context + history + question
     │
     ▼
  LLM generates answer
     │
     ▼
  Return answer + source citations → saved to ChatSession
```

---

## 🔧 Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Django 4.2 + Django REST Framework |
| **Database** | SQLite (dev) / MySQL (prod) |
| **Vector DB** | ChromaDB (persistent, cosine similarity) |
| **AI / LLM** | OpenAI GPT-3.5 / LM Studio (local) |
| **Embeddings** | OpenAI text-embedding-3-small |
| **Task Queue** | Celery + Redis |
| **Scraping** | Selenium + BeautifulSoup4 |
| **Frontend** | Next.js 14 (App Router) |
| **Styling** | Tailwind CSS |
| **HTTP Client** | Axios |
| **Animations** | Framer Motion + CSS |

---

## 📄 License

MIT — free for personal and commercial use.
# book-insight-platform
# book-insight-platform
