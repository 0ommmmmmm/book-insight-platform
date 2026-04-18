"use client";
import { useState, useEffect, useCallback } from "react";
import { Search, SlidersHorizontal, Library } from "lucide-react";
import BookCard from "@/components/books/BookCard";
import { BookCardSkeleton } from "@/components/ui/Skeleton";
import { fetchBooks } from "@/lib/api";
import type { Book, PaginatedBooks } from "@/types";
import { useDebounce } from "@/lib/hooks";

export default function DashboardPage() {
  const [data, setData]         = useState<PaginatedBooks | null>(null);
  const [search, setSearch]     = useState("");
  const [minRating, setMinRating] = useState("");
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const debouncedSearch         = useDebounce(search, 400);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchBooks({
        search: debouncedSearch || undefined,
        min_rating: minRating ? parseFloat(minRating) : undefined,
        page,
        page_size: 12,
      });
      setData(res);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, minRating, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [debouncedSearch, minRating]);

  const books: Book[] = data?.results ?? [];
  const totalPages    = data ? Math.ceil(data.count / 12) : 1;

  return (
    <div className="space-y-8">

      {/* Hero header */}
      <div className="text-center py-10 space-y-2">
        <p className="text-xs font-mono tracking-widest text-amber-500 uppercase">
          AI-Powered
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-ink">
          Your Book Library
        </h1>
        <p className="text-stone-500 max-w-md mx-auto text-sm">
          Explore books with AI-generated summaries, genre classification, and semantic Q&amp;A.
        </p>
      </div>

      {/* Search & filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center
                      bg-white border border-cream rounded-2xl p-4 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by title or author…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-cream bg-cream/50
                       text-sm text-ink placeholder-stone-400
                       focus:outline-none focus:border-amber-400 transition-colors"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-stone-400 flex-shrink-0" />
          <select
            className="border border-cream bg-cream/50 rounded-xl px-3 py-2.5 text-sm
                       text-ink focus:outline-none focus:border-amber-400 transition-colors"
            value={minRating}
            onChange={(e) => setMinRating(e.target.value)}
          >
            <option value="">All Ratings</option>
            <option value="3">3+ ★</option>
            <option value="3.5">3.5+ ★</option>
            <option value="4">4+ ★</option>
            <option value="4.5">4.5+ ★</option>
          </select>
        </div>
        {data && (
          <p className="text-xs text-stone-400 whitespace-nowrap">
            {data.count} book{data.count !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {[...Array(12)].map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      ) : books.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {books.map((book, i) => (
            <BookCard key={book.id} book={book} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg border border-cream text-sm disabled:opacity-40
                       hover:border-amber-300 transition-colors"
          >
            ← Previous
          </button>
          <span className="text-sm text-stone-500">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg border border-cream text-sm disabled:opacity-40
                       hover:border-amber-300 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24 space-y-3">
      <Library className="w-14 h-14 text-stone-200 mx-auto" />
      <p className="font-display text-xl text-stone-400">No books found</p>
      <p className="text-sm text-stone-400">
        Try a different search, or{" "}
        <a href="/upload" className="text-amber-500 hover:underline">add some books</a>.
      </p>
    </div>
  );
}
