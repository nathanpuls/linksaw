import { parseCsvSnippets, parseJsonSnippets, snippetsToCsv, snippetsToJson } from "./transfers.js?v=20260923-2";
import { renderMarkdown } from "./markdown.js?v=20260924-1";

const API = "https://snippets-api.linksaw.com";
const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  panelLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
  chevronRight: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>',
};

const $ = id => document.getElementById(id);
const state = { snippets: [], filtered: [], selected: -1, editing: null, editorContext: null, previewing: null, user: null };
let deletedSnippets = [];
const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const sidebarShortcutLabel = isMacPlatform ? "⌘\\" : "Ctrl+\\";
const commandShortcut = key => isMacPlatform ? `⌘${key}` : `Ctrl+${key}`;
const tooltipMedia = matchMedia("(hover: none), (pointer: coarse)");
const tooltipsEnabled = () => !tooltipMedia.matches;
let toastTimer;
let copyFeedbackTimer;
let tooltipTimer;
let tooltipTarget;
let undoTimer;
let pendingUndo;
let deletingSnippetId = "";
let editorCustomName = "";
let inlineRenameBaseline = "";
let editorBaseline = "";
let autosaveTimer;
let saveInFlight;
let saveAgain = false;
let saveFailed = false;
let editorConflict = null;
let pendingNavigation;
let editorSessionId = 0;
let editorCreateId = "";
let localUndo = [];
let localRedo = [];
let localInputGroup = null;

function icon(id, name) { $(id).innerHTML = icons[name]; }
icon("add", "plus"); icon("search-icon", "search"); icon("clear-search", "close"); icon("close-editor", "close");
icon("close-preview", "back"); icon("preview-edit", "edit"); icon("preview-copy", "copy"); icon("preview-share", "share"); icon("preview-delete", "trash"); icon("close-settings", "back");
icon("editor-reader-toggle", "panelLeft"); icon("editor-undo", "undo"); icon("editor-redo", "redo"); icon("delete", "trash");
$("toggle-sidebar-shortcut").textContent = sidebarShortcutLabel;
$("add").dataset.shortcut = commandShortcut("N");
$("preview-copy").dataset.shortcut = commandShortcut("C");
$("editor-undo").dataset.shortcut = commandShortcut("Z");
$("editor-redo").dataset.shortcut = isMacPlatform ? "⌘⇧Z" : "Ctrl+Y";

