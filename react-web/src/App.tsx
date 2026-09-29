import {
  ArrowLeft, Check, ChevronLeft, Copy, Download, ExternalLink, FileJson, FileSpreadsheet,
  LogOut, Menu, PanelLeft, Pencil, Plus, Redo2, Search, Settings, Share, Trash2, Undo2, Upload, X,
} from "lucide-react";
import {
  type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { flushSync } from "react-dom";
import { linksawApi, ApiError, isMockMode, snippetEventsUrl } from "./api";
import { compactMarkdownHtml, derivedLabel, markdownHtml, searchExcerpt, searchScore, snippetLabel, snippetText, snippetUrl } from "./content";
import { sourceOffsetFromRenderedPoint } from "../../web/app/markdown.js";
import type { Snippet, Theme, Toast, User, View } from "./types";
import { detectPastedSnippets, parseCsvSnippets, parseJsonSnippets, snippetsToCsv, snippetsToJson } from "../../web/app/transfers.js";

const isMac = /Mac|iPhone|iPad|iPod/i.test((navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform || navigator.platform || "");
const narrowQuery = "(max-width: 900px)";

function isLongSnippet(snippet: Pick<Snippet, "body">) {
  return snippet.body.length > 500 || snippet.body.split(/\r?\n/).length > 10;
}

function useMedia(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => { const media = matchMedia(query); const update = () => setMatches(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, [query]);
  return matches;
}

function Button({ label, shortcut, children, className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; shortcut?: string }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={shortcut ? `${label} (${shortcut})` : label} {...props}>{children}</button>;
}

function updateLocation(values: Record<string, string | null>, push = true) {
  const url = new URL(location.href);
  url.pathname = "/home/";
  for (const [key, value] of Object.entries(values)) value ? url.searchParams.set(key, value) : url.searchParams.delete(key);
  history[push ? "pushState" : "replaceState"]({}, "", `${url.pathname}${url.search}`);
}

function routeFromLocation(): { view: View; snippetId: string | null } {
  const params = new URLSearchParams(location.search);
  const view = params.get("view");
  if (view === "settings" || view === "deleted") return { view, snippetId: null };
  if (view === "new" || params.has("new")) return { view: "editor", snippetId: null };
  if (view === "edit") return { view: "editor", snippetId: params.get("snippet") };
  return { view: "library", snippetId: params.get("snippet") };
}

export function App() {
  const narrow = useMedia(narrowQuery);
  const [user, setUser] = useState<User | null>(null);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [query, setQuery] = useState(() => sessionStorage.getItem("linksaw-react-search") || "");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [route, setRoute] = useState(routeFromLocation);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reader, setReader] = useState(() => sessionStorage.getItem("linksaw-react-reader") === "true");
  const [toast, setToast] = useState<Toast>(null);
  const [preferences, setPreferences] = useState({ autocompleteTrigger: ";" });
  const [actionSnippet, setActionSnippet] = useState<Snippet | null>(null);
  const [actionPoint, setActionPoint] = useState<{ x: number; y: number } | null>(null);
  const [deleted, setDeleted] = useState<Snippet[]>([]);
  const [editOffset, setEditOffset] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const hoveredId = useRef<string | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const flushEditor = useRef<(() => Promise<boolean>) | null>(null);
  const changeCursor = useRef(0);
  const changeRequest = useRef<Promise<void> | null>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!term) return snippets;
    return snippets
      .map((snippet, index) => ({ snippet, index, score: searchScore(snippet, term) }))
      .filter(result => Number.isFinite(result.score))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map(result => result.snippet);
  }, [query, snippets]);
  const selected = snippets.find(snippet => snippet.id === selectedId) || null;

  const notify = useCallback((value: Toast, duration = 1600) => {
    clearTimeout(toastTimer.current); setToast(value);
    if (value) toastTimer.current = window.setTimeout(() => setToast(null), duration);
  }, []);
  const toggleReader = useCallback(() => {
    setReader(value => {
      const next = !value;
      sessionStorage.setItem("linksaw-react-reader", String(next));
      return next;
    });
  }, []);
  useEffect(() => {
    let active = true;
    linksawApi.session().then(([me, library, prefs]) => {
      if (!active) return;
      changeCursor.current = library.cursor || 0; setUser(me.user); setSnippets(library.snippets); setPreferences(prefs);
      const initial = routeFromLocation();
      setRoute(initial); setSelectedId(initial.snippetId);
    }).catch(reason => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const pop = () => { const next = routeFromLocation(); setRoute(next); setSelectedId(next.snippetId); };
    addEventListener("popstate", pop); return () => removeEventListener("popstate", pop);
  }, []);
  useEffect(() => { sessionStorage.setItem("linksaw-react-search", query); }, [query]);
  useEffect(() => { if (!toast) return; const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape") setToast(null); }; addEventListener("keydown", escape); return () => removeEventListener("keydown", escape); }, [toast]);
  useEffect(() => {
    const syncViewport = () => {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty("--mobile-viewport-height", `${Math.round(viewport?.height || innerHeight)}px`);
      document.documentElement.style.setProperty("--mobile-viewport-top", `${Math.round(viewport?.offsetTop || 0)}px`);
    };
    syncViewport(); window.visualViewport?.addEventListener("resize", syncViewport); window.visualViewport?.addEventListener("scroll", syncViewport);
    return () => { window.visualViewport?.removeEventListener("resize", syncViewport); window.visualViewport?.removeEventListener("scroll", syncViewport); };
  }, []);

  const pullChanges = useCallback(async () => {
    if (changeRequest.current) return changeRequest.current;
    const request = (async () => {
      let more = false;
      do {
        const page = await linksawApi.changes(changeCursor.current);
        changeCursor.current = page.cursor;
        more = page.more;
        if (page.changes.length) {
          setSnippets(items => {
            const next = new Map(items.map(item => [item.id, item]));
            for (const change of page.changes) {
              if (change.action === "delete" || !change.snippet) next.delete(change.snippetId);
              else next.set(change.snippet.id, change.snippet);
            }
            return [...next.values()].sort((a, b) => b.updated_at - a.updated_at || b.id.localeCompare(a.id));
          });
        }
      } while (more);
    })().finally(() => { changeRequest.current = null; });
    changeRequest.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!user || isMockMode || typeof WebSocket === "undefined") return;
    let active = true; let socket: WebSocket | null = null; let retryTimer: number | undefined; let retryDelay = 1000;
    const connect = () => {
      if (!active || document.hidden || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
      socket = new WebSocket(snippetEventsUrl());
      socket.addEventListener("open", () => { retryDelay = 1000; void pullChanges(); });
      socket.addEventListener("message", () => { void pullChanges(); });
      socket.addEventListener("close", () => {
        socket = null; if (!active || document.hidden) return;
        retryTimer = window.setTimeout(connect, retryDelay); retryDelay = Math.min(30_000, retryDelay * 2);
      });
    };
    const resume = () => { if (!document.hidden) { void pullChanges(); connect(); } else socket?.close(1000, "hidden"); };
    connect(); addEventListener("online", resume); document.addEventListener("visibilitychange", resume);
    return () => { active = false; clearTimeout(retryTimer); removeEventListener("online", resume); document.removeEventListener("visibilitychange", resume); socket?.close(1000, "closed"); };
  }, [pullChanges, user?.id]);

  const showLibrary = useCallback((snippetId: string | null = null, push = true) => {
    setRoute({ view: "library", snippetId }); setSelectedId(snippetId); updateLocation({ view: null, snippet: snippetId }, push);
  }, []);
  const openSnippet = useCallback((snippet: Snippet, push = true) => showLibrary(snippet.id, push), [showLibrary]);
  const editSnippet = useCallback((snippet: Snippet | null, push = true, offset: number | null = null, title = false) => {
    flushSync(() => {
      setEditOffset(offset);
      setEditTitle(title);
      setRoute({ view: "editor", snippetId: snippet?.id || null }); setSelectedId(snippet?.id || null);
    });
    updateLocation({ view: snippet ? "edit" : "new", snippet: snippet?.id || null }, push);
    if (!title) {
      const input = document.querySelector<HTMLTextAreaElement>("#editor textarea");
      if (input) {
        input.focus({ preventScroll: true });
        const caret = Math.max(0, Math.min(offset ?? input.value.length, input.value.length));
        input.setSelectionRange(caret, caret);
      }
    }
  }, []);
  const openSettings = useCallback((push = true) => { setRoute({ view: "settings", snippetId: null }); updateLocation({ view: "settings", snippet: null }, push); }, []);
  const afterEditorSave = useCallback(async (action: () => void) => {
    if (flushEditor.current && !(await flushEditor.current())) return;
    action();
  }, []);

  const copy = useCallback(async (snippet: Snippet) => { await navigator.clipboard.writeText(snippetText(snippet)); notify({ message: "Copied" }); }, [notify]);
  const share = useCallback(async (snippet: Snippet) => {
    const result = await linksawApi.share(snippet);
    setSnippets(items => items.map(item => item.id === snippet.id ? { ...item, share_token: result.token } : item));
    if (navigator.share) { try { await navigator.share({ title: snippetLabel(snippet), url: result.url }); return; } catch (reason) { if ((reason as Error).name === "AbortError") return; } }
    await navigator.clipboard.writeText(result.url); notify({ message: "Link copied" });
  }, [notify]);
  const unshare = useCallback(async (snippet: Snippet) => {
    await linksawApi.unshare(snippet);
    setSnippets(items => items.map(item => item.id === snippet.id ? { ...item, share_token: null } : item));
    notify({ message: "Sharing stopped" });
  }, [notify]);
  const remove = useCallback(async (snippet: Snippet) => {
    const { deleted: removed } = await linksawApi.remove(snippet);
    setSnippets(items => items.filter(item => item.id !== snippet.id));
    const currentIndex = filtered.findIndex(item => item.id === snippet.id);
    const remaining = filtered.filter(item => item.id !== snippet.id);
    const next = remaining[Math.min(Math.max(0, currentIndex), remaining.length - 1)] || null;
    showLibrary(next?.id || null, false);
    notify({ message: "Snippet deleted ·", action: "Undo", onAction: async () => {
      await linksawApi.restore(removed);
      setSnippets(items => [removed, ...items.filter(item => item.id !== removed.id)].sort((a, b) => b.updated_at - a.updated_at));
      showLibrary(removed.id, false); setToast(null);
    } }, 7000);
  }, [filtered, notify, showLibrary]);

  const useItem = useCallback(async (snippet: Snippet) => {
    const url = snippetUrl(snippet); if (url) window.open(url, "_blank", "noopener,noreferrer"); else await copy(snippet);
  }, [copy]);

  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      const target = event.target;
      const editingText = target instanceof Element && target.matches("input,textarea,[contenteditable=true]");
      const command = isMac ? event.metaKey : event.ctrlKey;
      if (event.key === "Escape") {
        if (actionSnippet) { setActionSnippet(null); return; }
        if (route.view !== "library") { event.preventDefault(); showLibrary(selectedId); return; }
        if (reader) { event.preventDefault(); setReader(false); sessionStorage.setItem("linksaw-react-reader", "false"); }
        return;
      }
      if (command && event.key === "\\") { event.preventDefault(); toggleReader(); return; }
      if (!editingText && event.key === "/") { event.preventDefault(); searchRef.current?.focus(); return; }
      if (route.view !== "library" || editingText || !filtered.length) return;
      const index = Math.max(0, filtered.findIndex(item => item.id === selectedId));
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault(); const delta = event.key === "ArrowDown" ? 1 : -1;
        const next = filtered[Math.max(0, Math.min(filtered.length - 1, index + delta))]; setSelectedId(next.id); updateLocation({ snippet: next.id, view: null }, false); return;
      }
      if (event.key === "Enter") { event.preventDefault(); const item = filtered[index]; if (item) openSnippet(item); return; }
      if (event.key === "ArrowRight") { event.preventDefault(); const item = snippets.find(value => value.id === hoveredId.current) || filtered[index]; if (item) void useItem(item); return; }
      if ((event.key === "Delete" || event.key === "Backspace") && selected) { event.preventDefault(); void remove(selected); }
    };
    addEventListener("keydown", keydown); return () => removeEventListener("keydown", keydown);
  }, [actionSnippet, filtered, openSnippet, reader, remove, route.view, selected, selectedId, showLibrary, snippets, toggleReader, useItem]);

  const saveSnippet = useCallback((saved: Snippet) => {
    setSnippets(items => [saved, ...items.filter(item => item.id !== saved.id)].sort((a, b) => b.updated_at - a.updated_at));
    setSelectedId(saved.id);
  }, []);

  if (loading) return <div className="react-loading" role="status">Loading Linksaw…</div>;
  if (error && !user) return <main className="react-error"><img src="/favicon.png" alt="" /><h1>Linksaw can’t load right now</h1><p>Your snippets are safe. Please try again shortly.</p><a href="/home/">Try again</a></main>;

  const routeSnippet = route.view === "library" && route.snippetId ? snippets.find(item => item.id === route.snippetId) || null : null;
  const viewerSnippet = narrow ? routeSnippet : selected;

  return <>
    <main id="app" className={`app react-app ${reader ? "reader-mode" : ""} ${routeSnippet ? "viewer-open" : ""}`} aria-hidden={route.view === "library" ? undefined : true}>
      <Library
        user={user!} snippets={filtered} query={query} onQuery={setQuery} searchRef={searchRef}
        selectedId={selectedId} onSelect={setSelectedId} onOpen={snippet => void afterEditorSave(() => openSnippet(snippet))} onNew={() => void afterEditorSave(() => editSnippet(null))}
        onSettings={() => void afterEditorSave(() => openSettings())} onContext={(snippet, point) => { setActionSnippet(snippet); setActionPoint(point); }}
        hoveredId={hoveredId} error={error}
      />
      <section className="viewer-pane" aria-label="Snippet viewer">
        {viewerSnippet ? <Viewer snippet={viewerSnippet} narrow={narrow} reader={reader} onToggleReader={toggleReader} onBack={() => showLibrary(null)} onCopy={() => void copy(viewerSnippet)} onShare={() => void share(viewerSnippet)} onRename={() => editSnippet(viewerSnippet, true, null, true)} onDelete={() => void remove(viewerSnippet)} onEditAt={offset => editSnippet(viewerSnippet, true, offset)} /> : <div className="viewer-empty" />}
      </section>
    </main>
    {route.view === "editor" && <Editor key={route.snippetId || "new"} snippet={route.snippetId ? snippets.find(item => item.id === route.snippetId) || null : null} narrow={narrow} reader={reader} initialOffset={editOffset} initialRenaming={editTitle} onToggleReader={toggleReader} onSaved={saveSnippet} onClose={saved => showLibrary(saved?.id || null)} registerFlush={flush => { flushEditor.current = flush; }} onCopy={copy} onShare={share} onUnshare={unshare} onDelete={remove} />}
    {route.view === "settings" && <SettingsPanel user={user!} preferences={preferences} setPreferences={setPreferences} snippets={snippets} onClose={() => showLibrary(selectedId)} onDeleted={async () => { setDeleted((await linksawApi.deleted()).snippets); setRoute({ view: "deleted", snippetId: null }); updateLocation({ view: "deleted", snippet: null }); }} notify={notify} />}
    {route.view === "deleted" && <DeletedPanel snippets={deleted} setSnippets={setDeleted} onBack={() => openSettings(false)} onRestored={saveSnippet} />}
    {actionSnippet && <ActionMenu snippet={actionSnippet} point={actionPoint} onClose={() => { setActionSnippet(null); setSelectedId(null); }} onOpen={() => { const url = snippetUrl(actionSnippet); if (url) window.open(url, "_blank", "noopener,noreferrer"); }} onCopy={() => void copy(actionSnippet)} onShare={() => void share(actionSnippet)} onEdit={() => void afterEditorSave(() => editSnippet(actionSnippet, true, actionPoint === null && isLongSnippet(actionSnippet) ? 0 : actionSnippet.body.length))} onDelete={() => void remove(actionSnippet)} />}
    {toast && <div className="toast" role="status" aria-live="polite"><span>{toast.message}</span>{toast.action && <button className="toast-action" onClick={toast.onAction}>{toast.action}</button>}</div>}
  </>;
}

