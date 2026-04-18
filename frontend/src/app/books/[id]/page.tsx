"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, ExternalLink, BookOpen, Calendar,
  FileText, Cpu, Star
} from "lucide-react";
import { fetchBook, fetchRecommendations, embedBook } from "@/lib/api";
import { BookDetailSkeleton } from "@/components/ui/Skeleton";
import InsightsPanel from "@/components/books/InsightsPanel";
import StarRating from "@/components/ui/StarRating";
import BookCard from "@/components/books/BookCard";
import type { Book } from "@/types";

const FALLBACK = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80";

export default function BookDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [book, setBook]         = useState<Book | null>(null);
  const [recs, setRecs]         = useState<Book[]>([]);
  const [loading, setLoading]   = useState(true);
  const [embedding, setEmbedding] = useState(false);
  const [embedMsg, setEmbedMsg] = useState("");

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const [bookData, recData] = await Promise.all([
          fetchBook(Number(id)),
          fetchRecommendations(Number(id), 4),
        ]);
        setBook(bookData);
        setRecs(recData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleEmbed = async () => {
    if (!book) return;
    setEmbedding(true);
    try {
      await embedBook(book.id);
      setEmbedMsg("✓ Embedded — recommendations will improve!");
      setBook({ ...book, is_embedded: true });
    } catch {
      setEmbedMsg("Embedding failed. Check AI service.");
    } finally {
      setEmbedding(false);
    }
  };

  if (loading) return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <BookDetailSkeleton />
    </div>
  );

  if (!book) return (
    <div className="text-center py-24">
      <p className="text-stone-400">Book not found.</p>
      <Link href="/" className="text-amber-500 text-sm mt-2 inline-block hover:underline">
        ← Back to library
      </Link>
    </div>
  );

  const summary = book.insights?.find((i) => i.insight_type === "summary");

  return (
    <div className="max-w-5xl mx-auto space-y-10 pb-16">
      {/* Back */}
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500
                   hover:text-ink transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to library
      </Link>

      {/* Hero section */}
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8">
        {/* Cover */}
        <div className="relative w-full md:w-[200px] h-72 md:h-80 rounded-2xl overflow-hidden
                        shadow-xl flex-shrink-0 bg-cream">
          <Image
            src={book.cover_url || FALLBACK}
            alt={book.title}
            fill
            className="object-cover"
            sizes="200px"
            onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
          />
        </div>

        {/* Meta */}
        <div className="space-y-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {book.genres?.map((g) => (
                <span
                  key={g}
                  className="bg-amber-50 border border-amber-200 text-amber-700
                             text-xs font-medium px-2.5 py-0.5 rounded-full"
                >
                  {g}
                </span>
              ))}
            </div>
            <h1 className="font-display font-bold text-3xl sm:text-4xl text-ink leading-tight">
              {book.title}
            </h1>
            <p className="text-stone-500 text-lg mt-1">by {book.author}</p>
          </div>

          <StarRating rating={book.rating} />

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 text-sm text-stone-500">
            {book.pages && (
              <span className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-stone-400" />
                {book.pages} pages
              </span>
            )}
            {book.published_year && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-stone-400" />
                {book.published_year}
              </span>
            )}
            <span className="flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-stone-400" />
              {book.is_embedded ? (
                <span className="text-green-600">Embedded ✓</span>
              ) : (
                <span className="text-stone-400">Not embedded</span>
              )}
            </span>
          </div>

          {/* AI summary callout */}
          {summary && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-mono text-amber-600 uppercase tracking-wider mb-1">
                AI Summary
              </p>
              <p className="text-sm text-stone-700 leading-relaxed">{summary.content}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href={book.book_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-ink text-paper
                         text-sm font-medium px-4 py-2.5 rounded-xl
                         hover:bg-amber-500 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              View Source
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>

            {!book.is_embedded && (
              <button
                onClick={handleEmbed}
                disabled={embedding}
                className="inline-flex items-center gap-2 bg-cream border border-stone-300
                           text-sm font-medium px-4 py-2.5 rounded-xl
                           hover:border-amber-400 disabled:opacity-50 transition-colors"
              >
                <Cpu className="w-4 h-4" />
                {embedding ? "Embedding…" : "Generate Embeddings"}
              </button>
            )}

            <Link
              href={`/ask?q=Tell me about "${book.title}"`}
              className="inline-flex items-center gap-2 border border-cream text-stone-600
                         text-sm font-medium px-4 py-2.5 rounded-xl
                         hover:border-amber-400 hover:text-ink transition-colors"
            >
              <Star className="w-4 h-4" /> Ask AI
            </Link>
          </div>

          {embedMsg && (
            <p className="text-sm text-green-600 animate-fade-in">{embedMsg}</p>
          )}
        </div>
      </div>

      {/* Description */}
      {book.description && (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-xl text-ink">Description</h2>
          <p className="prose-book text-stone-600 leading-relaxed">{book.description}</p>
        </section>
      )}

      {/* AI Insights */}
      {book.insights && (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-xl text-ink">AI Insights</h2>
          <InsightsPanel insights={book.insights} />
        </section>
      )}

      {/* Similar books */}
      {recs.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display font-bold text-xl text-ink">Similar Books</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {recs.map((rec, i) => (
              <BookCard key={rec.id} book={rec} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