function hideTooltip() {
  clearTimeout(tooltipTimer);
  tooltipTarget = null;
  $("linksaw-tooltip").hidden = true;
}
function placeTooltip(target) {
  if (!tooltipsEnabled()) { hideTooltip(); return; }
  $("tooltip-label").textContent = target.dataset.tooltip;
  const shortcut = $("tooltip-shortcut");
  shortcut.textContent = target.dataset.shortcut || "";
  shortcut.hidden = !target.dataset.shortcut;
  const tooltip = $("linksaw-tooltip");
  tooltip.hidden = false;
  const rect = target.getBoundingClientRect();
  const tip = tooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(innerWidth - tip.width - 8, rect.left + rect.width / 2 - tip.width / 2));
  const below = rect.bottom + 8;
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${below + tip.height <= innerHeight - 8 ? below : rect.top - tip.height - 8}px`;
}
function showTooltip(target) {
  if (!tooltipsEnabled() || !target?.dataset.tooltip) return;
  tooltipTarget = target;
  tooltipTimer = setTimeout(() => {
    if (tooltipTarget !== target || (!target.matches(":hover") && document.activeElement !== target)) return;
    placeTooltip(target);
  }, 450);
}
document.addEventListener("pointerover", event => {
  const target = event.target.closest?.("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) showTooltip(target);
});
document.addEventListener("pointerout", event => {
  const target = event.target.closest?.("[data-tooltip]");
  if (!target || target.contains(event.relatedTarget)) return;
  queueMicrotask(() => { if (!target.matches(":hover")) hideTooltip(); });
});
document.addEventListener("focusin", event => showTooltip(event.target.closest?.("[data-tooltip]")));
document.addEventListener("focusout", event => {
  const target = event.target.closest?.("[data-tooltip]");
  queueMicrotask(() => { if (target && !target.matches(":hover") && document.activeElement !== target) hideTooltip(); });
});
document.addEventListener("click", event => { if (!event.target.closest?.("#preview-copy")) hideTooltip(); });
addEventListener("scroll", hideTooltip, true);
addEventListener("resize", hideTooltip);
addEventListener("blur", hideTooltip);
addEventListener("pagehide", hideTooltip);
document.addEventListener("visibilitychange", () => { if (document.hidden) hideTooltip(); });
tooltipMedia.addEventListener?.("change", hideTooltip);

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, { credentials: "include", ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  if (response.status === 401) { location.replace("/login"); throw new Error("Sign in required"); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Something went wrong");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function derivedLabel(body) {
  return body.split(/\r?\n/).find(line => line.trim())?.trim().slice(0, 90) || "Untitled";
}
function label(snippet) { return snippet.title.trim() || derivedLabel(snippet.body); }
function libraryFingerprint(snippets) {
  return JSON.stringify(snippets.map(snippet => [
    snippet.id, snippet.title, snippet.body, snippet.version, snippet.share_token,
    snippet.can_undo, snippet.can_redo,
  ]));
}
function renderIdentity(user) {
  const name = user.display_name?.trim() || user.email?.split("@", 1)[0] || "Account";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => Array.from(part)[0]?.toUpperCase()).join("") || "A";
  const avatar = $("account-avatar");
  const fallback = $("account-avatar-fallback");
  $("account-name").textContent = name;
  fallback.textContent = initials;
  avatar.hidden = true;
  fallback.hidden = false;
  try {
    const url = new URL(user.avatar_url || "");
    if (url.protocol !== "https:") return;
    avatar.onload = () => { avatar.hidden = false; fallback.hidden = true; };
    avatar.onerror = () => { avatar.hidden = true; fallback.hidden = false; };
    avatar.src = url.href;
  } catch {}
}
function snippetText(snippet) { return snippet.body || ""; }
function standaloneUrl(snippet) {
  const text = snippetText(snippet).trim();
  if (/^https?:\/\/[^\s]+$/i.test(text)) return text;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(text)) return `https://${text}`;
  return "";
}
function openInNewTab(url) {
  if (document.documentElement.dataset.linksawExtension === "ready") {
    window.dispatchEvent(new CustomEvent("LINKSAW_OPEN_ACTIVE_TAB", { detail: url }));
    return;
  }
  const opened = window.open(url, "_blank");
  if (!opened) return;
  opened.opener = null;
  opened.focus();
}
function showToast(message = "Copied") {
  if (pendingUndo) return;
  clearTimeout(toastTimer); $("toast-message").textContent = message; $("toast-action").hidden = true; $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 1400);
}
function showDeleteUndo(deleted, viewerWasOpen) {
  clearTimeout(toastTimer);
  clearTimeout(undoTimer);
  pendingUndo = { deleted, viewerWasOpen };
  $("toast-message").textContent = "Snippet deleted ·";
  $("toast-action").textContent = "Undo";
  $("toast-action").disabled = false;
  $("toast-action").hidden = false;
  $("toast").hidden = false;
  undoTimer = setTimeout(() => {
    pendingUndo = null;
    $("toast").hidden = true;
  }, 7000);
}
function showCopySuccess() {
  clearTimeout(copyFeedbackTimer);
  const button = $("preview-copy");
  button.innerHTML = icons.check;
  button.ariaLabel = "Copied";
  button.dataset.tooltip = "Copied";
  hideTooltip();
  if (tooltipsEnabled()) {
    tooltipTarget = button;
    placeTooltip(button);
  }
  const announcement = $("copy-announcement");
  announcement.textContent = "";
  requestAnimationFrame(() => { announcement.textContent = "Copied to clipboard"; });
  copyFeedbackTimer = setTimeout(() => {
    button.innerHTML = icons.copy;
    button.ariaLabel = "Copy snippet";
    button.dataset.tooltip = "Copy";
    if (tooltipTarget === button && !$("linksaw-tooltip").hidden) placeTooltip(button);
  }, 1800);
}
function showCopyError(error) {
  showError(error);
  showToast("Could not copy to clipboard");
}
async function copySnippet(snippet) {
  await navigator.clipboard.writeText(snippetText(snippet));
  showCopySuccess();
}
async function shareSnippet(snippet) {
  hideTooltip();
  const share = await api(`/snippets/${snippet.id}/share`, { method: "POST" });
  snippet.share_token = share.token;
  if (navigator.share) {
    try { await navigator.share({ title: label(snippet), url: share.url }); return; }
    catch (error) { if (error?.name === "AbortError") return; }
    finally { hideTooltip(); $("preview-share").blur(); }
  }
  await navigator.clipboard.writeText(share.url);
  $("preview-share").blur();
  showToast("Link copied");
}
function setSelected(index, scroll = true) {
  state.selected = Math.max(0, Math.min(index, Math.max(0, state.filtered.length - 1)));
  document.querySelectorAll(".result-row").forEach((row, i) => {
    const selected = i === state.selected;
    row.classList.toggle("selected", selected);
    row.querySelector(".result-main")?.setAttribute("aria-current", selected ? "true" : "false");
  });
  if (scroll) document.querySelector(`.result-row[data-index="${state.selected}"]`)?.scrollIntoView({ block: "nearest" });
  renderViewer(state.filtered[state.selected] || null);
}
function openSnippet(snippet) {
  openPreview(snippet);
}
async function useSnippet(snippet) {
  const url = standaloneUrl(snippet);
  if (url) { openInNewTab(url); return; }
  await navigator.clipboard.writeText(snippetText(snippet));
  showToast("Copied");
}
function runListActionAfterSave(action) {
  void navigateAfterSave(() => {
    if (!$("editor").hidden) closeSurface("editor");
    action();
  });
}
function render() {
  const query = $("search").value.trim().toLowerCase();
  state.filtered = state.snippets.filter(s => !query || `${s.title}\n${s.body}`.toLowerCase().includes(query));
  if (state.selected >= state.filtered.length) state.selected = state.filtered.length - 1;
  const results = $("results"); results.replaceChildren();
  if (!state.filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty";
    empty.textContent = query ? "No matches" : "No snippets yet";
    if (!query) { const button = document.createElement("button"); button.className = "text-button"; button.textContent = "Create a snippet"; button.addEventListener("click", () => { void navigateAfterSave(() => openEditor()); }); empty.append(button); }
    results.append(empty); renderViewer(null); return;
  }
  state.filtered.forEach((snippet, index) => {
    const url = standaloneUrl(snippet);
    const hasTitle = Boolean(snippet.title.trim());
    const hasPreview = hasTitle && snippet.body.trim() && (url || snippet.title.trim() !== snippet.body.trim());
    const row = document.createElement("article"); row.className = `result-row${url ? " has-url" : ""}${hasPreview ? " has-preview" : ""}${index === state.selected ? " selected" : ""}`; row.dataset.index = index; row.setAttribute("role", "listitem");
    const main = document.createElement("button"); main.type = "button"; main.className = "result-main";
    main.setAttribute("aria-current", index === state.selected ? "true" : "false");
    const text = document.createElement("span"); text.className = "result-text";
    const title = document.createElement("div"); title.className = "result-title"; title.textContent = label(snippet);
    const preview = document.createElement("div"); preview.className = "result-preview"; preview.textContent = snippet.body.replace(/\s+/g, " ").trim();
    if (url && !hasTitle) title.classList.add("result-link-text");
    if (url) preview.classList.add("result-link-text");
    text.append(title);
    if (hasPreview) text.append(preview);
    main.append(text);
    main.ariaLabel = label(snippet);
    main.setAttribute("aria-description", "Open in Linksaw");
    main.addEventListener("focus", () => setSelected(index, false));
    main.addEventListener("click", () => runListActionAfterSave(() => { setSelected(index); openSnippet(snippet); }));
    row.append(main);
    const use = document.createElement("button"); use.type = "button"; use.className = "result-use icon-button";
    use.ariaLabel = url ? "Open website" : "Copy"; use.dataset.tooltip = "Use"; use.innerHTML = icons.chevronRight;
    use.addEventListener("focus", () => setSelected(index, false));
    use.addEventListener("click", event => { event.stopPropagation(); runListActionAfterSave(() => { setSelected(index, false); void useSnippet(snippet).catch(showCopyError); }); });
    row.append(use);
    results.append(row);
  });
  renderViewer(state.selected >= 0 ? state.filtered[state.selected] : null);
}
function showError(error) { $("status").textContent = error.message || String(error); }
function updateUrl(values, push = true) {
  const url = new URL(location.href);
  url.pathname = "/home/";
  url.searchParams.delete("new");
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  }
  const routeState = push
    ? { ...(history.state || {}), linksawPushed: true }
    : { ...(history.state || {}), linksawPushed: history.state?.linksawPushed === true };
  history[push ? "pushState" : "replaceState"](routeState, "", `${url.pathname}${url.search}`);
}
function showSurface(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeSurface(id) {
  $(id).hidden = true;
  if (id === "editor") state.editorContext = null;
  if (!["editor", "settings-panel"].some(name => !$(name).hidden)) document.body.style.overflow = "";
  if ($("app").classList.contains("viewer-open")) $("close-preview").focus(); else $("search").focus();
}
function syncEditorName() {
  $("editor-name").textContent = editorCustomName.trim() || derivedLabel($("snippet-body").value);
}
function editorSnapshot() {
  const title = $("editor-name-input").hidden ? editorCustomName : $("editor-name-input").value.trim();
  return JSON.stringify({ title, body: $("snippet-body").value });
}
function editorDraftKey() { return `linksaw-draft:${state.editing?.id || editorCreateId}`; }
function persistEditorDraft() {
  if ($("editor").hidden) return;
  localStorage.setItem(editorDraftKey(), JSON.stringify({ snapshot: editorSnapshot(), version: state.editing?.version ?? null, savedAt: Date.now() }));
}
function clearEditorDraft(key = editorDraftKey()) { localStorage.removeItem(key); }
function editorValue() { return JSON.parse(editorSnapshot()); }
function setEditorStatus(status) {
  $("editor-status-text").textContent = status;
  $("editor-retry").hidden = status !== "Couldn’t save ·";
}
function syncHistoryControls() {
  $("editor-undo").disabled = !localUndo.length && !state.editing?.can_undo;
  $("editor-redo").disabled = !localRedo.length && !state.editing?.can_redo;
}
function rememberLocalState(target) {
  const now = Date.now();
  if (!localInputGroup || localInputGroup.target !== target || now - localInputGroup.time > 700) {
    const snapshot = editorSnapshot();
    if (localUndo.at(-1) !== snapshot) localUndo.push(snapshot);
    if (localUndo.length > 100) localUndo.shift();
    localRedo = [];
  }
  localInputGroup = { target, time: now };
  syncHistoryControls();
}
function applyEditorSnapshot(snapshot) {
  const value = JSON.parse(snapshot);
  editorCustomName = value.title;
  $("snippet-body").value = value.body;
  $("editor-name-input").hidden = true;
  $("editor-name").hidden = false;
  syncEditorName();
  scheduleAutosave();
  syncHistoryControls();
}
function scheduleAutosave() {
  clearTimeout(autosaveTimer);
  saveFailed = false;
  editorConflict = null;
  $("editor-retry").hidden = true;
  persistEditorDraft();
  if (saveInFlight) saveAgain = true;
  autosaveTimer = setTimeout(() => { void saveEditorNow(); }, 700);
}
function upsertSavedSnippet(snippet) {
  const index = state.snippets.findIndex(item => item.id === snippet.id);
  if (index >= 0) state.snippets[index] = snippet;
  else state.snippets.unshift(snippet);
  state.snippets.sort((a, b) => b.updated_at - a.updated_at || b.id.localeCompare(a.id));
  state.editing = snippet;
  render();
  state.selected = Math.max(0, state.filtered.findIndex(item => item.id === snippet.id));
  document.querySelectorAll(".result-row").forEach((row, rowIndex) => row.classList.toggle("selected", rowIndex === state.selected));
  syncHistoryControls();
}
async function runSaveLoop(sessionId) {
  do {
    saveAgain = false;
    const snapshot = editorSnapshot();
    const value = JSON.parse(snapshot);
    if (snapshot === editorBaseline) return true;
    if (!state.editing && !value.body.trim()) { setEditorStatus(""); return true; }
    if (!value.title.trim() && !value.body.trim()) { setEditorStatus("Couldn’t save ·"); saveFailed = true; return false; }
    setEditorStatus("Saving…");
    try {
      const creating = !state.editing;
      const result = await api(creating ? "/snippets" : `/snippets/${state.editing.id}`, {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify(creating ? { ...value, importId: editorCreateId } : { ...value, version: state.editing.version }),
      });
      if (sessionId !== editorSessionId) return true;
      const wasNew = creating;
      let savedSnippet = result.snippet;
      // A create may have reached the server even if its response was lost. The
      // stable create ID makes the retry idempotent; fetch its canonical row
      // when the retry response only needs to return the existing ID.
      if (!savedSnippet) {
        const { snippets } = await api("/snippets");
        savedSnippet = snippets.find(snippet => snippet.id === result.id);
        if (!savedSnippet) throw new Error("Saved snippet could not be loaded");
      }
      editorBaseline = snapshot;
      saveFailed = false;
      editorConflict = null;
      clearEditorDraft();
      upsertSavedSnippet(savedSnippet);
      $("delete").hidden = false;
      $("unshare").hidden = !savedSnippet.share_token;
      if (wasNew && state.editorContext !== "default") updateUrl({ view: "edit", snippet: savedSnippet.id }, false);
      if (editorSnapshot() === editorBaseline) setEditorStatus("Saved");
    } catch (error) {
      if (sessionId !== editorSessionId) return false;
      const conflict = error.status === 409 ? error.data?.snippet || null : null;
      // A request can reach D1 even when its response is lost. If the server's
      // newer row is exactly this settled edit, treat the retry as confirmed.
      if (conflict && conflict.title === value.title && conflict.body === value.body) {
        editorBaseline = snapshot;
        saveFailed = false;
        editorConflict = null;
        clearEditorDraft();
        upsertSavedSnippet(conflict);
        setEditorStatus("Saved");
        continue;
      }
      saveFailed = true;
      editorConflict = conflict;
      setEditorStatus(editorConflict ? "Changed elsewhere ·" : "Couldn’t save ·");
      $("editor-retry").textContent = editorConflict ? "Save mine" : "Retry";
      $("editor-retry").hidden = false;
      persistEditorDraft();
      return false;
    }
  } while (saveAgain || editorSnapshot() !== editorBaseline);
  return true;
}
async function saveEditorNow() {
  clearTimeout(autosaveTimer);
  if ($("editor").hidden) return true;
  const sessionId = editorSessionId;
  if (saveInFlight) {
    saveAgain = true;
    await saveInFlight;
    if (sessionId !== editorSessionId) return true;
    if (!saveFailed && editorSnapshot() !== editorBaseline) return saveEditorNow();
    return !saveFailed;
  }
  saveInFlight = runSaveLoop(sessionId);
  const result = await saveInFlight;
  saveInFlight = null;
  if (sessionId === editorSessionId && !saveFailed && editorSnapshot() !== editorBaseline) return saveEditorNow();
  return result && !saveFailed;
}
async function flushEditorSave() {
  clearTimeout(autosaveTimer);
  if ($("editor").hidden) return true;
  if (!$("editor-name-input").hidden) finishInlineRename();
  const value = editorValue();
  if (!state.editing && !value.body.trim()) return true;
  const saved = await saveEditorNow();
  return saved && editorSnapshot() === editorBaseline;
}
async function navigateAfterSave(destination) {
  if ($("editor").hidden) { destination(); return true; }
  pendingNavigation = destination;
  const saved = await flushEditorSave();
  if (!saved || pendingNavigation !== destination) return false;
  pendingNavigation = null;
  destination();
  return true;
}
function beginInlineRename() {
  hideTooltip();
  inlineRenameBaseline = editorCustomName;
  const automaticName = derivedLabel($("snippet-body").value);
  $("editor-name-input").value = editorCustomName || (automaticName === "Untitled" ? "" : automaticName);
  $("editor-name").hidden = true;
  $("editor-name-input").hidden = false;
  $("editor-name-input").focus();
  $("editor-name-input").select();
}
function finishInlineRename({ cancel = false } = {}) {
  const enteredName = $("editor-name-input").value.trim();
  const unchangedAutomaticName = !inlineRenameBaseline.trim() && enteredName === derivedLabel($("snippet-body").value);
  editorCustomName = cancel ? inlineRenameBaseline : unchangedAutomaticName ? "" : enteredName;
  $("editor-name-input").hidden = true;
  $("editor-name").hidden = false;
  syncEditorName();
  if (!cancel && editorSnapshot() !== editorBaseline) scheduleAutosave();
}
function leaveRoutedView() {
  if (history.state?.linksawPushed) { history.back(); return; }
  const params = new URLSearchParams(location.search);
  const snippet = params.get("view") === "edit" ? params.get("snippet") : null;
  updateUrl({ view: null, snippet }, false); applyUrlState();
}
function openEditor(snippet = null, pushHistory = true, options = {}) {
  hideTooltip();
  clearTimeout(autosaveTimer);
  editorSessionId++;
  const { defaultDraft = false, focus = true } = options;
  state.editing = snippet; $("snippet-body").value = snippet?.body || ""; editorCustomName = snippet?.title || "";
  editorCreateId = snippet ? "" : crypto.randomUUID();
  saveFailed = false; editorConflict = null; saveAgain = false; pendingNavigation = null; localUndo = []; localRedo = []; localInputGroup = null;
  state.editorContext = defaultDraft ? "default" : "routed";
  $("editor-heading").textContent = snippet ? "Edit snippet" : "New snippet";
  $("close-editor").hidden = defaultDraft;
  $("delete").hidden = !snippet; $("unshare").hidden = !snippet?.share_token; setEditorStatus("");
  $("editor-name-input").hidden = true; $("editor-name").hidden = false; syncEditorName(); showSurface("editor");
  editorBaseline = editorSnapshot();
  try {
    const draft = JSON.parse(localStorage.getItem(editorDraftKey()) || "null");
    if (draft?.snapshot && (draft.version === null || draft.version === snippet?.version)) {
      applyEditorSnapshot(draft.snapshot);
      setEditorStatus("Saving…");
    }
  } catch { clearEditorDraft(); }
  syncHistoryControls();
  if (pushHistory) updateUrl({ view: snippet ? "edit" : "new", snippet: snippet?.id || null });
  if (focus) setTimeout(() => { $("snippet-body").focus(); if (!snippet) $("snippet-body").setSelectionRange(0, 0); }, 0);
}
function renderViewer(snippet) {
  state.previewing = snippet;
  $("viewer-empty").hidden = Boolean(snippet); $("viewer-content").hidden = !snippet;
  if (!snippet) return;
  const heading = snippet.title.trim();
  $("preview-title").textContent = heading; $("preview-title").hidden = !heading;
  $("preview-body").hidden = !snippet.body;
  renderMarkdown($("preview-body"), snippet.body);
}
function narrowLayout() { return matchMedia("(max-width: 900px)").matches; }
function syncReaderMode() {
  const list = new URLSearchParams(location.search).get("list");
  const requested = list === "off" || (list !== "on" && sessionStorage.getItem("linksaw-reader-mode") === "true");
  const enabled = requested && !narrowLayout();
  $("app").classList.toggle("reader-mode", enabled);
  for (const id of ["reader-toggle", "editor-reader-toggle"]) {
    $(id).innerHTML = icons.panelLeft;
    $(id).ariaLabel = enabled ? "Show sidebar" : "Hide sidebar";
    $(id).dataset.tooltip = enabled ? "Show sidebar" : "Hide sidebar";
    $(id).dataset.shortcut = sidebarShortcutLabel;
  }
}
function openPreview(snippet, pushHistory = true) {
  if (!snippet) return;
  hideTooltip();
  renderViewer(snippet);
  if (pushHistory) updateUrl({ view: null, snippet: snippet.id });
  if (!narrowLayout()) return;
  const opening = !$("app").classList.contains("viewer-open");
  $("app").classList.add("viewer-open");
  setTimeout(() => $("close-preview").focus(), 0);
}
function closePreview() {
  leaveRoutedView();
}
function openSettings(pushHistory = true) {
  hideTooltip();
  showSurface("settings-panel");
  void loadDeletedSnippets();
  if (pushHistory) updateUrl({ view: "settings", snippet: null });
  if (location.hash === "#import-export" && !matchMedia("(max-width: 700px)").matches) {
    requestAnimationFrame(() => $("import-export").scrollIntoView({ block: "start" }));
  }
}

function deletedSnippetLabel(snippet) {
  return snippet.title?.trim() || snippet.body?.trim().split(/\r?\n/, 1)[0].slice(0, 80) || "Untitled";
}
function renderDeletedSnippets() {
  const list = $("deleted-snippet-list");
  list.replaceChildren();
  if (!deletedSnippets.length) {
    const empty = document.createElement("p");
    empty.className = "deleted-snippet-empty";
    empty.textContent = "No recently deleted snippets.";
    list.append(empty);
    return;
  }
  for (const snippet of deletedSnippets) {
    const row = document.createElement("div"); row.className = "deleted-snippet-row"; row.role = "listitem";
    const name = document.createElement("span"); name.className = "deleted-snippet-name"; name.textContent = deletedSnippetLabel(snippet);
    const restore = document.createElement("button"); restore.type = "button"; restore.className = "deleted-snippet-action"; restore.textContent = "Restore";
    restore.ariaLabel = `Restore ${deletedSnippetLabel(snippet)}`;
    restore.addEventListener("click", () => { void restoreDeletedSnippet(snippet); });
    const remove = document.createElement("button"); remove.type = "button"; remove.className = "deleted-snippet-action"; remove.textContent = "Delete permanently";
    remove.ariaLabel = `Permanently delete ${deletedSnippetLabel(snippet)}`;
    remove.addEventListener("click", () => { void permanentlyDeleteSnippet(snippet, remove); });
    row.append(name, restore, remove); list.append(row);
  }
}
async function loadDeletedSnippets() {
  const status = $("deleted-snippet-status");
  status.textContent = "";
  try {
    deletedSnippets = (await api("/deleted-snippets")).snippets;
    renderDeletedSnippets();
  } catch (error) { status.textContent = error.message; }
}
async function restoreDeletedSnippet(snippet) {
  const status = $("deleted-snippet-status"); status.textContent = "Restoring…";
  try {
    await api(`/deleted-snippets/${snippet.id}/restore`, { method: "POST" });
    deletedSnippets = deletedSnippets.filter(item => item.id !== snippet.id);
    state.snippets = (await api("/snippets")).snippets;
    render(); renderDeletedSnippets(); status.textContent = "Restored";
  } catch (error) { status.textContent = error.message; }
}
async function permanentlyDeleteSnippet(snippet, returnFocus) {
  const confirmed = await requestConfirmation({ title: "Delete permanently?", message: "This snippet cannot be recovered after permanent deletion.", action: "Delete permanently" });
  if (!confirmed) return;
  const status = $("deleted-snippet-status"); status.textContent = "Deleting…";
  try {
    await api(`/deleted-snippets/${snippet.id}`, { method: "DELETE" });
    deletedSnippets = deletedSnippets.filter(item => item.id !== snippet.id);
    renderDeletedSnippets(); status.textContent = "Permanently deleted";
  } catch (error) { status.textContent = error.message; returnFocus?.focus(); }
}
function hasExplicitRoute() {
  const params = new URLSearchParams(location.search);
  return Boolean(params.get("snippet") || params.get("view") || params.has("new") || location.pathname !== "/home/");
}
function showDefaultWorkspace() {
  state.selected = -1;
  render();
  if (!narrowLayout()) openEditor(null, false, { defaultDraft: true, focus: false });
  $("search").focus();
}
function revealInitialView() { document.documentElement.classList.remove("route-pending"); }
function applyUrlState() {
  hideTooltip();
  closeSurface("editor"); closeSurface("settings-panel"); $("app").classList.remove("viewer-open");
  const params = new URLSearchParams(location.search);
  syncReaderMode();
  const legacySnippet = location.pathname.match(/^\/home\/s\/([a-f0-9-]{36})\/?$/)?.[1];
  const snippetId = params.get("snippet") || legacySnippet;
  const view = params.get("view") || (location.pathname === "/home/new" || params.get("new") === "1" ? "new" : "");
  if (location.pathname !== "/home/" || params.has("new")) {
    updateUrl({ view: view || null, snippet: snippetId || null }, false);
  }
  if (view === "settings") { openSettings(false); revealInitialView(); return; }
  if (view === "new") { openEditor(null, false); revealInitialView(); return; }
  if (view === "edit" && snippetId) {
    const snippet = state.snippets.find(item => item.id === snippetId);
    if (snippet) { state.selected = state.filtered.findIndex(item => item.id === snippetId); render(); openEditor(snippet, false); }
    else $("status").textContent = "Snippet not found";
    revealInitialView(); return;
  }
  if (snippetId) {
    const index = state.filtered.findIndex(item => item.id === snippetId);
    const snippet = state.filtered[index];
    if (snippet) { setSelected(index, false); openPreview(snippet, false); }
    else $("status").textContent = "Snippet not found";
    revealInitialView(); return;
  }
  showDefaultWorkspace();
  revealInitialView();
}
async function load() {
  try {
    const [{ user }, { snippets }, preferences] = await Promise.all([api("/me"), api("/snippets"), api("/preferences")]);
    state.user = user; state.snippets = snippets; $("account").textContent = user.email; renderIdentity(user); $("app").ariaBusy = "false"; render();
    $("autocomplete-trigger").value = preferences.autocompleteTrigger || ";";
    applyUrlState();
  } catch (error) { revealInitialView(); showError(error); }
}

let syncInFlight = false;
async function syncFromServer() {
  if (syncInFlight || document.hidden || !state.user) return;
  syncInFlight = true;
  try {
    const { snippets } = await api("/snippets");
    const selectedId = state.filtered[state.selected]?.id || state.previewing?.id || null;
    if (!$('editor').hidden && state.editing) {
      const remote = snippets.find(snippet => snippet.id === state.editing.id);
      if (remote && remote.version !== state.editing.version) {
        const hasLocalChanges = editorSnapshot() !== editorBaseline || Boolean(saveInFlight);
        if (hasLocalChanges) {
          editorConflict = remote;
          saveFailed = true;
          setEditorStatus("Changed elsewhere ·");
          $("editor-retry").textContent = "Save mine";
          $("editor-retry").hidden = false;
          persistEditorDraft();
        } else {
          state.editing = remote;
          editorCustomName = remote.title;
          $("snippet-body").value = remote.body;
          syncEditorName();
          editorBaseline = editorSnapshot();
          setEditorStatus("Updated elsewhere");
        }
      }
    }
    const libraryChanged = libraryFingerprint(state.snippets) !== libraryFingerprint(snippets);
    state.snippets = snippets;
    if (libraryChanged) {
      render();
      if (selectedId) {
        const index = state.filtered.findIndex(snippet => snippet.id === selectedId);
        if (index >= 0) setSelected(index, false);
      }
    }
  } catch (error) {
    if (!$('editor').hidden && editorSnapshot() !== editorBaseline) {
      saveFailed = true;
      setEditorStatus("Couldn’t sync ·");
      $("editor-retry").textContent = "Retry";
      $("editor-retry").hidden = false;
      persistEditorDraft();
    }
  } finally { syncInFlight = false; }
}

$("search").addEventListener("input", () => {
  const query = $("search").value.trim();
  $("clear-search").hidden = !$("search").value;
  state.selected = -1; render();
  if (query && state.filtered.length) setSelected(0, false);
  else if (!query && !hasExplicitRoute() && !narrowLayout() && $("editor").hidden) openEditor(null, false, { defaultDraft: true, focus: false });
});
function defaultEditorOpen() { return state.editorContext === "default" && !$("editor").hidden; }
$("search").addEventListener("keydown", event => {
  if (event.key === "Tab" && !event.shiftKey && defaultEditorOpen()) {
    event.preventDefault(); $("snippet-body").focus();
  }
});
$("snippet-body").addEventListener("keydown", event => {
  if (event.key === "Tab" && event.shiftKey && defaultEditorOpen()) {
    event.preventDefault(); $("search").focus();
  }
});
$("clear-search").addEventListener("pointerdown", event => event.preventDefault());
function clearSearch() {
  $("search").value = "";
  $("search").dispatchEvent(new Event("input", { bubbles: true }));
  $("search").focus();
}
$("clear-search").addEventListener("click", clearSearch);
$("search-icon").addEventListener("click", () => $("search").focus());
$("add").addEventListener("click", () => { void navigateAfterSave(() => openEditor()); });
$("settings").addEventListener("click", () => { void navigateAfterSave(() => openSettings()); });
$("close-editor").addEventListener("click", () => { void navigateAfterSave(leaveRoutedView); });
$("close-preview").addEventListener("click", () => closePreview());
$("close-settings").addEventListener("click", leaveRoutedView);
$("preview-copy").addEventListener("click", () => copySnippet(state.previewing).catch(showCopyError));
$("preview-share").addEventListener("click", () => shareSnippet(state.previewing).catch(showError));
$("preview-edit").addEventListener("click", () => openEditor(state.previewing));
$("preview-delete").addEventListener("click", () => deleteSnippet(state.previewing));
$("editor-name").addEventListener("click", beginInlineRename);
$("editor-name-input").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); finishInlineRename(); $("snippet-body").focus(); }
  else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishInlineRename({ cancel: true }); $("snippet-body").focus(); }
});
$("editor-name-input").addEventListener("blur", () => { if (!$("editor-name-input").hidden) finishInlineRename(); });
function toggleReaderMode() {
  const enabled = !$("app").classList.contains("reader-mode");
  sessionStorage.setItem("linksaw-reader-mode", String(enabled)); updateUrl({ list: enabled ? "off" : "on" }, false); syncReaderMode();
}
function isSidebarShortcut(event) {
  if (event.key !== "\\" || event.altKey || event.shiftKey) return false;
  return isMacPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
$("reader-toggle").addEventListener("click", toggleReaderMode);
$("editor-reader-toggle").addEventListener("click", toggleReaderMode);
for (const input of [$("snippet-body"), $("editor-name-input")]) {
  input.addEventListener("beforeinput", event => {
    if (!event.inputType.startsWith("history")) rememberLocalState(input.id);
  });
}
$("snippet-body").addEventListener("input", () => {
  if (!editorCustomName.trim()) syncEditorName();
  scheduleAutosave();
});
$("editor-name-input").addEventListener("input", scheduleAutosave);
$("editor-form").addEventListener("submit", event => { event.preventDefault(); void saveEditorNow(); });
async function performEditorHistory(direction) {
  if ($("editor").hidden || saveInFlight) return;
  const from = direction === "undo" ? localUndo : localRedo;
  const to = direction === "undo" ? localRedo : localUndo;
  if (from.length) {
    to.push(editorSnapshot());
    localInputGroup = null;
    applyEditorSnapshot(from.pop());
    $("snippet-body").focus();
    return;
  }
  if (!state.editing?.[direction === "undo" ? "can_undo" : "can_redo"]) return;
  if (!await flushEditorSave()) return;
  setEditorStatus("Saving…");
  try {
    const { snippet } = await api(`/snippets/${state.editing.id}/revisions/${direction}`, { method: "POST" });
    state.editing = snippet;
    editorCustomName = snippet.title;
    $("snippet-body").value = snippet.body;
    $("editor-name-input").hidden = true;
    $("editor-name").hidden = false;
    syncEditorName();
    editorBaseline = editorSnapshot();
    upsertSavedSnippet(snippet);
    setEditorStatus("Saved");
    $("snippet-body").focus();
  } catch {
    saveFailed = true;
    setEditorStatus("Couldn’t save ·");
  }
}
$("editor-undo").addEventListener("click", () => { void performEditorHistory("undo"); });
$("editor-redo").addEventListener("click", () => { void performEditorHistory("redo"); });
$("editor-retry").addEventListener("click", async () => {
  if (editorConflict) {
    state.editing = { ...state.editing, ...editorConflict };
    editorConflict = null;
  }
  saveFailed = false;
  const saved = await saveEditorNow();
  if (saved && pendingNavigation) {
    const destination = pendingNavigation;
    pendingNavigation = null;
    destination();
  }
});
let confirmationResolver;
let confirmationReturnFocus;
function requestConfirmation({ title, message, action }) {
  const dialog = $("action-confirm-dialog");
  $("action-confirm-title").textContent = title;
  $("action-confirm-message").textContent = message;
  $("action-confirm-button").textContent = action;
  dialog.returnValue = "cancel";
  confirmationReturnFocus = document.activeElement;
  dialog.showModal();
  $("action-confirm-cancel").focus();
  return new Promise(resolve => { confirmationResolver = resolve; });
}
$("action-confirm-dialog").addEventListener("close", () => {
  confirmationResolver?.($("action-confirm-dialog").returnValue === "confirm");
  confirmationResolver = null;
  confirmationReturnFocus?.focus();
  confirmationReturnFocus = null;
});
function cancelDialogOnBackdrop(dialog) {
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close("cancel"); });
}
cancelDialogOnBackdrop($("action-confirm-dialog"));
cancelDialogOnBackdrop($("delete-account-dialog"));
async function deleteSnippet(snippet) {
  if (!snippet || deletingSnippetId === snippet.id) return;
  if (!$("editor").hidden && state.editing?.id === snippet.id && !await flushEditorSave()) return;
  deletingSnippetId = snippet.id;
  hideTooltip();
  const filteredIndex = state.filtered.findIndex(item => item.id === snippet.id);
  const filteredCount = state.filtered.length;
  const viewerWasOpen = $("editor").hidden && state.previewing?.id === snippet.id;
  try {
    const { deleted } = await api(`/snippets/${snippet.id}`, { method: "DELETE" });
    state.snippets = state.snippets.filter(item => item.id !== snippet.id);
    state.selected = filteredCount > 1 ? Math.min(Math.max(filteredIndex, 0), filteredCount - 2) : -1;
    if (!$("editor").hidden) { editorSessionId++; clearTimeout(autosaveTimer); closeSurface("editor"); }
    render();
    const next = state.filtered[state.selected] || null;
    if (narrowLayout()) $("app").classList.toggle("viewer-open", Boolean(viewerWasOpen && next));
    updateUrl({ view: null, snippet: next?.id || null }, false);
    showDeleteUndo(deleted, viewerWasOpen);
  } catch (error) {
    if (!$("editor").hidden) setEditorStatus("Couldn’t save ·");
    else showError(error);
  } finally {
    deletingSnippetId = "";
  }
}
$("delete").addEventListener("click", () => deleteSnippet(state.editing));
$("toast-action").addEventListener("click", async () => {
  if (!pendingUndo) return;
  const undo = pendingUndo;
  pendingUndo = null;
  clearTimeout(undoTimer);
  $("toast-action").disabled = true;
  try {
    await api(`/snippets/${undo.deleted.id}/restore`, { method: "POST", body: JSON.stringify(undo.deleted) });
    const data = await api("/snippets");
    state.snippets = data.snippets;
    render();
    const restoredIndex = state.filtered.findIndex(item => item.id === undo.deleted.id);
    if (restoredIndex >= 0) setSelected(restoredIndex, false);
    if (narrowLayout()) $("app").classList.toggle("viewer-open", Boolean(undo.viewerWasOpen && restoredIndex >= 0));
    updateUrl({ view: null, snippet: restoredIndex >= 0 ? undo.deleted.id : null }, false);
    $("toast").hidden = true;
  } catch (error) {
    $("toast").hidden = true;
    showError(error);
  }
});
$("unshare").addEventListener("click", async () => {
  if (!state.editing?.share_token || !await requestConfirmation({ title: "Stop sharing?", message: "Anyone using the current link will no longer be able to view this snippet.", action: "Stop sharing" })) return;
  try {
    await api(`/snippets/${state.editing.id}/share`, { method: "DELETE" });
    state.editing.share_token = null; $("unshare").hidden = true; setEditorStatus("Sharing stopped.");
  } catch (error) { setEditorStatus(error.message); }
});

