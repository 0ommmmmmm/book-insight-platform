/**
 * Centralized API client.
 * All backend calls go through here — easy to swap base URL in env.
 */

import axios from "axios";
import type {
  Book,
  PaginatedBooks,
  AskResponse,
  ChatSession,
  ScrapeJob,
  TaskStatus,
} from "@/types";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// ── Books ──────────────────────────────────────────────────────────────────

export const fetchBooks = async (params?: {
  search?: string;
  page?: number;
  page_size?: number;
  min_rating?: number;
  author?: string;
}): Promise<PaginatedBooks> => {
  const { data } = await api.get<PaginatedBooks>("/books/", { params });
  return data;
};

export const fetchBook = async (id: number): Promise<Book> => {
  const { data } = await api.get<Book>(`/books/${id}/`);
  return data;
};

export const fetchRecommendations = async (
  id: number,
  top_k = 4
): Promise<Book[]> => {
  const { data } = await api.get<Book[]>(`/recommend/${id}/`, { params: { top_k } });
  return data;
};

// ── Scraping ───────────────────────────────────────────────────────────────

export const uploadBook = async (url: string, generateInsights = true) => {
  const { data } = await api.post("/upload-book/", {
    url,
    generate_insights: generateInsights,
  });
  return data;
};

export const bulkScrape = async (urls: string[], generateInsights = true) => {
  const { data } = await api.post<{ message: string; job_id: number }>(
    "/bulk-scrape/",
    { urls, generate_insights: generateInsights }
  );
  return data;
};

export const fetchScrapeStatus = async (jobId: number): Promise<ScrapeJob> => {
  const { data } = await api.get<ScrapeJob>(`/scrape-status/${jobId}/`);
  return data;
};

export const fetchTaskStatus = async (taskId: string): Promise<TaskStatus> => {
  const { data } = await api.get<TaskStatus>(`/task-status/${taskId}/`);
  return data;
};

// ── RAG Q&A ────────────────────────────────────────────────────────────────

export const askQuestion = async (
  question: string,
  sessionId?: string,
  top_k = 3
): Promise<AskResponse> => {
  const { data } = await api.post<AskResponse>("/ask/", {
    question,
    session_id: sessionId,
    top_k,
  });
  return data;
};

// ── Chat Sessions ──────────────────────────────────────────────────────────

export const fetchSessions = async (): Promise<ChatSession[]> => {
  const { data } = await api.get<ChatSession[]>("/sessions/");
  return data;
};

export const fetchSession = async (sessionId: string): Promise<ChatSession> => {
  const { data } = await api.get<ChatSession>(`/sessions/${sessionId}/`);
  return data;
};

export const deleteSession = async (sessionId: string): Promise<void> => {
  await api.delete(`/sessions/${sessionId}/`);
};

// ── Embedding ──────────────────────────────────────────────────────────────

export const embedBook = async (bookId: number) => {
  const { data } = await api.post(`/embed/${bookId}/`);
  return data;
};

export default api;