type LibraryProps = {
  user: User; snippets: Snippet[]; query: string; onQuery(value: string): void; searchRef: React.RefObject<HTMLInputElement | null>;
  selectedId: string | null; onSelect(id: string | null): void; onOpen(snippet: Snippet): void; onNew(): void; onSettings(): void;
  onContext(snippet: Snippet, point: { x: number; y: number } | null): void; hoveredId: React.MutableRefObject<string | null>; error: string;
};
function Library(props: LibraryProps) {
  const [searchActive, setSearchActive] = useState(false);
  const longPress = useRef<{ timer: number; x: number; y: number; snippet: Snippet } | null>(null);
  const suppressClickUntil = useRef(0);
  const initials = (props.user.display_name || props.user.email).split(/\s+/).slice(0, 2).map(value => value[0]).join("").toUpperCase();
  const startLongPress = (event: ReactPointerEvent, snippet: Snippet) => {
    if (event.pointerType === "mouse") return;
    const info = { timer: 0, x: event.clientX, y: event.clientY, snippet };
    info.timer = window.setTimeout(() => { suppressClickUntil.current = Date.now() + 900; props.onSelect(snippet.id); props.onContext(snippet, null); navigator.vibrate?.(10); longPress.current = null; }, 550);
    longPress.current = info;
  };
  const cancelLongPress = (event?: ReactPointerEvent) => {
    const info = longPress.current; if (!info) return;
    if (event && event.type === "pointermove" && Math.hypot(event.clientX - info.x, event.clientY - info.y) <= 10) return;
    clearTimeout(info.timer); longPress.current = null;
  };
  return <section className={`list-pane ${searchActive ? "search-active" : ""}`} aria-label="Snippet library">
    <header className="toolbar">
      <button className="mobile-search-trigger" type="button" aria-label="Search snippets" onClick={() => { setSearchActive(true); requestAnimationFrame(() => props.searchRef.current?.focus()); }}><Search aria-hidden size={18} /><span>Search</span></button>
      <div className="search-wrap">
        <button className="search-icon" type="button" tabIndex={-1} aria-label="Focus search" onClick={() => props.searchRef.current?.focus()}><Search /></button>
        <input id="search" ref={props.searchRef} type="search" placeholder="Search" autoComplete="off" value={props.query} onChange={event => props.onQuery(event.target.value)} onFocus={() => setSearchActive(true)} onBlur={() => { if (!props.query) setSearchActive(false); }} />
        {props.query && <button className="search-clear" type="button" aria-label="Clear search" onPointerDown={event => event.preventDefault()} onClick={() => { props.onQuery(""); props.searchRef.current?.focus(); }}><X /></button>}
      </div>
      <Button label="New snippet" shortcut={isMac ? "⌘N" : "Ctrl+N"} onClick={props.onNew}><Plus strokeWidth={2.5} /></Button>
    </header>
    <div className="status" role="status">{props.error}</div>
    <section className="results" role="list" aria-label="Snippets">
      {!props.snippets.length ? <div className="empty">{props.query.trim() ? "No matches" : "No snippets yet"}</div> : props.snippets.map(snippet => {
        const url = snippetUrl(snippet); const titled = Boolean(snippet.title.trim()); const excerpt = searchExcerpt(snippet.body, props.query);
        const preview = Boolean(snippet.body.trim()) && (titled || Boolean(props.query.trim() && excerpt.trim() !== derivedLabel(snippet.body)));
        return <article key={snippet.id} className={`result-row ${url ? "has-url" : ""} ${preview ? "has-preview" : ""} ${props.selectedId === snippet.id ? "selected" : ""}`} role="listitem" onPointerEnter={() => { props.hoveredId.current = snippet.id; }} onPointerLeave={() => { if (props.hoveredId.current === snippet.id) props.hoveredId.current = null; }}>
          <button className="result-main" type="button" aria-label={`Open ${snippetLabel(snippet)} in Linksaw`} aria-current={props.selectedId === snippet.id} onFocus={() => props.onSelect(snippet.id)} onClick={() => { if (Date.now() >= suppressClickUntil.current) props.onOpen(snippet); }} onContextMenu={event => { event.preventDefault(); if (Date.now() >= suppressClickUntil.current) { props.onSelect(snippet.id); props.onContext(snippet, { x: event.clientX, y: event.clientY }); } }} onPointerDown={event => startLongPress(event, snippet)} onPointerMove={cancelLongPress} onPointerUp={cancelLongPress} onPointerCancel={cancelLongPress}>
            <span className="result-text">
              {titled ? <span className="result-title">{snippet.title}</span> : <span className={`result-title result-markdown ${url ? "result-link-text" : ""}`} dangerouslySetInnerHTML={compactMarkdownHtml(derivedLabel(snippet.body))} />}
              {preview && <span className={`result-preview result-markdown ${url ? "result-link-text" : ""}`} dangerouslySetInnerHTML={compactMarkdownHtml(excerpt)} />}
            </span>
          </button>
        </article>;
      })}
    </section>
    <footer className="sidebar-footer">
      <a className="identity-logo-link" href="https://linksaw.com" aria-label="Linksaw home"><img className="identity-logo" src="/favicon.png" alt="" /></a>
      <button className="identity-button" type="button" aria-label="Open Settings" onClick={props.onSettings}>
        {props.user.avatar_url ? <img className="identity-avatar" src={props.user.avatar_url} alt="" referrerPolicy="no-referrer" /> : <span className="identity-avatar identity-avatar-fallback" aria-hidden>{initials}</span>}
        <span className="identity-name">{props.user.display_name}</span>
      </button>
    </footer>
  </section>;
}

