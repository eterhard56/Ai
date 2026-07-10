"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SEOPage() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<{
    score?: number;
    issues?: Array<{ message: string; priority: string }>;
    ai_recommendations?: string;
    error?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const runAudit = async () => {
    if (!url) return;
    setLoading(true);
    try {
      const resp = await fetch("/agents/seo/run/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      setResult(await resp.json());
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Search className="h-8 w-8 text-primary" />
          SEO Agent
        </h1>
        <p className="text-muted-foreground mt-1">Аудит сайтов и рекомендации</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} className="flex-1" />
            <Button onClick={runAudit} disabled={loading}>{loading ? "Проверка..." : "Аудит"}</Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Результат</CardTitle></CardHeader>
            <CardContent>
              <div className="text-4xl font-bold gradient-text mb-2">{result.score ?? "—"}</div>
              <p className="text-sm text-muted-foreground">SEO Score</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Проблемы</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(result.issues || []).map((issue, i) => (
                <div key={i} className="rounded-lg bg-muted/30 px-3 py-2 text-sm">{issue.message}</div>
              ))}
            </CardContent>
          </Card>
          {result.ai_recommendations && (
            <Card className="md:col-span-2">
              <CardHeader><CardTitle>AI Рекомендации</CardTitle></CardHeader>
              <CardContent><p className="text-sm whitespace-pre-wrap">{result.ai_recommendations}</p></CardContent>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
