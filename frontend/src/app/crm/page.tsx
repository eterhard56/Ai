"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, type CRMClient } from "@/lib/api";

const statusLabels: Record<string, string> = {
  new: "Новый", contacted: "Контакт", qualified: "Квалифицирован",
  proposal: "Предложение", won: "Выигран", lost: "Потерян",
};

export default function CRMPage() {
  const [clients, setClients] = useState<CRMClient[]>([]);

  useEffect(() => {
    api.getCRMClients().then(setClients).catch(console.error);
  }, []);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          CRM
        </h1>
        <p className="text-muted-foreground mt-1">Управление клиентами и лидами</p>
      </div>

      <div className="grid gap-4">
        {clients.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Нет клиентов</CardContent></Card>
        ) : (
          clients.map((c) => (
            <Card key={c.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">{c.name}</CardTitle>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                  {statusLabels[c.status] || c.status}
                </span>
              </CardHeader>
              <CardContent className="flex gap-6 text-sm text-muted-foreground">
                {c.company && <span>{c.company}</span>}
                {c.email && <span>{c.email}</span>}
                {c.phone && <span>{c.phone}</span>}
                {c.lead_score != null && <span className="text-primary">Score: {c.lead_score}</span>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
