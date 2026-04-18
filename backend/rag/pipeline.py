"""
RAG Pipeline — Retrieval-Augmented Generation core.

Flow:
  1. Semantic chunking of book descriptions
  2. Embedding generation (OpenAI or sentence-transformers)
  3. Storage in ChromaDB vector store
  4. Similarity search on user queries
  5. LLM answer generation with source citations
"""

import re
import logging
import hashlib
from typing import Optional

import chromadb
from chromadb.config import Settings
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)


def _get_llm_client():
    """
    Return an OpenAI-compatible client.
    Works with: OpenAI API, LM Studio, Ollama, or any local server.
    """
    from openai import OpenAI

    if settings.LLM_PROVIDER == "lmstudio":
        return OpenAI(
            base_url=settings.LMSTUDIO_BASE_URL,
            api_key="not-needed",  # LM Studio doesn't check the key
        )
    else:
        return OpenAI(api_key=settings.OPENAI_API_KEY)


def _get_model_name() -> str:
    if settings.LLM_PROVIDER == "lmstudio":
        return settings.LMSTUDIO_MODEL
    return settings.OPENAI_MODEL


# ── Semantic Chunker ──────────────────────────────────────────────────────────

class SemanticChunker:
    """
    Splits text into semantically coherent chunks.
    Strategy: split on sentence boundaries, then merge until chunk_size reached.
    This is smarter than fixed-character splitting.
    """

    def __init__(self, chunk_size: int = 500, overlap: int = 100):
        self.chunk_size = chunk_size
        self.overlap = overlap

    def split_into_sentences(self, text: str) -> list[str]:
        """Tokenize text into sentences using punctuation heuristics."""
        # Split on ., !, ? followed by space or end-of-string
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        return [s.strip() for s in sentences if s.strip()]

    def chunk(self, text: str, metadata: dict = None) -> list[dict]:
        """
        Returns list of {"text": ..., "metadata": ...} dicts.
        Preserves overlap between consecutive chunks for context continuity.
        """
        if not text:
            return []

        sentences = self.split_into_sentences(text)
        chunks = []
        current_chunk = []
        current_len = 0

        for sentence in sentences:
            sentence_len = len(sentence)

            if current_len + sentence_len > self.chunk_size and current_chunk:
                # Finalize current chunk
                chunk_text = " ".join(current_chunk)
                chunks.append({"text": chunk_text, "metadata": metadata or {}})

                # Overlap: carry last sentences forward
                overlap_text = []
                overlap_len = 0
                for s in reversed(current_chunk):
                    if overlap_len + len(s) <= self.overlap:
                        overlap_text.insert(0, s)
                        overlap_len += len(s)
                    else:
                        break

                current_chunk = overlap_text
                current_len = overlap_len

            current_chunk.append(sentence)
            current_len += sentence_len

        # Don't forget the last chunk
        if current_chunk:
            chunks.append({"text": " ".join(current_chunk), "metadata": metadata or {}})

        return chunks


# ── RAG Pipeline ─────────────────────────────────────────────────────────────

