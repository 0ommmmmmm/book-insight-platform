import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/ui/Navbar";

export const metadata: Metadata = {
  title: "Book Insight Platform",
  description: "AI-powered book discovery, summaries, and Q&A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-cream mt-16 py-8 text-center text-sm text-stone-500">
          <p>
            Book Insight Platform &mdash; Built with{" "}
            <span className="text-amber-500">♦</span> Django · Next.js · ChromaDB · OpenAI
          </p>
        </footer>
      </body>
    </html>
  );
}
