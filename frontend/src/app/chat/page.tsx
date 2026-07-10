"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, Send, Plus } from "lucide-react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, type ChatSession, type ChatMessage } from "@/lib/api";

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getChatSessions().then((s) => {
      setSessions(s);
      if (s.length > 0) setActiveSession(s[0].id);
    }).catch(console.error);
  }, []);

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
    if (!input.trim() || !activeSession) return;
    setLoading(true);
    const content = input;
    setInput("");
    setMessages([...messages, { id: "temp", role: "user", content, created_at: new Date().toISOString() }]);
    try {
      const reply = await api.sendChatMessage(activeSession, content);
      setMessages((prev) => [...prev.filter((m) => m.id !== "temp"), { id: "temp-u", role: "user", content, created_at: new Date().toISOString() }, reply]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-primary" />
            AI Chat
          </h1>
          <p className="text-muted-foreground mt-1">Локальная модель Ollama (qwen3:8b)</p>
        </div>
        <Button onClick={createSession}><Plus className="h-4 w-4" /> Новый чат</Button>
      </div>

      <div className="flex gap-4 h-[calc(100vh-12rem)]">
        <Card className="w-64 shrink-0 overflow-y-auto">
          <CardHeader><CardTitle className="text-sm">Сессии</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSession(s.id)}
                className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-all ${activeSession === s.id ? "bg-primary/15 text-primary" : "hover:bg-muted/50"}`}
              >
                {s.title}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="flex-1 flex flex-col">
          <CardContent className="flex-1 overflow-y-auto pt-6 space-y-4">
            {messages.map((msg) => (
              <div key={msg.id + msg.created_at} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50"}`}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-2xl px-4 py-3 text-sm text-muted-foreground animate-pulse">Думаю...</div>
              </div>
            )}
            <div ref={bottomRef} />
          </CardContent>
          <div className="border-t border-border/50 p-4 flex gap-3">
            <Input
              placeholder="Сообщение..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
              disabled={!activeSession || loading}
              className="flex-1"
            />
            <Button onClick={sendMessage} disabled={!activeSession || loading || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