let transferBusy = false;
function setTransferBusy(value) {
  transferBusy = value;
  document.querySelectorAll(".transfer-button").forEach(button => { button.disabled = value; });
}
function downloadLibrary(text, type, extension) {
  const date = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = `linksaw-snippets-${date}.${extension}`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  $("transfer-status").textContent = `Exported ${state.snippets.length} snippet${state.snippets.length === 1 ? "" : "s"}.`;
}
async function importLibrary(input, parser) {
  const file = input.files?.[0];
  if (!file || transferBusy) return;
  setTransferBusy(true); $("transfer-status").textContent = `Reading ${file.name}…`;
  let completed = 0;
  try {
    const snippets = parser(await file.text());
    for (const snippet of snippets) {
      $("transfer-status").textContent = `Importing ${completed + 1} of ${snippets.length}…`;
      await api("/snippets", { method: "POST", body: JSON.stringify({ ...snippet, importId: crypto.randomUUID() }) });
      completed++;
    }
    const data = await api("/snippets"); state.snippets = data.snippets; state.selected = -1; render();
    $("transfer-status").textContent = `Imported ${completed} snippet${completed === 1 ? "" : "s"}. Existing snippets were not changed.`;
  } catch (error) {
    if (completed) {
      const data = await api("/snippets").catch(() => null);
      if (data) { state.snippets = data.snippets; state.selected = -1; render(); }
    }
    $("transfer-status").textContent = `${completed ? `${completed} imported. ` : ""}${error.message || error}`;
  } finally {
    input.value = "";
    setTransferBusy(false);
  }
}
function chooseImport(id) {
  const input = $(id); input.value = ""; input.click();
}
$("import-csv").addEventListener("click", () => chooseImport("import-csv-file"));
$("import-json").addEventListener("click", () => chooseImport("import-json-file"));
$("import-csv-file").addEventListener("change", event => importLibrary(event.target, parseCsvSnippets));
$("import-json-file").addEventListener("change", event => importLibrary(event.target, parseJsonSnippets));
$("export-csv").addEventListener("click", () => downloadLibrary(snippetsToCsv(state.snippets), "text/csv;charset=utf-8", "csv"));
$("export-json").addEventListener("click", () => downloadLibrary(snippetsToJson(state.snippets), "application/json;charset=utf-8", "json"));

