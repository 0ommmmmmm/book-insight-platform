"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, MessageSquare, Upload, LayoutDashboard } from "lucide-react";
import clsx from "clsx";

const navItems = [
  { href: "/",        label: "Library",  icon: LayoutDashboard },
  { href: "/ask",     label: "Ask AI",   icon: MessageSquare },
  { href: "/upload",  label: "Add Book", icon: Upload },
];

export default function Navbar() {
  const path = usePathname();

  return (
    <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur-sm border-b border-cream">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 bg-ink rounded-sm flex items-center justify-center
                          group-hover:bg-amber-500 transition-colors duration-200">
            <BookOpen className="w-4 h-4 text-paper" />
          </div>
          <span className="font-display font-bold text-lg text-ink leading-none">
            Book<span className="text-amber-500">Insight</span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150",
                path === href
                  ? "bg-ink text-paper"
                  : "text-stone-600 hover:bg-cream hover:text-ink"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
