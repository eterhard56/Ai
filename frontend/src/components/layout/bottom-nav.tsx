"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, ScanSearch, Users, Menu } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/chat", label: "Чат", icon: Sparkles },
  { href: "/parser", label: "Парсер", icon: ScanSearch },
  { href: "/crm", label: "CRM", icon: Users },
];

interface BottomNavProps {
  onMenuOpen: () => void;
}

export function BottomNav({ onMenuOpen }: BottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-card/90 backdrop-blur-xl lg:hidden safe-bottom">
      <div className="flex items-center justify-around px-1 pt-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 px-1 transition-all active:scale-95",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]")} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </Link>
          );
        })}
        <button
          onClick={onMenuOpen}
          className="flex flex-1 flex-col items-center gap-0.5 rounded-xl py-2 px-1 text-muted-foreground transition-all active:scale-95"
        >
          <Menu className="h-5 w-5" />
          <span className="text-[10px] font-medium">Меню</span>
        </button>
      </div>
    </nav>
  );
}
