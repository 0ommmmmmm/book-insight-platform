"use client";
import { useState } from "react";
import {
  Upload, Link2, ListPlus, CheckCircle2,
  AlertCircle, Loader2, ArrowRight
} from "lucide-react";
import {
  uploadBook, bulkScrape, fetchTaskStatus, fetchScrapeStatus
} from "@/lib/api";
import type { ScrapeJob } from "@/types";

type Tab = "single" | "bulk";

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>("single");

  return (
    <div className="max-w-2xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="text-center space-y-2 py-6">
        <h1 className="font-display font-bold text-4xl text-ink">Add Books</h1>
        <p className="text-stone-500 text-sm">
          Paste a book URL to scrape metadata automatically using Selenium.
          <br />
          Works with <span className="text-amber-600">books.toscrape.com</span> and{" "}
          <span className="text-amber-600">openlibrary.org</span>.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-cream rounded-xl p-1 gap-1">
        {(["single", "bulk"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm
                        font-medium rounded-lg transition-all duration-150 ${
                          tab === t
                            ? "bg-white shadow-sm text-ink"
                            : "text-stone-500 hover:text-ink"
                        }`}
          >
            {t === "single" ? (
              <><Link2 className="w-4 h-4" /> Single URL</>
            ) : (
              <><ListPlus className="w-4 h-4" /> Bulk Scrape</>
            )}
          </button>
        ))}
      </div>

      {/* Forms */}
      <div className="bg-white rounded-2xl border border-cream p-6 shadow-sm">
        {tab === "single" ? (
          <SingleUpload />
        ) : (
          <BulkUpload />
        )}
      </div>

      {/* Supported sites notice */}
      <div className="bg-cream rounded-xl p-4 text-sm text-stone-500 space-y-1">
        <p className="font-medium text-ink text-xs uppercase tracking-wider font-mono mb-2">
          Supported URL formats
        </p>
        <p>🟢 <code className="text-xs bg-white px-1.5 py-0.5 rounded">https://books.toscrape.com/catalogue/...</code></p>
        <p>🟢 <code className="text-xs bg-white px-1.5 py-0.5 rounded">https://openlibrary.org/works/...</code></p>
        <p>🟡 Any URL with Open Graph meta tags (generic fallback)</p>
      </div>
    </div>
  );
}

// ── Single URL upload ─────────────────────────────────────────────────────

function SingleUpload() {
  const [url, setUrl]           = useState("");
  const [insights, setInsights] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [taskId, setTaskId]     = useState<string | null>(null);
  const [status, setStatus]     = useState<"idle"|"polling"|"done"|"error">("idle");
  const [result, setResult]     = useState<Record<string, unknown> | null>(null);

  const submit = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setStatus("idle");
    setResult(null);
    try {
      const res = await uploadBook(url.trim(), insights);
      if (res.task_id) {
        setTaskId(res.task_id);
        setStatus("polling");
        pollTask(res.task_id);
      } else {
        // Already exists
        setStatus("done");
        setResult(res);
      }
    } catch (e: unknown) {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  };

  const pollTask = (tid: string) => {
    const interval = setInterval(async () => {
      try {
        const s = await fetchTaskStatus(tid);
        if (s.status === "SUCCESS") {
          clearInterval(interval);
          setStatus("done");
          setResult(s.result);
        } else if (s.status === "FAILURE") {
          clearInterval(interval);
          setStatus("error");
          setResult(s.result);
        }
      } catch {
        clearInterval(interval);
        setStatus("error");
      }
    }, 2000);
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink block">Book URL</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://books.toscrape.com/catalogue/the-great-gatsby_..."
          className="w-full border border-cream rounded-xl px-4 py-3 text-sm
                     focus:outline-none focus:border-amber-400 transition-colors"
        />
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={insights}
          onChange={(e) => setInsights(e.target.checked)}
          className="w-4 h-4 rounded accent-amber-500"
        />
        <span className="text-sm text-stone-600">
          Generate AI insights (summary, genre, sentiment)
        </span>
      </label>

      <button
        onClick={submit}
        disabled={!url.trim() || loading || status === "polling"}
        className="w-full flex items-center justify-center gap-2 bg-ink text-paper
                   py-3 rounded-xl font-medium text-sm hover:bg-amber-500
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading || status === "polling" ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Scraping…</>
        ) : (
          <><Upload className="w-4 h-4" /> Scrape & Add Book</>
        )}
      </button>

      {/* Status feedback */}
      <StatusFeedback status={status} result={result} />
    </div>
  );
}

// ── Bulk upload ───────────────────────────────────────────────────────────

function BulkUpload() {
  const [rawUrls, setRawUrls]   = useState("");
  const [insights, setInsights] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [job, setJob]           = useState<ScrapeJob | null>(null);
  const [polling, setPolling]   = useState(false);

  const submit = async () => {
    const urls = rawUrls
      .split("\n")
      .map((u) => u.trim())
      .filter((u) => u.startsWith("http"));

    if (urls.length === 0) return;
    setLoading(true);
    try {
      const res = await bulkScrape(urls, insights);
      pollJob(res.job_id);
    } catch {
      setLoading(false);
    }
  };

  const pollJob = (jobId: number) => {
    setPolling(true);
    setLoading(false);
    const interval = setInterval(async () => {
      try {
        const j = await fetchScrapeStatus(jobId);
        setJob(j);
        if (j.status === "done" || j.status === "failed") {
          clearInterval(interval);
          setPolling(false);
        }
      } catch {
        clearInterval(interval);
        setPolling(false);
      }
    }, 3000);
  };

  const urlCount = rawUrls
    .split("\n")
    .filter((u) => u.trim().startsWith("http")).length;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="text-sm font-medium text-ink block">
          Book URLs{" "}
          <span className="text-stone-400 font-normal">(one per line, max 50)</span>
        </label>
        <textarea
          rows={8}
          value={rawUrls}
          onChange={(e) => setRawUrls(e.target.value)}
          placeholder={"https://books.toscrape.com/catalogue/book-1\nhttps://books.toscrape.com/catalogue/book-2\n..."}
          className="w-full border border-cream rounded-xl px-4 py-3 text-sm font-mono
                     focus:outline-none focus:border-amber-400 transition-colors resize-none"
        />
        {urlCount > 0 && (
          <p className="text-xs text-amber-600">{urlCount} valid URL{urlCount !== 1 ? "s" : ""} detected</p>
        )}
      </div>

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={insights}
          onChange={(e) => setInsights(e.target.checked)}
          className="w-4 h-4 rounded accent-amber-500"
        />
        <span className="text-sm text-stone-600">Generate AI insights for each book</span>
      </label>

      <button
        onClick={submit}
        disabled={urlCount === 0 || loading || polling}
        className="w-full flex items-center justify-center gap-2 bg-ink text-paper
                   py-3 rounded-xl font-medium text-sm hover:bg-amber-500
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading || polling ? (
          <><Loader2 className="w-4 h-4 animate-spin" />
            {polling ? "Processing…" : "Starting…"}
          </>
        ) : (
          <><ListPlus className="w-4 h-4" /> Bulk Scrape {urlCount > 0 ? `${urlCount} Books` : ""}</>
        )}
      </button>

      {/* Job status */}
      {job && <JobProgress job={job} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatusFeedback({
  status,
  result,
}: {
  status: string;
  result: Record<string, unknown> | null;
}) {
  if (status === "idle") return null;

  if (status === "polling") {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50
                      rounded-xl px-4 py-3 animate-pulse-slow">
        <Loader2 className="w-4 h-4 animate-spin" />
        Scraping in background — this may take 15–30 seconds…
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="flex items-start gap-2 text-sm text-green-700 bg-green-50
                      rounded-xl px-4 py-3 animate-fade-in">
        <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Book added successfully!</p>
          {result?.book_id && (
            <a
              href={`/books/${result.book_id}`}
              className="text-green-600 hover:underline inline-flex items-center gap-1 mt-1"
            >
              View book <ArrowRight className="w-3 h-3" />
            </a>
          )}
          {result?.message && <p className="text-green-600">{result.message as string}</p>}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50
                      rounded-xl px-4 py-3 animate-fade-in">
        <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium">Scraping failed.</p>
          <p className="text-red-500 text-xs mt-0.5">
            Check the URL and ensure the backend + Celery are running.
          </p>
        </div>
      </div>
    );
  }

  return null;
}

function JobProgress({ job }: { job: ScrapeJob }) {
  const total   = job.urls.length;
  const done    = job.books_scraped + job.books_failed;
  const pct     = total > 0 ? Math.round((done / total) * 100) : 0;
  const running = job.status === "running" || job.status === "pending";

  return (
    <div className="bg-cream rounded-xl p-4 space-y-3 animate-fade-in">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-ink">
          {running ? "Processing…" : job.status === "done" ? "Complete!" : "Failed"}
        </span>
        <span className="text-stone-500 font-mono text-xs">{pct}%</span>
      </div>
      <div className="w-full bg-stone-200 rounded-full h-2 overflow-hidden">
        <div
          className="h-2 bg-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-stone-500">
        <span className="text-green-600">✓ {job.books_scraped} scraped</span>
        <span className="text-red-500">✗ {job.books_failed} failed</span>
        <span>{total} total</span>
      </div>
      {job.status === "done" && (
        <a
          href="/"
          className="inline-flex items-center gap-1 text-sm text-amber-600 hover:underline"
        >
          View library <ArrowRight className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
