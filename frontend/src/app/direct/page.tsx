"use client";

import { useEffect, useState } from "react";
import { Target, Check, X } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api, type Recommendation } from "@/lib/api";

export default function DirectPage() {
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getRecommendations("agent_slug=direct").then(setRecs).catch(console.error);
  }, []);

  const runAnalysis = async () => {
    setLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") || "http://localhost:8000"}/api/v1/agents`, { method: "GET" });
      const agentUrl = "http://localhost:8001/run/analyze";
      await fetch(agentUrl, { method: "POST" }).catch(() => {});
      const updated = await api.getRecommendations("agent_slug=direct");
      setRecs(updated);
    } finally {
      setLoading(false);
    }
  };

  const review = async (id: string, status: string) => {
    await api.reviewRecommendation(id, status);
    setRecs(recs.map((r) => (r.id === id ? { ...r, status } : r)));
  };

  const priorityColors: Record<string, string> = {
    critical: "text-red-400",
    high: "text-amber-400",
    medium: "text-blue-400",
    low: "text-gray-400",
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Target className="h-8 w-8 text-primary" />
            Yandex Direct
          </h1>
          <p className="text-muted-foreground mt-1">Анализ кампаний и рекомендации</p>
        </div>
        <Button onClick={runAnalysis} disabled={loading}>
          {loading ? "Анализ..." : "Запустить анализ"}
        </Button>
      </div>

      <div className="space-y-4">
        {recs.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет рекомендаций. Запустите анализ.</CardContent></Card>
        ) : (
          recs.map((rec) => (
            <Card key={rec.id}>
              <CardHeader className="flex flex-row items-start justify-between">
                <div>
                  <CardTitle className="text-base">{rec.title}</CardTitle>
                  <p className={`text-xs mt-1 ${priorityColors[rec.priority]}`}>{rec.priority} · {rec.category}</p>
                </div>
                <span className="text-xs text-muted-foreground">{rec.status}</span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{rec.description}</p>
                {rec.status === "pending" && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => review(rec.id, "approved")}><Check className="h-3 w-3" /> Одобрить</Button>
                    <Button size="sm" variant="destructive" onClick={() => review(rec.id, "rejected")}><X className="h-3 w-3" /> Отклонить</Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
