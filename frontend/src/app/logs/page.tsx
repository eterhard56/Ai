"use client";

import { useEffect, useState } from "react";
import { ScrollText } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent } from "@/components/ui/card";
import { api, type LogEntry } from "@/lib/api";

const levelColors: Record<string, string> = {
  info: "text-blue-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

export default function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    api.getLogs().then(setLogs).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-primary" />
          Logs
        </h1>
        <p className="text-muted-foreground mt-1">Логи агентов и мониторинг ошибок</p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-2 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Нет логов</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="flex gap-4 rounded-lg bg-muted/20 px-4 py-2">
                <span className="text-muted-foreground shrink-0">{new Date(log.created_at).toLocaleString("ru")}</span>
                <span className="text-primary shrink-0">[{log.agent_slug}]</span>
                <span className={`shrink-0 ${levelColors[log.level] || ""}`}>{log.level}</span>
                <span className="truncate">{log.message}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
