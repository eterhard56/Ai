"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Bot, Target, BarChart3, Search, Users,
  ScanSearch, MessageSquare, ScrollText, Settings, Sparkles, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/agents", label: "AI Agents", icon: Bot },
  { href: "/direct", label: "Yandex Direct", icon: Target },
  { href: "/metrika", label: "Yandex Metrika", icon: BarChart3 },
  { href: "/seo", label: "SEO", icon: Search },
  { href: "/crm", label: "CRM", icon: Users },
  { href: "/parser", label: "Parser", icon: ScanSearch },
  { href: "/telegram", label: "Telegram", icon: MessageSquare },
  { href: "/chat", label: "AI Chat", icon: Sparkles },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 border-r border-border/50 bg-card/80 backdrop-blur-xl">
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-border/50 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/20">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-sm font-bold gradient-text">AI Platform</h1>
            <p className="text-[10px] text-muted-foreground">Local Agents</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/50 p-4">
          <button
            onClick={() => { api.clearToken(); window.location.href = "/login"; }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all"
          >
            <LogOut className="h-4 w-4" />
            Выйти
          </button>
        </div>
      </div>
    </aside>
  );
}
