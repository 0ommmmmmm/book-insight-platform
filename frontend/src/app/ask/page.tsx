"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import ChatInterface from "@/components/chat/ChatInterface";

export default function AskPage() {
  const searchParams = useSearchParams();
  const prefillQ     = searchParams.get("q") ?? "";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center space-y-2 py-6">
        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200
                        text-amber-700 text-xs font-mono px-3 py-1.5 rounded-full">
          <Sparkles className="w-3.5 h-3.5" />
          RAG-Powered · ChromaDB · Semantic Search
        </div>
        <h1 className="font-display font-bold text-4xl text-ink">
          Ask the AI
        </h1>
        <p className="text-stone-500 text-sm max-w-md mx-auto">
          Ask questions about any book in your library. The AI searches your
          book descriptions semantically and answers with source citations.
        </p>
      </div>

      {/* Chat */}
      <ChatInterface prefillQuestion={prefillQ} />

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        {[
          { label: "Comparative",  example: "Compare Dune and The Hobbit" },
          { label: "Thematic",     example: "Books about self-improvement" },
          { label: "Specific",     example: "Who wrote Atomic Habits?" },
        ].map(({ label, example }) => (
          <div
            key={label}
            className="bg-cream rounded-xl p-3 border border-cream/80"
          >
            <p className="text-xs font-mono text-amber-600 mb-1">{label}</p>
            <p className="text-stone-500 text-xs">"{example}"</p>
          </div>
        ))}
      </div>
    </div>
  );
}
