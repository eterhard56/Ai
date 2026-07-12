"use client";

import { useEffect, useState } from "react";
import { ScanSearch } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ParserResult } from "@/lib/api";

export default function ParserPage() {
  const [results, setResults] = useState<ParserResult[]>([]);
  const [query, setQuery] = useState("стоматология");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getParserResults().then(setResults).catch(console.error);
  }, []);

  const runParser = async () => {
    setLoading(true);
    try {
      await fetch("/agents/parser/run/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, city: "moscow", limit: 20 }),
      });
      const updated = await api.getParserResults();
      setResults(updated);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <ScanSearch className="h-8 w-8 text-primary" />
          Parser Agent
        </h1>
        <p className="text-muted-foreground mt-1">Интеграция с parser-2gis</p>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6 flex gap-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Запрос для 2GIS" className="flex-1" />
          <Button onClick={runParser} disabled={loading}>{loading ? "Парсинг..." : "Запустить"}</Button>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {results.map((r) => (
          <Card key={r.id}>
            <CardHeader className="flex flex-row items-center justify-between py-3">
              <CardTitle className="text-sm">{r.company_name}</CardTitle>
              <span className={`text-sm font-bold ${(r.lead_score ?? 0) >= 70 ? "text-green-400" : "text-amber-400"}`}>
                {r.lead_score ?? "—"}
              </span>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {r.website || "Нет сайта"} · {(r.issues?.list || []).join(", ") || "Нет проблем"}
            </CardContent>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}