function Viewer({ snippet, narrow, reader, onToggleReader, onBack, onCopy, onShare, onRename, onDelete, onEditAt }: { snippet: Snippet; narrow: boolean; reader: boolean; onToggleReader(): void; onBack(): void; onCopy(): void; onShare(): void; onRename(): void; onDelete(): void; onEditAt(offset: number): void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const longPress = useRef({ timer: 0, started: 0, x: 0, y: 0, suppressUntil: 0 });
  const selectionInside = () => {
    const selection = getSelection();
    return Boolean(selection && !selection.isCollapsed && bodyRef.current && (bodyRef.current.contains(selection.anchorNode) || bodyRef.current.contains(selection.focusNode)));
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("a")) return;
    clearTimeout(longPress.current.timer); longPress.current.started = performance.now(); longPress.current.x = event.clientX; longPress.current.y = event.clientY;
    longPress.current.timer = window.setTimeout(() => { longPress.current.suppressUntil = Date.now() + 900; }, 450);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (Math.hypot(event.clientX - longPress.current.x, event.clientY - longPress.current.y) > 8) clearTimeout(longPress.current.timer);
  };
  const pointerUp = () => {
    clearTimeout(longPress.current.timer);
    if (longPress.current.started && performance.now() - longPress.current.started >= 450) longPress.current.suppressUntil = Date.now() + 900;
    longPress.current.started = 0;
  };
  const editFromPoint = (event: ReactMouseEvent<HTMLDivElement>) => {
    const root = bodyRef.current;
    if (!root || (event.target as Element).closest("a") || Date.now() < longPress.current.suppressUntil || selectionInside()) return;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
    const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    onEditAt(sourceOffsetFromRenderedPoint(root, snippet.body, point?.offsetNode || range?.startContainer || event.target, point?.offset ?? range?.startOffset ?? 0, event.clientX, event.clientY));
  };
  const editFromAction = () => {
    const root = bodyRef.current; const scroll = scrollRef.current;
    if (!narrow || !root || !scroll || scroll.scrollHeight <= scroll.clientHeight + 2) { onEditAt(snippet.body.length); return; }
    const rootRect = root.getBoundingClientRect(); const scrollRect = scroll.getBoundingClientRect();
    const x = Math.min(rootRect.right - 2, rootRect.left + 24); const y = Math.min(rootRect.bottom - 2, scrollRect.top + 12);
    const point = document.caretPositionFromPoint?.(x, y); const range = document.caretRangeFromPoint?.(x, y);
    onEditAt(sourceOffsetFromRenderedPoint(root, snippet.body, point?.offsetNode || range?.startContainer || root, point?.offset ?? range?.startOffset ?? 0, x, y));
  };
  return <article className="viewer-content">
    <header className="viewer-header">
      <Button label="Back to snippets" className="viewer-back" onClick={onBack}><ChevronLeft /></Button>
      <Button label={reader ? "Show sidebar" : "Hide sidebar"} shortcut={isMac ? "⌘\\" : "Ctrl+\\"} className="reader-toggle" onClick={onToggleReader}><PanelLeft /></Button>
      <button className="preview-title" type="button" aria-label="Edit title" onClick={onRename}>{snippet.title}</button>
      <div className="viewer-actions">
        <Button label="Copy" shortcut={isMac ? "⌘C" : "Ctrl+C"} onClick={onCopy}><Copy /></Button>
        <Button label="Share" onClick={onShare}><Share /></Button>
        <Button label="Edit" onClick={editFromAction}><Pencil /></Button>
        <Button label="Delete" className="viewer-delete" onClick={onDelete}><Trash2 /></Button>
      </div>
    </header>
    <div ref={scrollRef} className="viewer-scroll" role="region" aria-label="Snippet content" tabIndex={-1}>
      <div ref={bodyRef} className="preview-body markdown-body" role="button" tabIndex={0} aria-label="Edit snippet content" dangerouslySetInnerHTML={markdownHtml(snippet.body)} onClick={editFromPoint} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onContextMenu={() => { longPress.current.suppressUntil = Date.now() + 900; }} />
    </div>
  </article>;
}