class RAGPipeline:
    """
    Full RAG pipeline: embed → store → retrieve → generate.
    Uses ChromaDB as the vector store and OpenAI (or LM Studio) for LLM calls.
    """

    COLLECTION_NAME = "book_descriptions"

    def __init__(self):
        self.chunker = SemanticChunker(
            chunk_size=settings.CHUNK_SIZE,
            overlap=settings.CHUNK_OVERLAP,
        )
        self._chroma_client = None
        self._collection = None

    @property
    def chroma(self):
        """Lazy-initialize ChromaDB client with persistence."""
        if self._chroma_client is None:
            self._chroma_client = chromadb.PersistentClient(
                path=settings.CHROMA_PERSIST_DIR,
                settings=Settings(anonymized_telemetry=False),
            )
        return self._chroma_client

    @property
    def collection(self):
        """Get or create the books collection."""
        if self._collection is None:
            self._collection = self.chroma.get_or_create_collection(
                name=self.COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collection

    # ── Embedding ─────────────────────────────────────────────────────────────

    def _embed(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings with caching.
        Cache key = hash of text content to avoid repeated API calls.
        """
        client = _get_llm_client()
        embeddings = []

        for text in texts:
            cache_key = f"embed_{hashlib.md5(text.encode()).hexdigest()}"
            cached = cache.get(cache_key)

            if cached:
                embeddings.append(cached)
                continue

            if settings.LLM_PROVIDER == "lmstudio":
                # LM Studio embedding
                response = client.embeddings.create(
                    model=settings.LMSTUDIO_MODEL,
                    input=text,
                )
            else:
                response = client.embeddings.create(
                    model=settings.EMBEDDING_MODEL,
                    input=text,
                )

            vector = response.data[0].embedding
            cache.set(cache_key, vector, timeout=86400)  # cache 24h
            embeddings.append(vector)

        return embeddings

    # ── Indexing ──────────────────────────────────────────────────────────────

    def index_book(self, book_id: int, title: str, author: str, description: str):
        """
        Chunk and embed a book description, storing vectors in ChromaDB.
        Called after scraping or when generating insights.
        """
        if not description.strip():
            logger.warning("Book %s has empty description, skipping embedding.", book_id)
            return

        full_text = f"{title} by {author}.\n{description}"
        meta = {"book_id": str(book_id), "title": title, "author": author}
        chunks = self.chunker.chunk(full_text, metadata=meta)

        if not chunks:
            return

        doc_ids = [f"book_{book_id}_chunk_{i}" for i in range(len(chunks))]
        texts = [c["text"] for c in chunks]
        metadatas = [c["metadata"] for c in chunks]

        # Delete old chunks for this book (re-index on update)
        try:
            old_ids = self.collection.get(
                where={"book_id": str(book_id)}
            )["ids"]
            if old_ids:
                self.collection.delete(ids=old_ids)
        except Exception:
            pass

        embeddings = self._embed(texts)

        self.collection.add(
            ids=doc_ids,
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        logger.info("Indexed book %s with %d chunks.", book_id, len(chunks))

    # ── Similarity Search ─────────────────────────────────────────────────────

    def find_similar_books(
        self, query: str, exclude_id: Optional[str] = None, top_k: int = 5
    ) -> list[int]:
        """
        Vector similarity search.
        Returns a list of book IDs (as ints) most similar to the query.
        """
        embeddings = self._embed([query])
        results = self.collection.query(
            query_embeddings=embeddings,
            n_results=top_k + 5,  # fetch extra to account for exclusions
        )

        seen_ids = set()
        book_ids = []

        for meta in results["metadatas"][0]:
            bid = meta.get("book_id")
            if bid and bid != str(exclude_id) and bid not in seen_ids:
                seen_ids.add(bid)
                book_ids.append(int(bid))
            if len(book_ids) >= top_k:
                break

        return book_ids

    # ── Q&A Generation ───────────────────────────────────────────────────────

    def answer_question(
        self, question: str, history: str = "", top_k: int = 3
    ) -> tuple[str, list[dict]]:
        """
        Full RAG Q&A:
        1. Embed question
        2. Retrieve top-k relevant chunks
        3. Build prompt with context + history
        4. Generate answer with LLM
        5. Return answer + source citations
        """
        # Cache check for identical question + history
        cache_key = f"qa_{hashlib.md5((question + history).encode()).hexdigest()}"
        cached = cache.get(cache_key)
        if cached:
            logger.info("Cache hit for Q&A: %s", question[:50])
            return cached["answer"], cached["sources"]

        # Retrieve context
        embeddings = self._embed([question])
        results = self.collection.query(
            query_embeddings=embeddings,
            n_results=top_k,
        )

        context_chunks = results["documents"][0]
        context_metas = results["metadatas"][0]

        # Build deduplicated sources list
        seen_sources = set()
        sources = []
        for meta in context_metas:
            bid = meta.get("book_id")
            if bid and bid not in seen_sources:
                seen_sources.add(bid)
                sources.append(
                    {"book_id": int(bid), "title": meta.get("title", "Unknown")}
                )

        context_text = "\n\n---\n\n".join(context_chunks)

        system_prompt = (
            "You are a knowledgeable book assistant. "
            "Answer questions about books using ONLY the provided context. "
            "If the answer isn't in the context, say so honestly. "
            "Be concise, helpful, and cite specific book titles when relevant."
        )

        user_prompt = (
            f"Context from books:\n{context_text}\n\n"
            + (f"Conversation history:\n{history}\n\n" if history else "")
            + f"Question: {question}"
        )

        client = _get_llm_client()
        response = client.chat.completions.create(
            model=_get_model_name(),
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.3,
            max_tokens=600,
        )

        answer = response.choices[0].message.content.strip()

        # Cache result for 30 minutes
        cache.set(cache_key, {"answer": answer, "sources": sources}, timeout=1800)

        return answer, sources

    # ── AI Insights ──────────────────────────────────────────────────────────

    def generate_summary(self, title: str, description: str) -> str:
        """Generate a concise 3-sentence book summary."""
        client = _get_llm_client()
        prompt = (
            f"Book: {title}\n\nDescription: {description}\n\n"
            "Write a concise 3-sentence summary of this book suitable for a reader deciding whether to read it."
        )
        response = client.chat.completions.create(
            model=_get_model_name(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.4,
            max_tokens=200,
        )
        return response.choices[0].message.content.strip()

    def classify_genre(self, title: str, description: str) -> list[str]:
        """Classify book into 1–3 genres from a fixed taxonomy."""
        client = _get_llm_client()
        prompt = (
            f"Book: {title}\n\nDescription: {description}\n\n"
            "Classify this book into 1 to 3 genres. "
            "Choose ONLY from: Fiction, Non-Fiction, Mystery, Thriller, Romance, "
            "Science Fiction, Fantasy, Historical Fiction, Biography, Self-Help, "
            "Horror, Young Adult, Children, Classics, Business, Science, Philosophy.\n"
            "Return ONLY a comma-separated list, e.g.: Fiction, Mystery"
        )
        response = client.chat.completions.create(
            model=_get_model_name(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=50,
        )
        raw = response.choices[0].message.content.strip()
        return [g.strip() for g in raw.split(",") if g.strip()]

    def analyze_sentiment(self, description: str) -> str:
        """Return tone/sentiment analysis of the book description."""
        client = _get_llm_client()
        prompt = (
            f"Description: {description}\n\n"
            "Analyze the tone and sentiment of this book in 1-2 sentences. "
            "Consider: emotional tone, intended audience mood, and overall atmosphere."
        )
        response = client.chat.completions.create(
            model=_get_model_name(),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=100,
        )
        return response.choices[0].message.content.strip()
