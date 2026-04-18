"use client";
import Link from "next/link";
import Image from "next/image";
import { ExternalLink } from "lucide-react";
import StarRating from "@/components/ui/StarRating";
import type { Book } from "@/types";

interface BookCardProps {
  book: Book;
  index?: number;
}

const FALLBACK = "https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400&q=80";

export default function BookCard({ book, index = 0 }: BookCardProps) {
  return (
    <article
      className="group bg-white rounded-xl border border-cream hover:border-amber-300
                 hover:shadow-lg transition-all duration-300 overflow-hidden
                 animate-fade-in"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      {/* Cover image */}
      <Link href={`/books/${book.id}`} className="block relative h-52 overflow-hidden bg-cream">
        <Image
          src={book.cover_url || FALLBACK}
          alt={book.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          onError={(e) => {
            (e.target as HTMLImageElement).src = FALLBACK;
          }}
        />
        {/* Genre pill overlay */}
        {book.genres?.[0] && (
          <span className="absolute top-2 left-2 bg-ink/80 text-paper text-xs
                           font-medium px-2 py-0.5 rounded-full">
            {book.genres[0]}
          </span>
        )}
      </Link>

      {/* Content */}
      <div className="p-4 space-y-2">
        <Link href={`/books/${book.id}`}>
          <h3 className="font-display font-bold text-ink line-clamp-2
                         leading-snug hover:text-amber-600 transition-colors">
            {book.title}
          </h3>
        </Link>

        <p className="text-sm text-stone-500">{book.author}</p>

        <StarRating rating={book.rating} size="sm" />

        <p className="text-xs text-stone-400 line-clamp-3 leading-relaxed">
          {book.description || "No description available."}
        </p>

        {/* Footer */}
        <div className="pt-2 flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {book.genres?.slice(0, 2).map((g) => (
              <span
                key={g}
                className="bg-cream text-stone-600 text-xs px-2 py-0.5 rounded-full"
              >
                {g}
              </span>
            ))}
          </div>
          <a
            href={book.book_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-stone-400 hover:text-amber-500 transition-colors"
            title="Open source"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </article>
  );
}