function Editor({ snippet, narrow, reader, initialOffset, initialRenaming, onToggleReader, onSaved, onClose, registerFlush, onCopy, onShare, onUnshare, onDelete }: { snippet: Snippet | null; narrow: boolean; reader: boolean; initialOffset: number | null; initialRenaming: boolean; onToggleReader(): void; onSaved(snippet: Snippet): void; onClose(snippet: Snippet | null): void; registerFlush(flush: (() => Promise<boolean>) | null): void; onCopy(snippet: Snippet): Promise<void>; onShare(snippet: Snippet): Promise<void>; onUnshare(snippet: Snippet): Promise<void>; onDelete(snippet: Snippet): Promise<void> }) {
  const [saved, setSaved] = useState(snippet);
  const [title, setTitle] = useState(snippet?.title || "");
  const [body, setBody] = useState(snippet?.body || "");
  const [editing, setEditing] = useState(!snippet || !narrow || initialOffset !== null);
  const [renaming, setRenaming] = useState(initialRenaming);
  const [failure, setFailure] = useState("");
  const [slow, setSlow] = useState(false);
  const [confirmUnshare, setConfirmUnshare] = useState(false);
  const version = useRef(0); const savedVersion = useRef(0); const inFlight = useRef<Promise<boolean> | null>(null);
  const savedRef = useRef(snippet); const failureRef = useRef("");
  const baseline = useRef(JSON.stringify({ title: snippet?.title || "", body: snippet?.body || "" }));
  const createId = useRef(crypto.randomUUID()); const timer = useRef<number | undefined>(undefined); const bodyRef = useRef<HTMLTextAreaElement>(null);
  const localUndo = useRef<string[]>([]); const localRedo = useRef<string[]>([]); const lastSnapshot = useRef(baseline.current);
  const applyingHistory = useRef(false);
  const mobileViewRef = useRef<HTMLDivElement>(null);
  const mobileLongPress = useRef({ timer: 0, started: 0, x: 0, y: 0, suppressUntil: 0 });

  const snapshot = () => JSON.stringify({ title: title.trim(), body });
  const saveNow = useCallback(async (): Promise<boolean> => {
    clearTimeout(timer.current); const requestVersion = version.current; const value = { title: title.trim(), body };
    if (!saved && !value.body.trim()) return true;
    if (JSON.stringify(value) === baseline.current) return true;
    if (inFlight.current) { await inFlight.current; if (requestVersion !== version.current) return saveNow(); return !failureRef.current; }
    const slowTimer = window.setTimeout(() => setSlow(true), 1600);
    const request = (async () => {
      try {
        const result: { snippet?: Snippet; id?: string } = saved ? await linksawApi.update(saved, value) : await linksawApi.create({ ...value, importId: createId.current });
        let next: Snippet | undefined = result.snippet;
        if (!next && result.id) next = (await linksawApi.get(result.id)).snippet;
        if (!next) throw new Error("Saved snippet could not be loaded");
        savedRef.current = next; setSaved(next); onSaved(next); baseline.current = JSON.stringify(value); savedVersion.current = requestVersion; failureRef.current = ""; setFailure(""); return true;
      } catch (reason) { const message = (reason as Error).message || "Couldn’t save"; failureRef.current = message; setFailure(message); return false; }
      finally { clearTimeout(slowTimer); setSlow(false); inFlight.current = null; }
    })();
    inFlight.current = request; const result = await request;
    if (result && version.current !== savedVersion.current) return saveNow(); return result;
  }, [body, onSaved, saved, title]);
  useEffect(() => {
    version.current += 1; clearTimeout(timer.current); setFailure("");
    const current = snapshot(); if (applyingHistory.current) { applyingHistory.current = false; lastSnapshot.current = current; } else if (current !== lastSnapshot.current) { localUndo.current.push(lastSnapshot.current); localRedo.current = []; lastSnapshot.current = current; }
    timer.current = window.setTimeout(() => { void saveNow(); }, 700); return () => clearTimeout(timer.current);
  }, [title, body]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => { if (snapshot() !== baseline.current) { event.preventDefault(); event.returnValue = ""; } };
    addEventListener("beforeunload", beforeUnload); return () => removeEventListener("beforeunload", beforeUnload);
  }, [title, body]);
  useEffect(() => { if (editing && !renaming) requestAnimationFrame(() => { const input = bodyRef.current; if (!input) return; input.focus({ preventScroll: true }); const offset = Math.max(0, Math.min(initialOffset ?? input.value.length, input.value.length)); input.setSelectionRange(offset, offset); }); }, [editing, initialOffset, renaming]);
  useEffect(() => { registerFlush(saveNow); return () => registerFlush(null); }, [registerFlush, saveNow]);
  useEffect(() => {
    if (!snippet || !savedRef.current || snippet.id !== savedRef.current.id || snippet.share_token === savedRef.current.share_token) return;
    const next = { ...savedRef.current, share_token: snippet.share_token }; savedRef.current = next; setSaved(next);
  }, [snippet]);

  const close = async () => { const okay = await saveNow(); if (okay) onClose(savedRef.current); };
  const applyHistory = async (direction: "undo" | "redo") => {
    const from = direction === "undo" ? localUndo.current : localRedo.current; const to = direction === "undo" ? localRedo.current : localUndo.current;
    const value = from.pop();
    if (value) { to.push(snapshot()); const parsed = JSON.parse(value); applyingHistory.current = true; setTitle(parsed.title); setBody(parsed.body); lastSnapshot.current = value; return; }
    const current = savedRef.current; const available = current?.[direction === "undo" ? "can_undo" : "can_redo"];
    if (!current || !available || !(await saveNow())) return;
    try {
      const { snippet: restored } = await linksawApi.revision(savedRef.current!, direction);
      applyingHistory.current = true; savedRef.current = restored; setSaved(restored); setTitle(restored.title); setBody(restored.body);
      baseline.current = JSON.stringify({ title: restored.title.trim(), body: restored.body }); lastSnapshot.current = baseline.current;
      localUndo.current = []; localRedo.current = []; failureRef.current = ""; setFailure(""); onSaved(restored);
      requestAnimationFrame(() => bodyRef.current?.focus({ preventScroll: true }));
    } catch (reason) { const message = (reason as Error).message || "Couldn’t save"; failureRef.current = message; setFailure(message); }
  };
  const keydown = (event: ReactKeyboardEvent) => {
    const command = isMac ? event.metaKey : event.ctrlKey;
    if (command && event.key.toLowerCase() === "s") { event.preventDefault(); void saveNow(); }
    if (command && event.key.toLowerCase() === "z") { event.preventDefault(); void applyHistory(event.shiftKey ? "redo" : "undo"); }
    if (!isMac && event.ctrlKey && event.key.toLowerCase() === "y") { event.preventDefault(); void applyHistory("redo"); }
  };

  const enterMobileEdit = (event: ReactMouseEvent<HTMLDivElement>) => {
    const root = mobileViewRef.current;
    const selection = getSelection();
    if (!root || (event.target as Element).closest("a") || Date.now() < mobileLongPress.current.suppressUntil || (selection && !selection.isCollapsed && (root.contains(selection.anchorNode) || root.contains(selection.focusNode)))) return;
    const point = document.caretPositionFromPoint?.(event.clientX, event.clientY); const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
    const offset = sourceOffsetFromRenderedPoint(root, body, point?.offsetNode || range?.startContainer || event.target, point?.offset ?? range?.startOffset ?? 0, event.clientX, event.clientY);
    setEditing(true); requestAnimationFrame(() => { bodyRef.current?.focus({ preventScroll: true }); bodyRef.current?.setSelectionRange(offset, offset); });
  };
  const mobilePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("a")) return;
    clearTimeout(mobileLongPress.current.timer); mobileLongPress.current.started = performance.now(); mobileLongPress.current.x = event.clientX; mobileLongPress.current.y = event.clientY;
    mobileLongPress.current.timer = window.setTimeout(() => { mobileLongPress.current.suppressUntil = Date.now() + 900; }, 450);
  };
  const mobilePointerUp = () => { clearTimeout(mobileLongPress.current.timer); if (mobileLongPress.current.started && performance.now() - mobileLongPress.current.started >= 450) mobileLongPress.current.suppressUntil = Date.now() + 900; mobileLongPress.current.started = 0; };

  return <section id="editor" className={`surface react-editor ${narrow ? "mobile-unified" : ""} ${editing ? "is-editing" : ""}`} aria-labelledby="editor-heading" onKeyDown={keydown}>
    <div className="surface-inner">
      <header className="surface-header editor-header">
        <h1 id="editor-heading" className="sr-only">{saved ? "Edit snippet" : "New snippet"}</h1>
        <Button label="Back" className="mobile-back" onClick={() => void close()}><ChevronLeft /></Button>
        <Button label={reader ? "Show sidebar" : "Hide sidebar"} shortcut={isMac ? "⌘\\" : "Ctrl+\\"} className="reader-toggle" onClick={onToggleReader}><PanelLeft /></Button>
        {renaming ? <input className="editor-name-input" aria-label="Title" placeholder="Title" value={title} autoFocus maxLength={160} onChange={event => setTitle(event.target.value)} onBlur={() => setRenaming(false)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); setRenaming(false); bodyRef.current?.focus(); } if (event.key === "Escape") setRenaming(false); }} /> : <button className="editor-name-action" type="button" aria-label="Rename" title="Rename" onClick={() => setRenaming(true)}>{title}</button>}
        {slow && <span className="editor-status">Saving…</span>}{failure && <span className="editor-status">Couldn’t save · <button className="editor-retry" onClick={() => void saveNow()}>Retry</button></span>}
        <div className="editor-actions">
          <Button label="Copy" onClick={() => saved && void onCopy({ ...saved, body, title })}><Copy /></Button>
          <Button label="Share" onClick={() => saved && void onShare(saved)} disabled={!saved}><Share /></Button>
          <Button label="Undo" onClick={() => void applyHistory("undo")} disabled={!localUndo.current.length && !saved?.can_undo}><Undo2 /></Button>
          <Button label="Redo" onClick={() => void applyHistory("redo")} disabled={!localRedo.current.length && !saved?.can_redo}><Redo2 /></Button>
          <Button label="Delete" className="mobile-delete" onClick={async () => { if (saved) await onDelete(saved); }} disabled={!saved}><Trash2 /></Button>
        </div>
        <Button label="Close editor" className="desktop-close" onClick={() => void close()}><X /></Button>
      </header>
      {saved?.share_token && <button className="editor-unshare text-button" type="button" onClick={() => setConfirmUnshare(true)}>Stop sharing</button>}
      {!editing && narrow && <div ref={mobileViewRef} className="content-input mobile-snippet-view markdown-body" role="button" tabIndex={0} aria-label="Edit snippet text" dangerouslySetInnerHTML={markdownHtml(body)} onClick={enterMobileEdit} onPointerDown={mobilePointerDown} onPointerMove={event => { if (Math.hypot(event.clientX - mobileLongPress.current.x, event.clientY - mobileLongPress.current.y) > 8) clearTimeout(mobileLongPress.current.timer); }} onPointerUp={mobilePointerUp} onPointerCancel={mobilePointerUp} onContextMenu={() => { mobileLongPress.current.suppressUntil = Date.now() + 900; }} />}
      <textarea ref={bodyRef} className="content-input" aria-label="Snippet text" autoComplete="off" value={body} onChange={event => setBody(event.target.value)} onBlur={() => { if (narrow) setEditing(false); }} hidden={!editing && narrow} />
    </div>
    {confirmUnshare && <ConfirmDialog title="Stop sharing?" message="Anyone using the current link will no longer be able to view this snippet." action="Stop sharing" onCancel={() => setConfirmUnshare(false)} onConfirm={async () => { if (saved) await onUnshare(saved); setConfirmUnshare(false); }} />}
  </section>;
}

