const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

export interface Agent {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: string;
  version: string;
  is_plugin: boolean;
}

export interface DashboardStats {
  total_agents: number;
  active_agents: number;
  pending_recommendations: number;
  total_clients: number;
  total_leads: number;
  parser_results: number;
  recent_errors: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

export interface CRMClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  lead_score: number | null;
  created_at: string;
}

export interface ChatSession {
  id: string;
  title: string;
  model: string;
}

export interface ChatMessage {
  id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface LogEntry {
  id: string;
  agent_slug: string;
  level: string;
  message: string;
  created_at: string;
}

export interface Setting {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string | null;
}

export interface AnalyticsReport {
  id: string;
  report_date: string;
  report_type: string;
  summary: string | null;
}

export interface ParserResult {
  id: string;
  company_name: string;
  website: string | null;
  lead_score: number | null;
  issues: { list: string[] } | null;
  created_at: string;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== "undefined") localStorage.setItem("token", token);
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== "undefined") return localStorage.getItem("token");
    return null;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== "undefined") localStorage.removeItem("token");
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string>),
    };
    const token = this.getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });
    if (res.status === 401) {
      this.clearToken();
      if (typeof window !== "undefined") window.location.href = "/login";
      throw new Error("Unauthorized");
    }
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<T>;
  }

  login(username: string, password: string) {
    return this.request<{ access_token: string; refresh_token: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  }

  getMe() { return this.request<Record<string, unknown>>("/auth/me"); }
  getDashboardStats() { return this.request<DashboardStats>("/dashboard/stats"); }
  getAgents() { return this.request<Agent[]>("/agents"); }
  getRecommendations(params?: string) { return this.request<Recommendation[]>(`/recommendations${params ? `?${params}` : ""}`); }
  reviewRecommendation(id: string, status: string) {
    return this.request<Recommendation>(`/recommendations/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  }
  getSettings() { return this.request<Setting[]>("/settings"); }
  getLogs(params?: string) { return this.request<LogEntry[]>(`/logs${params ? `?${params}` : ""}`); }
  getCRMClients() { return this.request<CRMClient[]>("/crm/clients"); }
  getSEOAudits() { return this.request<Record<string, unknown>[]>("/seo/audits"); }
  getAnalyticsReports() { return this.request<AnalyticsReport[]>("/analytics/reports"); }
  getParserResults() { return this.request<ParserResult[]>("/parser/results"); }
  getChatSessions() { return this.request<ChatSession[]>("/chat/sessions"); }
  createChatSession(title?: string) {
    return this.request<ChatSession>("/chat/sessions", { method: "POST", body: JSON.stringify({ title: title || "New Chat" }) });
  }
  getChatMessages(sessionId: string) { return this.request<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`); }
  sendChatMessage(sessionId: string, content: string) {
    return this.request<ChatMessage>(`/chat/sessions/${sessionId}/messages`, { method: "POST", body: JSON.stringify({ content }) });
  }
}

export const api = new ApiClient();
