"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type AnalyticsReport } from "@/lib/api";

export default function MetrikaPage() {
  const [reports, setReports] = useState<AnalyticsReport[]>([]);

  useEffect(() => {
    api.getAnalyticsReports().then(setReports).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          Yandex Metrika
        </h1>
        <p className="text-muted-foreground mt-1">Аналитика и ежедневные отчёты</p>
      </div>

      <div className="space-y-4">
        {reports.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет отчётов. Analytics Agent создаёт их ежедневно.</CardContent></Card>
        ) : (
          reports.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-base">{r.report_type} — {new Date(r.report_date).toLocaleDateString("ru")}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{r.summary || ""}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
