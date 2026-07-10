"use client";

import { useEffect, useState } from "react";
import { Bot, Play, Pause } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Agent } from "@/lib/api";

const statusColors: Record<string, string> = {
  idle: "bg-green-500/20 text-green-400",
  running: "bg-blue-500/20 text-blue-400",
  error: "bg-red-500/20 text-red-400",
  disabled: "bg-gray-500/20 text-gray-400",
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    api.getAgents().then(setAgents).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Agents</h1>
          <p className="text-muted-foreground mt-1">Управление автономными агентами</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((agent) => (
          <Card key={agent.id} className="group hover:border-primary/30 transition-all">
            <CardHeader className="flex flex-row items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base">{agent.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">v{agent.version}</p>
                </div>
              </div>
              <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColors[agent.status] || statusColors.idle}`}>
                {agent.status}
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{agent.description}</p>
              {agent.is_plugin && (
                <span className="inline-block rounded bg-violet-500/20 px-2 py-0.5 text-xs text-violet-400 mb-3">Plugin</span>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="secondary"><Play className="h-3 w-3" /> Запуск</Button>
                <Button size="sm" variant="ghost"><Pause className="h-3 w-3" /> Стоп</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
