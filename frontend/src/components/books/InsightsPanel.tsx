"use client";
import { useState } from "react";
import { Sparkles, BookOpenCheck, BarChart2, Tags, ChevronDown } from "lucide-react";
import type { AIInsight } from "@/types";
import clsx from "clsx";

interface InsightsPanelProps {
  insights: AIInsight[];
}

const iconMap: Record<string, React.ReactNode> = {
  summary:   <BookOpenCheck className="w-4 h-4" />,
  genre:     <Tags className="w-4 h-4" />,
  sentiment: <BarChart2 className="w-4 h-4" />,
  keywords:  <Sparkles className="w-4 h-4" />,
};

const labelMap: Record<string, string> = {
  summary:   "AI Summary",
  genre:     "Genre Classification",
  sentiment: "Tone & Sentiment",
  keywords:  "Key Themes",
};

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  const [open, setOpen] = useState<string | null>("summary");

  if (!insights || insights.length === 0) {
    return (
      <div className="bg-cream/50 rounded-xl border border-cream p-6 text-center">
        <Sparkles className="w-8 h-8 text-stone-300 mx-auto mb-2" />
        <p className="text-sm text-stone-400">
          AI insights are being generated in the background…
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 overflow-hidden bg-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-3
                      border-b border-amber-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="font-display font-bold text-sm text-amber-800">
          AI-Generated Insights
        </h3>
      </div>

      {/* Accordion items */}
      <div className="divide-y divide-cream">
        {insights.map((insight) => (
          <div key={insight.insight_type}>
            <button
              onClick={() =>
                setOpen(open === insight.insight_type ? null : insight.insight_type)
              }
              className="w-full flex items-center justify-between px-5 py-3
                         hover:bg-cream/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <span className="text-amber-500">
                  {iconMap[insight.insight_type] ?? <Sparkles className="w-4 h-4" />}
                </span>
                {labelMap[insight.insight_type] ?? insight.insight_type}
              </div>
              <ChevronDown
                className={clsx(
                  "w-4 h-4 text-stone-400 transition-transform duration-200",
                  open === insight.insight_type && "rotate-180"
                )}
              />
            </button>
            {open === insight.insight_type && (
              <div className="px-5 pb-4 text-sm text-stone-600 leading-relaxed
                              prose-book animate-fade-in">
                {insight.content}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
