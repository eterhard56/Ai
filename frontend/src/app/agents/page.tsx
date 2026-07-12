"use client";

import { useEffect, useState, useCallback } from "react";
import { Bot, Play, Loader2, CheckCircle, XCircle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Agent } from "@/lib/api";

const statusColors: Record<string, string> = {
  running: "bg-green-500/20 text-green-400",
  idle: "bg-blue-500/20 text-blue-400",
  error: "bg-red-500/20 text-red-400",
  disabled: "bg-gray-500/20 text-gray-400",
};

const statusLabels: Record<string, string> = {
  running: "Online",
  idle: "Online",
  error: "Offline",
  disabled: "Отключён",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<{ slug: string; ok: boolean; msg: string } | null>(null);

  const loadAgents = useCallback(() => {
    api.getAgents().then(setAgents).catch(console.error);
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const handleRun = async (slug: string, name: string) => {
    setRunning(slug);
    setResult(null);
    try {
      const res = await api.runAgent(slug);
      setResult({ slug, ok: true, msg: `${name}: задача выполнена` });
      loadAgents();
    } catch (e) {
      setResult({ slug, ok: false, msg: e instanceof Error ? e.message : "Ошибка запуска" });
    } finally {
      setRunning(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 lg:mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold">AI Agents</h1>
        <p className="text-sm text-muted-foreground mt-1">Управление автономными агентами</p>
      </div>

      {result && (
        <div className={`mb-4 flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${result.ok ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {result.ok ? <CheckCircle className="h-4 w-4 shrink-0" /> : <XCircle className="h-4 w-4 shrink-0" />}
          <span className="break-words">{result.msg}</span>
        </div>
      )}

      <div className="grid gap-3 lg:gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="group hover:border-primary/30 transition-all">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-sm lg:text-base">{agent.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">v{agent.version}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[agent.status] || statusColors.idle}`}>
                {statusLabels[agent.status] || agent.status}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>
              <Button
                size="sm"
                className="w-full"
                disabled={running === agent.slug || agent.status === "error"}
                onClick={() => handleRun(agent.slug, agent.name)}
              >
                {running === agent.slug ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Выполняется...</>
                ) : (
                  <><Play className="h-4 w-4" /> Запустить</>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