function ConfirmDialog({ title, message, action, children, disabled = false, onCancel, onConfirm }: { title: string; message: string; action: string; children?: React.ReactNode; disabled?: boolean; onCancel(): void; onConfirm(): void | Promise<void> }) {
  return <div className="react-confirm-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="react-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="react-confirm-title" aria-describedby="react-confirm-message">
      <h2 id="react-confirm-title">{title}</h2><p id="react-confirm-message">{message}</p>{children}
      <div className="react-confirm-actions"><button className="text-button" type="button" autoFocus onClick={onCancel}>Cancel</button><button className="confirm-action" type="button" disabled={disabled} onClick={() => void onConfirm()}>{action}</button></div>
    </section>
  </div>;
}

function ActionMenu({ snippet, point, onClose, onOpen, onCopy, onShare, onEdit, onDelete }: { snippet: Snippet; point: { x: number; y: number } | null; onClose(): void; onOpen(): void; onCopy(): void; onShare(): void; onEdit(): void; onDelete(): void }) {
  const url = snippetUrl(snippet); const style = point ? { left: Math.min(point.x, innerWidth - 228), top: Math.min(point.y, innerHeight - 280) } : undefined;
  const run = (action: () => void) => { onClose(); action(); };
  return <div className="react-menu-backdrop" role="presentation" onPointerDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={`snippet-action-menu react-action-menu ${point ? "desktop-context" : ""}`} style={style} role="menu" aria-label="Snippet actions" tabIndex={-1}>
      <div className="snippet-action-list">
        {url && <button role="menuitem" onClick={() => run(onOpen)}><ExternalLink /><span>Open</span></button>}
        <button role="menuitem" onClick={() => run(onCopy)}><Copy /><span>Copy</span></button>
        <button role="menuitem" onClick={() => run(onShare)}><Share /><span>Share</span></button>
        <button role="menuitem" onClick={() => run(onEdit)}><Pencil /><span>Edit</span></button>
        <button role="menuitem" onClick={() => run(onDelete)}><Trash2 /><span>Delete</span></button>
      </div>
    </div>
  </div>;
}

