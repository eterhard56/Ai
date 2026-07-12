"use client";

import { useEffect, useState } from "react";
import { Settings } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type Setting } from "@/lib/api";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  const grouped = settings.reduce<Record<string, Setting[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">Настройки платформы</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Настройки задаются через .env файл. См. README.md
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category} className="mb-4">
            <CardHeader><CardTitle className="text-base capitalize">{category}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {items.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{s.key}</p>
                    {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                  </div>
                  <code className="text-xs text-primary">{s.value}</code>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Card className="mt-6">
        <CardHeader><CardTitle>Переменные окружения</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>OLLAMA_MODEL=qwen3:8b</p>
          <p>YANDEX_DIRECT_TOKEN=...</p>
          <p>TELEGRAM_BOT_TOKEN=...</p>
          <p>PARSER_2GIS_URL=http://host:8080</p>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
