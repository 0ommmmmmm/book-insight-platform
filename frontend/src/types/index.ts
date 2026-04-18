// ── Book types ─────────────────────────────────────────────────────────────

export interface AIInsight {
  insight_type: "summary" | "genre" | "sentiment" | "keywords";
  content: string;
  model_used: string;
  created_at: string;
}

export interface Book {
  id: number;
  title: string;
  author: string;
  rating: number | null;
  description: string;
  book_url: string;
  cover_url: string;
  genres: string[];
  pages: number | null;
  published_year: number | null;
  is_embedded: boolean;
  created_at: string;
  insights?: AIInsight[];
}

export interface PaginatedBooks {
  count: number;
  next: string | null;
  previous: string | null;
  results: Book[];
}

// ── Chat types ─────────────────────────────────────────────────────────────

export interface ChatSource {
  book_id: number;
  title: string;
}

export interface ChatMessage {
  id?: number;
  role: "user" | "assistant";
  content: string;
  sources?: ChatSource[];
  created_at?: string;
}

export interface ChatSession {
  session_id: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface AskResponse {
  session_id: string;
  answer: string;
  sources: ChatSource[];
}

// ── Scrape types ──────────────────────────────────────────────────────────

export interface ScrapeJob {
  id: number;
  task_id: string;
  urls: string[];
  status: "pending" | "running" | "done" | "failed";
  books_scraped: number;
  books_failed: number;
  error_log: string;
  created_at: string;
}

export interface TaskStatus {
  task_id: string;
  status: "PENDING" | "STARTED" | "SUCCESS" | "FAILURE" | "RETRY";
  result: Record<string, unknown> | null;
}
