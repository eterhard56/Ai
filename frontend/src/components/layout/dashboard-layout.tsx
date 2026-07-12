"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Menu, Bot } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/agents": "AI Agents",
  "/direct": "Yandex Direct",
  "/metrika": "Yandex Metrika",
  "/seo": "SEO",
  "/crm": "CRM",
  "/parser": "Parser",
  "/telegram": "Telegram",
  "/chat": "AI Chat",
  "/logs": "Logs",
  "/settings": "Settings",
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const title = Object.entries(pageTitles).find(([path]) =>
    pathname === path || pathname.startsWith(path + "/")
  )?.[1] ?? "AI Platform";

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mobileOpen={menuOpen} onClose={() => setMenuOpen(false)} />

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 lg:hidden safe-top">
        <button
          onClick={() => setMenuOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/50 active:scale-95 transition-transform"
          aria-label="Открыть меню"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-base font-semibold truncate">{title}</h1>
        </div>
      </header>

      <main className="min-h-screen lg:ml-64">
        <div className="px-4 py-4 pb-24 lg:p-8 lg:pb-8 animate-fade-in max-w-7xl mx-auto">
          {children}
        </div>
      </main>

      <BottomNav onMenuOpen={() => setMenuOpen(true)} />
    </div>
  );
}
