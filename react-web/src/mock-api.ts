import type { Snippet, User } from "./types";

const storageKey = "linksaw-react-mock-data";
const now = () => Math.floor(Date.now() / 1000);
const user: User = { id: "mock-user", email: "local@linksaw.test", display_name: "Local Linksaw" };

type Store = { snippets: Snippet[]; deleted: Snippet[]; autocompleteTrigger: string };

const seed = (): Store => ({
  autocompleteTrigger: ";",
  deleted: [],
  snippets: [
    ["Morning checklist", "- Review today’s priorities\n- Reply to important messages\n- Take a walk"],
    ["Follow-up", "Hey! Just following up to see if you had a chance to take a look."],
    ["Linksaw", "https://linksaw.com"],
    ["Contact", "nate@example.com\n(312) 555-0147"],
    ["Dynamic greeting", "Good morning, {day}! {cursor}"],
  ].map(([title, body], index) => ({
    id: `00000000-0000-4000-8000-00000000000${index + 1}`,
    title, body, created_at: now() - index * 60, updated_at: now() - index * 60,
    version: 1, share_token: null, can_undo: false, can_redo: false,
  })),
});

function read(): Store {
  try {
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as Store : seed();
  } catch { return seed(); }
}

function write(store: Store) {
  localStorage.setItem(storageKey, JSON.stringify(store));
}

function find(store: Store, id: string) {
  const snippet = store.snippets.find(item => item.id === id);
  if (!snippet) throw new Error("Snippet not found");
  return snippet;
}

export function createMockApi() {
  return {
    session: async () => {
      const store = read();
      return [{ user }, { snippets: store.snippets, cursor: 0 }, { autocompleteTrigger: store.autocompleteTrigger }] as [{ user: User }, { snippets: Snippet[]; cursor?: number }, { autocompleteTrigger: string }];
    },
    changes: async () => ({ changes: [], cursor: 0, more: false }),
    get: async (id: string) => ({ snippet: find(read(), id) }),
    create: async (value: { title: string; body: string; importId: string }) => {
      const store = read(); const timestamp = now();
      const snippet: Snippet = { id: crypto.randomUUID(), title: value.title, body: value.body, created_at: timestamp, updated_at: timestamp, version: 1, share_token: null, can_undo: false, can_redo: false };
      store.snippets.unshift(snippet); write(store); return { snippet };
    },
    update: async (snippet: Snippet, value: { title: string; body: string }) => {
      const store = read(); const saved = { ...find(store, snippet.id), ...value, updated_at: now(), version: snippet.version + 1 };
      store.snippets = store.snippets.map(item => item.id === saved.id ? saved : item); write(store); return { snippet: saved };
    },
    remove: async (snippet: Snippet) => {
      const store = read(); const deleted = find(store, snippet.id);
      store.snippets = store.snippets.filter(item => item.id !== snippet.id); store.deleted.unshift(deleted); write(store); return { deleted };
    },
    restore: async (snippet: Snippet) => {
      const store = read(); store.deleted = store.deleted.filter(item => item.id !== snippet.id); store.snippets.unshift(snippet); write(store); return { ok: true };
    },
    share: async (snippet: Snippet) => {
      const store = read(); const token = snippet.share_token || `mock-${snippet.id.slice(0, 8)}`;
      store.snippets = store.snippets.map(item => item.id === snippet.id ? { ...item, share_token: token } : item); write(store);
      return { token, url: `${location.origin}/s/${token}` };
    },
    unshare: async (snippet: Snippet) => {
      const store = read(); store.snippets = store.snippets.map(item => item.id === snippet.id ? { ...item, share_token: null } : item); write(store); return { ok: true };
    },
    revision: async (snippet: Snippet) => ({ snippet }),
    deleted: async () => ({ snippets: read().deleted }),
    restoreDeleted: async (snippet: Snippet) => {
      const store = read(); store.deleted = store.deleted.filter(item => item.id !== snippet.id); store.snippets.unshift(snippet); write(store); return { ok: true, snippet };
    },
    deleteForever: async (snippet: Snippet) => {
      const store = read(); store.deleted = store.deleted.filter(item => item.id !== snippet.id); write(store); return { ok: true };
    },
    savePreferences: async (autocompleteTrigger: string) => {
      const store = read(); store.autocompleteTrigger = autocompleteTrigger; write(store); return { autocompleteTrigger };
    },
    deleteAccount: async () => { localStorage.removeItem(storageKey); return { ok: true }; },
    logout: async () => ({ ok: true }),
  };
}