function SettingsPanel({ user, preferences, setPreferences, snippets, onClose, onDeleted, notify }: { user: User; preferences: { autocompleteTrigger: string }; setPreferences(value: { autocompleteTrigger: string }): void; snippets: Snippet[]; onClose(): void; onDeleted(): void; notify(value: Toast): void }) {
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("linksaw-theme") as Theme) || "system");
  const [trigger, setTrigger] = useState(preferences.autocompleteTrigger);
  const [transferStatus, setTransferStatus] = useState(""); const fileRef = useRef<HTMLInputElement>(null); const parserRef = useRef<"csv" | "json">("json");
  const [deleteOpen, setDeleteOpen] = useState(false); const [deleteText, setDeleteText] = useState(""); const [deleteError, setDeleteError] = useState("");
  useEffect(() => { document.documentElement.dataset.theme = theme === "system" ? "" : theme; localStorage.setItem("linksaw-theme", theme); }, [theme]);
  const saveTrigger = async () => { const result = await linksawApi.savePreferences(trigger); setPreferences(result); notify({ message: "Saved" }); };
  const importFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return; try {
      const values = parserRef.current === "csv" ? parseCsvSnippets(await file.text()) : parseJsonSnippets(await file.text()); let count = 0;
      for (const value of values) { await linksawApi.create({ ...value, importId: crypto.randomUUID() }); count++; }
      setTransferStatus(`Imported ${count} snippet${count === 1 ? "" : "s"}.`);
    } catch (reason) { setTransferStatus((reason as Error).message); }
  };
  const choose = (type: "csv" | "json") => { parserRef.current = type; fileRef.current?.click(); };
  const download = (type: "csv" | "json") => { const text = type === "csv" ? snippetsToCsv(snippets) : snippetsToJson(snippets); const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([text], { type: type === "csv" ? "text/csv" : "application/json" })); link.download = `linksaw-snippets.${type}`; link.click(); URL.revokeObjectURL(link.href); };
  return <section className="surface react-settings" aria-labelledby="settings-title">
    <div className="settings-inner">
      <header className="surface-header settings-header"><h1 id="settings-title">Settings</h1><div className="settings-header-actions"><button className="settings-sign-out" onClick={async () => { await linksawApi.logout(); location.assign("/"); }}>Sign out</button><Button label="Close Settings" onClick={onClose}><X /></Button></div></header>
      <div className="settings-content">
        <section className="settings-section"><h2>Appearance</h2><label className="field-label" htmlFor="appearance">Theme</label><select id="appearance" value={theme} onChange={event => setTheme(event.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></section>
        <section className="settings-section shortcuts"><h2>Shortcuts</h2><dl><div><dt>↑ ↓</dt><dd>Select a snippet</dd></div><div><dt>Return</dt><dd>View selected snippet</dd></div><div><dt>→</dt><dd>Copy text or open website</dd></div><div><dt>⌘/Ctrl N</dt><dd>New snippet</dd></div><div><dt>Esc</dt><dd>Go back</dd></div><div><dt>/</dt><dd>Focus search</dd></div></dl></section>
        <section className="settings-section extension-settings"><h2>Chrome extension</h2><label className="field-label" htmlFor="trigger">Autocomplete trigger</label><div className="trigger-row"><input id="trigger" className="trigger-input" value={trigger} onChange={event => setTrigger(event.target.value)} /><button className="text-button" onClick={() => void saveTrigger()}>Save</button></div><p className="field-help">Press a one-, two-, or three-key shortcut to open Linksaw in an editable field.</p></section>
        <section className="settings-section transfer-settings"><h2>Import and export</h2><div className="transfer-actions"><button className="transfer-button" onClick={() => choose("csv")}>Import CSV</button><button className="transfer-button" onClick={() => choose("json")}>Import JSON</button><button className="transfer-button" onClick={() => download("csv")}>Export CSV</button><button className="transfer-button" onClick={() => download("json")}>Export JSON</button></div><input ref={fileRef} type="file" hidden onChange={event => void importFile(event)} /><p className="field-help" role="status">{transferStatus}</p></section>
        <section className="settings-section account-block"><h2>Account</h2><p>{user.email}</p><a className="settings-website-link" href="https://linksaw.com/?website=1">Linksaw website</a></section>
        <section className="settings-section recently-deleted-settings"><button className="settings-folder" onClick={onDeleted}><span>Recently deleted</span><span aria-hidden>›</span></button></section>
        <section className="settings-section delete-account-block"><h2>Danger zone</h2><p>Permanently delete your account and every snippet associated with it. This cannot be undone.</p><button className="text-button danger-button" onClick={() => { setDeleteText(""); setDeleteError(""); setDeleteOpen(true); }}>Delete account</button></section>
      </div>
    </div>
    {deleteOpen && <ConfirmDialog title="Delete account?" message="This permanently deletes your account and every snippet associated with it. This cannot be undone." action="Delete account" disabled={deleteText !== "delete"} onCancel={() => setDeleteOpen(false)} onConfirm={async () => { try { await linksawApi.deleteAccount(); location.assign("/"); } catch (reason) { setDeleteError((reason as Error).message); } }}><label className="field-label" htmlFor="delete-confirmation">Type <strong>delete</strong> to confirm.</label><input id="delete-confirmation" className="confirm-input" value={deleteText} autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={event => { setDeleteText(event.target.value); setDeleteError(""); }} />{deleteError && <p className="confirm-error" role="status">{deleteError}</p>}</ConfirmDialog>}
  </section>;
}

function DeletedPanel({ snippets, setSnippets, onBack, onRestored }: { snippets: Snippet[]; setSnippets(value: Snippet[]): void; onBack(): void; onRestored(snippet: Snippet): void }) {
  const [status, setStatus] = useState("");
  return <section className="surface"><div className="settings-inner"><header className="surface-header"><Button label="Back to Settings" onClick={onBack}><ChevronLeft /></Button><h1>Recently deleted</h1></header><div className="deleted-panel-content"><p className="field-help">Deleted snippets remain available for 30 days.</p><div className="deleted-snippet-list" role="list">{!snippets.length ? <p className="deleted-snippet-empty">No recently deleted snippets.</p> : snippets.map(snippet => <div className="deleted-snippet-row" role="listitem" key={snippet.id}><span className="deleted-snippet-name">{snippetLabel(snippet)}</span><button className="deleted-snippet-action" onClick={async () => { const restored = await linksawApi.restoreDeleted(snippet); setSnippets(snippets.filter(item => item.id !== snippet.id)); onRestored(restored.snippet); setStatus("Restored"); }}>Restore</button><button className="deleted-snippet-action" onClick={async () => { await linksawApi.deleteForever(snippet); setSnippets(snippets.filter(item => item.id !== snippet.id)); setStatus("Permanently deleted"); }}>Delete permanently</button></div>)}</div><p className="field-help" role="status">{status}</p></div></div></section>;
}
