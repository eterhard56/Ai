"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Sparkles, Send, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ChatSession, type ChatMessage } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    try {
      const s = await api.getChatSessions();
      if (s.length > 0) {
        setSessions(s);
        setActiveSession(s[0].id);
      } else {
        const created = await api.createChatSession("Мой чат");
        setSessions([created]);
        setActiveSession(created.id);
      }
    } catch (e) {
      setError("Не удалось создать чат. Войдите заново.");
    }
  }, []);

  useEffect(() => {
    ensureSession();
  }, [ensureSession]);

  useEffect(() => {
    if (activeSession) {
      api.getChatMessages(activeSession).then(setMessages).catch(console.error);
    }
  }, [activeSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const createSession = async () => {
    const session = await api.createChatSession();
    setSessions([session, ...sessions]);
    setActiveSession(session.id);
    setMessages([]);
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    let sessionId = activeSession;
    if (!sessionId) {
      const created = await api.createChatSession("Мой чат");
      setSessions([created]);
      sessionId = created.id;
      setActiveSession(sessionId);
    }
    setLoading(true);
    setError(null);
    const content = input;
    setInput("");
    setMessages((prev) => [...prev, { id: "temp", role: "user", content, created_at: new Date().toISOString() }]);
    try {
      const reply = await api.sendChatMessage(sessionId, content);
      setMessages((prev) => [...prev.filter((m) => m.id !== "temp"), { id: "temp-u", role: "user", content, created_at: new Date().toISOString() }, reply]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка. Ollama может быть занят — подождите 30 сек и повторите.");
      setMessages((prev) => prev.filter((m) => m.id !== "temp"));
    } finally {
      setLoading(false);
    }
  };

  const [showSessions, setShowSessions] = useState(false);

  return (
    <DashboardLayout>
      <div className="mb-4 lg:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="hidden lg:block">
          <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-7 w-7 lg:h-8 lg:w-8 text-primary" />
            AI Chat
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Локальная модель Ollama</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" className="lg:hidden" onClick={() => setShowSessions(!showSessions)}>
            Чаты ({sessions.length})
          </Button>
          <Button size="sm" onClick={createSession}><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Новый чат</span></Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:gap-4 h-[calc(100dvh-11rem)] lg:h-[calc(100vh-12rem)]">
        <Card className={cn(
          "shrink-0 overflow-y-auto lg:w-64",
          showSessions ? "block max-h-48 lg:max-h-none" : "hidden lg:block"
        )}>
          <CardHeader className="py-3"><CardTitle className="text-sm">Сессии</CardTitle></CardHeader>
          <CardContent className="space-y-1 pb-3">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => { setActiveSession(s.id); setShowSessions(false); }}
                className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition-all active:scale-[0.98] ${activeSession === s.id ? "bg-primary/15 text-primary" : "hover:bg-muted/50"}`}
              >
                {s.title}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col min-h-0">
          {error && (
            <div className="mx-4 mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">{error}</div>
          )}
          <CardContent className="flex-1 overflow-y-auto pt-4 lg:pt-6 space-y-3 lg:space-y-4">
            {messages.length === 0 && !loading && (
              <p className="text-center text-sm text-muted-foreground py-8">Напишите сообщение — ответит локальная AI (Ollama)</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id + msg.created_at} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[90%] lg:max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">
                  Думаю... (до 60 сек на CPU)
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>
          <div className="border-t border-border/50 p-3 lg:p-4 flex gap-2 lg:gap-3 safe-bottom">
            <Input
              placeholder="Сообщение..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={loading}
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage} disabled={!activeSession || loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
