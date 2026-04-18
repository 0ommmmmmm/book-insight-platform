"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, BookOpen, Loader2, Trash2 } from "lucide-react";
import clsx from "clsx";
import { askQuestion, deleteSession } from "@/lib/api";
import type { ChatMessage, ChatSource } from "@/types";

interface ChatInterfaceProps {
  prefillQuestion?: string;
}

export default function ChatInterface({ prefillQuestion = "" }: ChatInterfaceProps) {
  const [messages, setMessages]   = useState<ChatMessage[]>([]);
  const [input, setInput]         = useState(prefillQuestion);
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [error, setError]         = useState<string | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    setError(null);
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "", sources: [] }]);

    try {
      const res = await askQuestion(q, sessionId, 3);
      setSessionId(res.session_id);
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: res.answer, sources: res.sources };
        return updated;
      });
    } catch {
      setError("Could not reach AI service. Is the backend running?");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setLoading(false);
    }
  };

  const clearChat = async () => {
    if (sessionId) { try { await deleteSession(sessionId); } catch (_) {} }
    setMessages([]); setSessionId(undefined); setError(null);
  };

  return (
    <div className="flex flex-col h-[70vh] bg-white rounded-2xl border border-cream shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-cream bg-cream/30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-ink rounded-md flex items-center justify-center">
            <Bot className="w-4 h-4 text-paper" />
          </div>
          <div>
            <p className="font-medium text-sm text-ink">Book AI Assistant</p>
            <p className="text-xs text-stone-400">RAG-powered · Semantic search · Cited sources</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={clearChat} className="text-stone-400 hover:text-red-400 transition-colors p-1 rounded" title="Clear">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && <WelcomePrompts onSelect={setInput} />}
        {messages.map((msg, i) => (
          <MessageBubble key={i} message={msg} isLoading={loading && i === messages.length - 1 && msg.role === "assistant"} />
        ))}
        {error && <div className="text-center text-sm text-red-500 bg-red-50 rounded-lg py-2 px-4">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-4 border-t border-cream bg-cream/20">
        <div className="flex gap-3 items-end">
          <textarea
            className="flex-1 resize-none bg-white border border-cream rounded-xl px-4 py-3 text-sm text-ink placeholder-stone-400 focus:outline-none focus:border-amber-400 transition-colors min-h-[44px] max-h-32"
            placeholder="Ask about any book…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={1}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="w-10 h-10 rounded-xl bg-ink text-paper flex items-center justify-center hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-2 pl-1">
          Enter to send · Shift+Enter for newline
          {sessionId && <span className="ml-3 font-mono text-stone-300">#{sessionId.slice(0, 8)}</span>}
        </p>
      </div>
    </div>
  );
}

function MessageBubble({ message, isLoading }: { message: ChatMessage; isLoading: boolean }) {
  const isUser = message.role === "user";
  return (
    <div className={clsx("flex gap-3 animate-slide-up", isUser && "flex-row-reverse")}>
      <div className={clsx("w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-1", isUser ? "bg-amber-500" : "bg-ink")}>
        {isUser ? <User className="w-3.5 h-3.5 text-white" /> : <Bot className="w-3.5 h-3.5 text-paper" />}
      </div>
      <div className={clsx("max-w-[75%] space-y-2", isUser && "items-end flex flex-col")}>
        <div className={clsx("rounded-2xl px-4 py-3 text-sm leading-relaxed", isUser ? "bg-ink text-paper rounded-tr-sm" : "bg-cream text-ink rounded-tl-sm")}>
          {isLoading ? (
            <span className="flex items-center gap-1.5">
              {[0, 150, 300].map((d) => <span key={d} className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
            </span>
          ) : message.content}
        </div>
        {!isUser && message.sources && message.sources.length > 0 && <Sources sources={message.sources} />}
      </div>
    </div>
  );
}

function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 pl-1">
      <span className="text-xs text-stone-400 self-center">Sources:</span>
      {sources.map((src) => (
        <a key={src.book_id} href={`/books/${src.book_id}`}
          className="flex items-center gap-1 text-xs bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-2.5 py-0.5 hover:bg-amber-100 transition-colors">
          <BookOpen className="w-3 h-3" />{src.title}
        </a>
      ))}
    </div>
  );
}

function WelcomePrompts({ onSelect }: { onSelect: (q: string) => void }) {
  const prompts = ["What is Dune about?", "Recommend a good fantasy book", "Which books have the highest rating?", "Tell me about atomic habits"];
  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 py-8">
      <div className="text-center">
        <Bot className="w-12 h-12 text-stone-300 mx-auto mb-3" />
        <p className="font-display font-bold text-lg text-ink">Ask me anything</p>
        <p className="text-sm text-stone-400 mt-1">I search your book library semantically and cite my sources.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
        {prompts.map((p) => (
          <button key={p} onClick={() => onSelect(p)}
            className="text-left text-sm bg-cream hover:bg-amber-50 border border-cream hover:border-amber-200 text-stone-600 rounded-xl px-4 py-2.5 transition-all duration-150">
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
