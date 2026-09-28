export type Snippet = {
  id: string;
  title: string;
  body: string;
  created_at: number;
  updated_at: number;
  version: number;
  share_token: string | null;
  can_undo: boolean;
  can_redo: boolean;
};

export type User = { id: string; email: string; display_name: string; avatar_url?: string | null };
export type Theme = "system" | "light" | "dark";
export type View = "library" | "editor" | "settings" | "deleted";
export type Toast = { message: string; action?: string; onAction?: () => void } | null;
