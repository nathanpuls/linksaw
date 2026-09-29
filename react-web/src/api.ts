import type { Snippet, User } from "./types";

const base = import.meta.env.VITE_API_BASE || (import.meta.env.DEV ? "/api" : "");

export type SnippetChange = { sequence: number; snippetId: string; action: "upsert" | "delete"; snippet: Snippet | null };

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message); this.status = status; this.data = data;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${base}${path}`, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  if (response.status === 401) {
    if (!import.meta.env.DEV) location.assign("/login");
    throw new ApiError("Sign in required", 401, {});
  }
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new ApiError(String(data.error || "Something went wrong"), response.status, data);
  return data as T;
}

export const linksawApi = {
  session: () => Promise.all([
    api<{ user: User }>("/me"),
    api<{ snippets: Snippet[]; cursor?: number }>("/snippets"),
    api<{ autocompleteTrigger: string }>("/preferences"),
  ]),
  changes: (after: number) => api<{ changes: SnippetChange[]; cursor: number; more: boolean }>(`/snippet-changes?after=${after}`),
  get: (id: string) => api<{ snippet: Snippet }>(`/snippets/${id}`),
  create: (value: { title: string; body: string; importId: string }) => api<{ snippet?: Snippet; id?: string }>("/snippets", { method: "POST", body: JSON.stringify(value) }),
  update: (snippet: Snippet, value: { title: string; body: string }) => api<{ snippet: Snippet }>(`/snippets/${snippet.id}`, { method: "PUT", body: JSON.stringify({ ...value, version: snippet.version }) }),
  remove: (snippet: Snippet) => api<{ deleted: Snippet }>(`/snippets/${snippet.id}`, { method: "DELETE" }),
  restore: (snippet: Snippet) => api<{ ok: boolean }>(`/snippets/${snippet.id}/restore`, { method: "POST", body: JSON.stringify(snippet) }),
  share: (snippet: Snippet) => api<{ token: string; url: string }>(`/snippets/${snippet.id}/share`, { method: "POST" }),
  unshare: (snippet: Snippet) => api<{ ok: boolean }>(`/snippets/${snippet.id}/share`, { method: "DELETE" }),
  revision: (snippet: Snippet, direction: "undo" | "redo") => api<{ snippet: Snippet }>(`/snippets/${snippet.id}/revisions/${direction}`, { method: "POST" }),
  deleted: () => api<{ snippets: Snippet[] }>("/deleted-snippets"),
  restoreDeleted: (snippet: Snippet) => api<{ ok: boolean; snippet: Snippet }>(`/deleted-snippets/${snippet.id}/restore`, { method: "POST" }),
  deleteForever: (snippet: Snippet) => api<{ ok: boolean }>(`/deleted-snippets/${snippet.id}`, { method: "DELETE" }),
  savePreferences: (autocompleteTrigger: string) => api<{ autocompleteTrigger: string }>("/preferences", { method: "PUT", body: JSON.stringify({ autocompleteTrigger }) }),
  deleteAccount: () => api<{ ok: boolean }>("/me", { method: "DELETE", body: JSON.stringify({ confirmation: "delete" }) }),
  logout: () => api<{ ok: boolean }>("/auth/logout", { method: "POST" }),
};

export function snippetEventsUrl() {
  const url = new URL(base || location.origin, location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/snippet-events";
  url.search = "";
  return url.toString();
}
