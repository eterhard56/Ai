"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bot, AlertTriangle, Users, ScanSearch, TrendingUp, Activity } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type DashboardStats } from "@/lib/api";

const statCards = [
  { key: "total_agents", label: "Агенты", icon: Bot, color: "text-blue-400" },
  { key: "pending_recommendations", label: "Рекомендации", icon: AlertTriangle, color: "text-amber-400" },
  { key: "total_clients", label: "Клиенты", icon: Users, color: "text-green-400" },
  { key: "parser_results", label: "Парсинг", icon: ScanSearch, color: "text-violet-400" },
  { key: "total_leads", label: "Лиды", icon: TrendingUp, color: "text-cyan-400" },
  { key: "recent_errors", label: "Ошибки", icon: Activity, color: "text-red-400" },
] as const;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Обзор AI Platform</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:gap-4 lg:grid-cols-3">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div key={card.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.label}</CardTitle>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="text-2xl lg:text-3xl font-bold">{stats ? stats[card.key] : "—"}</div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Статус системы</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {["Ollama (qwen3:8b)", "PostgreSQL", "Redis", "Celery"].map((s) => (
              <div key={s} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                <span className="text-sm">{s}</span>
                <span className="flex items-center gap-2 text-xs text-green-400">
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  Active
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Быстрые действия</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Анализ Яндекс Директ", href: "/direct" },
              { label: "SEO аудит", href: "/seo" },
              { label: "AI Chat", href: "/chat" },
              { label: "Запуск парсера", href: "/parser" },
            ].map((a) => (
              <a key={a.href} href={a.href} className="block rounded-lg bg-muted/30 px-4 py-3 text-sm hover:bg-primary/10 hover:text-primary transition-all">
                {a.label} →
              </a>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
