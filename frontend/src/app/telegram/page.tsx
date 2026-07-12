"use client";

import { MessageSquare } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const commands = [
  { cmd: "/report", desc: "Ежедневный отчёт" },
  { cmd: "/direct", desc: "Анализ Яндекс Директ" },
  { cmd: "/parser", desc: "Запуск парсера" },
  { cmd: "/seo <url>", desc: "SEO аудит сайта" },
  { cmd: "/status", desc: "Статус всех сервисов" },
  { cmd: "/leads", desc: "Отчёт по лидам" },
  { cmd: "/help", desc: "Справка по командам" },
];

export default function TelegramPage() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          Telegram Agent
        </h1>
        <p className="text-muted-foreground mt-1">Бот для уведомлений и отчётов</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Команды бота</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {commands.map((c) => (
              <div key={c.cmd} className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3">
                <code className="text-sm text-primary">{c.cmd}</code>
                <span className="text-sm text-muted-foreground">{c.desc}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Настройка</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>1. Создайте бота через @BotFather</p>
            <p>2. Укажите TELEGRAM_BOT_TOKEN в .env</p>
            <p>3. Укажите TELEGRAM_ADMIN_CHAT_ID в .env</p>
            <p>4. Перезапустите agent-telegram</p>
            <p className="mt-4 text-xs">Ежедневный отчёт отправляется в 09:00 (Europe/Moscow)</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