$("sign-out").addEventListener("click", async () => { try { await api("/auth/logout", { method: "POST" }); } finally { location.replace("/"); } });
$("delete-account").addEventListener("click", () => {
  $("delete-account-confirmation").value = "";
  $("delete-account-status").textContent = "";
  $("confirm-delete-account").disabled = true;
  $("delete-account-dialog").showModal();
  $("delete-account-confirmation").focus();
});
$("cancel-delete-account").addEventListener("click", () => $("delete-account-dialog").close());
$("delete-account-confirmation").addEventListener("input", event => {
  $("confirm-delete-account").disabled = event.target.value !== "delete";
  $("delete-account-status").textContent = "";
});
$("delete-account-form").addEventListener("submit", async event => {
  event.preventDefault();
  if ($("delete-account-confirmation").value !== "delete") return;
  const button = $("confirm-delete-account"); button.disabled = true; $("delete-account-status").textContent = "Deleting…";
  try {
    await api("/me", { method: "DELETE", body: JSON.stringify({ confirmation: "delete" }) });
    location.replace("/");
  } catch (error) {
    $("delete-account-status").textContent = error.message;
    button.disabled = false;
  }
});
$("appearance").value = localStorage.getItem("linksaw-theme") || "system";
function applyTheme(value) { document.documentElement.dataset.theme = value === "system" ? "" : value; }
applyTheme($("appearance").value);
syncReaderMode();
matchMedia("(max-width: 900px)").addEventListener("change", () => {
  syncReaderMode();
  if (hasExplicitRoute()) return;
  if (narrowLayout() && state.editorContext === "default") { void navigateAfterSave(() => closeSurface("editor")); }
  else if (!narrowLayout() && $("editor").hidden) openEditor(null, false, { defaultDraft: true, focus: false });
  $("search").focus();
});
$("appearance").addEventListener("change", event => { localStorage.setItem("linksaw-theme", event.target.value); applyTheme(event.target.value); });
$("autocomplete-trigger").addEventListener("input", event => {
  event.target.value = Array.from(event.target.value).slice(-1).join("");
  $("trigger-status").textContent = "";
});
$("save-trigger").addEventListener("click", async () => {
  const button = $("save-trigger"); button.disabled = true; $("trigger-status").textContent = "Saving…";
  try {
    const saved = await api("/preferences", { method: "PUT", body: JSON.stringify({ autocompleteTrigger: $("autocomplete-trigger").value }) });
    $("autocomplete-trigger").value = saved.autocompleteTrigger; $("trigger-status").textContent = "Saved. New pages will use this trigger.";
  } catch (error) { $("trigger-status").textContent = error.message; }
  finally { button.disabled = false; }
});
addEventListener("popstate", () => {
  if ($("editor").hidden || editorSnapshot() === editorBaseline) { applyUrlState(); return; }
  const intendedUrl = location.href;
  history.forward();
  void navigateAfterSave(() => { location.href = intendedUrl; });
});
addEventListener("beforeunload", event => {
  if ($("editor").hidden || (!saveInFlight && !saveFailed && editorSnapshot() === editorBaseline)) return;
  event.preventDefault();
  event.returnValue = "";
});
addEventListener("online", () => {
  if (!$('editor').hidden && editorSnapshot() !== editorBaseline) void saveEditorNow();
  else void syncFromServer();
});
document.addEventListener("visibilitychange", () => { if (!document.hidden) void syncFromServer(); });
setInterval(() => { void syncFromServer(); }, 3000);
document.addEventListener("keydown", event => {
  const modifier = event.metaKey || event.ctrlKey;
  const saveShortcut = event.key.toLowerCase() === "s" && !event.altKey && !event.shiftKey
    && (isMacPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
  if (saveShortcut) {
    event.preventDefault();
    if ($("delete-account-dialog").open || $("action-confirm-dialog").open) return;
    if (!$("editor").hidden) void saveEditorNow();
    return;
  }
  if ($("delete-account-dialog").open || $("action-confirm-dialog").open) return;
  const editing = !$("editor").hidden, settings = !$("settings-panel").hidden, viewerOpen = narrowLayout() && $("app").classList.contains("viewer-open");
  const undoShortcut = editing && !event.altKey && event.key.toLowerCase() === "z"
    && (isMacPlatform ? event.metaKey && !event.ctrlKey && !event.shiftKey : event.ctrlKey && !event.metaKey && !event.shiftKey);
  const redoShortcut = editing && !event.altKey && (
    (isMacPlatform && event.metaKey && !event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")
    || (!isMacPlatform && event.ctrlKey && !event.metaKey && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")))
  );
  if (undoShortcut || redoShortcut) { event.preventDefault(); void performEditorHistory(undoShortcut ? "undo" : "redo"); return; }
  if (!settings && isSidebarShortcut(event)) { event.preventDefault(); toggleReaderMode(); return; }
  if (event.key === "Escape") {
    if (editing) { event.preventDefault(); void navigateAfterSave(leaveRoutedView); }
    else if (settings || viewerOpen) leaveRoutedView();
    else if ($("search").value) { event.preventDefault(); clearSearch(); }
    return;
  }
  const defaultDraftField = state.editorContext === "default" && document.activeElement === $("snippet-body");
  if ((editing && (state.editorContext !== "default" || defaultDraftField)) || settings) return;
  if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); void navigateAfterSave(() => openEditor()); return; }
  const selected = state.filtered[state.selected];
  if (modifier && event.key.toLowerCase() === "e" && selected) { event.preventDefault(); void navigateAfterSave(() => openEditor(selected)); return; }
  if (modifier && event.key.toLowerCase() === "c" && selected) { event.preventDefault(); copySnippet(selected).catch(showCopyError); return; }
  if (modifier && event.key === "Enter" && selected) {
    const url = standaloneUrl(selected); if (url) { event.preventDefault(); openInNewTab(url); }
    return;
  }
  if (modifier && /^[1-9]$/.test(event.key)) {
    const numbered = state.filtered[Number(event.key) - 1];
    if (numbered) { event.preventDefault(); setSelected(Number(event.key) - 1); }
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    if (!$("app").classList.contains("reader-mode")) $("search").focus({ preventScroll: true });
    setSelected(state.selected + 1);
  }
  else if (event.key === "ArrowUp") {
    event.preventDefault();
    if (!$("app").classList.contains("reader-mode")) $("search").focus({ preventScroll: true });
    setSelected(state.selected - 1);
  }
  else if (event.key === "ArrowRight" && selected) { event.preventDefault(); runListActionAfterSave(() => { void useSnippet(selected).catch(showCopyError); }); }
  else if (event.key === "Enter" && selected && document.activeElement === $("search")) { event.preventDefault(); runListActionAfterSave(() => openSnippet(selected)); }
  else if (event.key === "/" && document.activeElement !== $("search")) { event.preventDefault(); $("search").focus(); }
});

load();
