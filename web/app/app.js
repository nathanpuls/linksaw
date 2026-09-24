import { parseCsvSnippets, parseJsonSnippets, snippetsToCsv, snippetsToJson } from "./transfers.js?v=20260923-2";

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
};

const $ = id => document.getElementById(id);
const state = { snippets: [], filtered: [], selected: -1, editing: null, editorContext: null, previewing: null, user: null };
const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const sidebarShortcutLabel = isMacPlatform ? "⌘\\" : "Ctrl+\\";
const commandShortcut = key => isMacPlatform ? `⌘${key}` : `Ctrl+${key}`;
const tooltipMedia = matchMedia("(hover: none), (pointer: coarse)");
const tooltipsEnabled = () => !tooltipMedia.matches;
let toastTimer;
let copyFeedbackTimer;
let tooltipTimer;
let tooltipTarget;
let editorSaving = false;

function icon(id, name) { $(id).innerHTML = icons[name]; }
icon("add", "plus"); icon("search-icon", "search"); icon("clear-search", "close"); icon("close-editor", "close");
icon("close-preview", "back"); icon("preview-edit", "edit"); icon("preview-copy", "copy"); icon("preview-share", "share"); icon("close-settings", "back");
icon("editor-reader-toggle", "panelLeft"); icon("delete", "trash");
$("toggle-sidebar-shortcut").textContent = sidebarShortcutLabel;
$("add").dataset.shortcut = commandShortcut("N");
$("preview-copy").dataset.shortcut = commandShortcut("C");

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
  if (!response.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function label(snippet) {
  return snippet.title.trim() || snippet.body.trim().split(/\r?\n/, 1)[0].slice(0, 90) || "Untitled";
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
function renderLinkedText(element, text) {
  const pattern = /https?:\/\/[^\s<>"'`]+|(?:www\.)?[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z]{2,})+(?:\/[^\s<>"'`]*)?/gi;
  const nodes = []; let last = 0;
  for (const match of text.matchAll(pattern)) {
    const full = match[0]; let value = full;
    while (/[.,;:!?)}\]]$/.test(value)) value = value.slice(0, -1);
    const suffix = full.slice(value.length);
    nodes.push(document.createTextNode(text.slice(last, match.index)));
    const bareDomainInCode = !/^https?:\/\//i.test(value) && (text[match.index - 1] === "`" || text[match.index + full.length] === "`");
    if (text[match.index - 1] === "@" || bareDomainInCode || !value) nodes.push(document.createTextNode(full));
    else {
      const link = document.createElement("a");
      link.href = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      link.target = "_blank"; link.rel = "noopener noreferrer"; link.textContent = value;
      nodes.push(link, document.createTextNode(suffix));
    }
    last = match.index + full.length;
  }
  nodes.push(document.createTextNode(text.slice(last)));
  element.replaceChildren(...nodes);
}
function showToast(message = "Copied") {
  clearTimeout(toastTimer); $("toast").textContent = message; $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 1400);
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
  if (state.editorContext === "default" && !$("editor").hidden) closeSurface("editor");
  state.selected = Math.max(0, Math.min(index, Math.max(0, state.filtered.length - 1)));
  document.querySelectorAll(".result-row").forEach((row, i) => row.classList.toggle("selected", i === state.selected));
  if (scroll) document.querySelector(`.result-row[data-index="${state.selected}"]`)?.scrollIntoView({ block: "nearest" });
  renderViewer(state.filtered[state.selected] || null);
}
function activateSnippet(snippet) {
  const url = standaloneUrl(snippet);
  if (url) openInNewTab(url);
  else openPreview(snippet);
}
function render() {
  const query = $("search").value.trim().toLowerCase();
  state.filtered = state.snippets.filter(s => !query || `${s.title}\n${s.body}`.toLowerCase().includes(query));
  if (state.selected >= state.filtered.length) state.selected = state.filtered.length - 1;
  const results = $("results"); results.replaceChildren();
  if (!state.filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty";
    empty.textContent = query ? "No matches" : "No snippets yet";
    if (!query) { const button = document.createElement("button"); button.className = "text-button"; button.textContent = "Create a snippet"; button.addEventListener("click", () => openEditor()); empty.append(button); }
    results.append(empty); renderViewer(null); return;
  }
  state.filtered.forEach((snippet, index) => {
    const url = standaloneUrl(snippet);
    const hasTitle = Boolean(snippet.title.trim());
    const hasPreview = hasTitle && snippet.body.trim() && (url || snippet.title.trim() !== snippet.body.trim());
    const row = document.createElement("article"); row.className = `result-row${url ? " has-url" : ""}${hasPreview ? " has-preview" : ""}${index === state.selected ? " selected" : ""}`; row.dataset.index = index;
    const main = document.createElement("button"); main.type = "button"; main.className = "result-main";
    const text = document.createElement("span"); text.className = "result-text";
    const title = document.createElement("div"); title.className = "result-title"; title.textContent = label(snippet);
    const preview = document.createElement("div"); preview.className = "result-preview"; preview.textContent = snippet.body.replace(/\s+/g, " ").trim();
    if (url && !hasTitle) title.classList.add("result-link-text");
    if (url) preview.classList.add("result-link-text");
    text.append(title);
    if (hasPreview) text.append(preview);
    main.append(text);
    if (url) main.ariaLabel = `Open ${label(snippet)} website`;
    main.addEventListener("focus", () => setSelected(index, false));
    main.addEventListener("click", () => { if (!$("editor").hidden) closeSurface("editor"); setSelected(index); activateSnippet(snippet); });
    row.append(main);
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "result-edit icon-button";
    edit.ariaLabel = "Edit"; edit.dataset.tooltip = "Edit"; edit.innerHTML = icons.edit;
    edit.addEventListener("focus", () => setSelected(index, false));
    edit.addEventListener("click", event => { event.stopPropagation(); setSelected(index, false); openEditor(snippet); });
    row.append(edit);
    results.append(row);
  });
  renderViewer(state.selected >= 0 ? state.filtered[state.selected] : null);
}
function showError(error) { $("status").textContent = error.message || String(error); }
function updateUrl(values, push = true) {
  const url = new URL(location.href);
  url.pathname = "/app/";
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
function syncSaveButton() {
  const hasValue = $("snippet-body").value.trim();
  $("save-snippet").disabled = editorSaving || !hasValue;
}
function leaveRoutedView() {
  if (history.state?.linksawPushed) { history.back(); return; }
  const params = new URLSearchParams(location.search);
  const snippet = params.get("view") === "edit" ? params.get("snippet") : null;
  updateUrl({ view: null, snippet }, false); applyUrlState();
}
function openEditor(snippet = null, pushHistory = true, options = {}) {
  hideTooltip();
  const { defaultDraft = false, focus = true } = options;
  state.editing = snippet; $("snippet-body").value = snippet?.body || "";
  editorSaving = false; syncSaveButton();
  state.editorContext = defaultDraft ? "default" : "routed";
  $("editor-heading").textContent = snippet ? "Edit snippet" : "New snippet";
  $("close-editor").hidden = defaultDraft;
  $("delete").hidden = !snippet; $("unshare").hidden = !snippet?.share_token; $("editor-status").textContent = ""; showSurface("editor");
  $("rename").hidden = !snippet;
  if (pushHistory) updateUrl({ view: snippet ? "edit" : "new", snippet: snippet?.id || null });
  if (focus) setTimeout(() => $("snippet-body").focus(), 0);
}
function renderViewer(snippet) {
  state.previewing = snippet;
  $("viewer-empty").hidden = Boolean(snippet); $("viewer-content").hidden = !snippet;
  if (!snippet) return;
  const heading = snippet.title.trim();
  $("preview-title").textContent = heading; $("preview-title").hidden = !heading;
  $("preview-body").hidden = !snippet.body;
  renderLinkedText($("preview-body"), snippet.body);
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
  if (pushHistory) updateUrl({ view: "settings", snippet: null });
  if (location.hash === "#import-export" && !matchMedia("(max-width: 700px)").matches) {
    requestAnimationFrame(() => $("import-export").scrollIntoView({ block: "start" }));
  }
}
function hasExplicitRoute() {
  const params = new URLSearchParams(location.search);
  return Boolean(params.get("snippet") || params.get("view") || params.has("new") || location.pathname !== "/app/");
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
  const legacySnippet = location.pathname.match(/^\/app\/s\/([a-f0-9-]{36})\/?$/)?.[1];
  const snippetId = params.get("snippet") || legacySnippet;
  const view = params.get("view") || (location.pathname === "/app/new" || params.get("new") === "1" ? "new" : "");
  if (location.pathname !== "/app/" || params.has("new")) {
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
$("add").addEventListener("click", () => openEditor());
$("settings").addEventListener("click", () => openSettings());
$("close-editor").addEventListener("click", leaveRoutedView);
$("close-preview").addEventListener("click", () => closePreview());
$("close-settings").addEventListener("click", leaveRoutedView);
$("preview-copy").addEventListener("click", () => copySnippet(state.previewing).catch(showCopyError));
$("preview-share").addEventListener("click", () => shareSnippet(state.previewing).catch(showError));
let renamingSnippet = null;
function openRename(snippet) {
  if (!snippet) return;
  renamingSnippet = snippet; $("rename-input").value = snippet.title || ""; $("rename-status").textContent = "";
  $("rename-dialog").showModal(); $("rename-input").focus(); $("rename-input").select();
}
$("preview-edit").addEventListener("click", () => openEditor(state.previewing));
$("rename").addEventListener("click", () => openRename(state.editing));
$("cancel-rename").addEventListener("click", () => $("rename-dialog").close());
$("rename-dialog").addEventListener("click", event => { if (event.target === $("rename-dialog")) $("rename-dialog").close(); });
$("rename-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!renamingSnippet) return;
  const title = $("rename-input").value;
  if (!title.trim() && !renamingSnippet.body.trim()) { $("rename-status").textContent = "A snippet without content needs a name."; return; }
  try {
    $("rename-status").textContent = "Saving…";
    await api(`/snippets/${renamingSnippet.id}`, { method: "PUT", body: JSON.stringify({ title, body: renamingSnippet.body }) });
    const id = renamingSnippet.id;
    const data = await api("/snippets"); state.snippets = data.snippets;
    state.selected = Math.max(0, state.filtered.findIndex(snippet => snippet.id === id));
    render();
    const renamed = state.snippets.find(snippet => snippet.id === id);
    if (renamed) {
      state.previewing = renamed; renderViewer(renamed);
      if (state.editing?.id === id) state.editing = renamed;
    }
    $("rename-dialog").close();
  } catch (error) { $("rename-status").textContent = error.message; }
});
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
$("snippet-body").addEventListener("input", syncSaveButton);
$("editor-form").addEventListener("submit", async event => {
  event.preventDefault();
  const payload = { title: state.editing?.title || "", body: $("snippet-body").value };
  if (!payload.body.trim()) {
    $("editor-status").textContent = "Enter snippet text";
    return;
  }
  editorSaving = true; syncSaveButton(); $("editor-status").textContent = "Saving…";
  try {
    const saved = await api(state.editing ? `/snippets/${state.editing.id}` : "/snippets", { method: state.editing ? "PUT" : "POST", body: JSON.stringify(payload) });
    const savedId = state.editing?.id || saved.id;
    const data = await api("/snippets"); state.snippets = data.snippets; state.selected = Math.max(0, data.snippets.findIndex(snippet => snippet.id === savedId)); render();
    updateUrl({ view: null, snippet: savedId }, false); applyUrlState();
  } catch (error) { $("editor-status").textContent = error.message; } finally { editorSaving = false; syncSaveButton(); }
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
$("delete").addEventListener("click", async () => {
  if (!state.editing || !await requestConfirmation({ title: "Delete snippet?", message: "This permanently removes this snippet.", action: "Delete" })) return;
  try { await api(`/snippets/${state.editing.id}`, { method: "DELETE" }); state.snippets = state.snippets.filter(s => s.id !== state.editing.id); render(); updateUrl({ view: null, snippet: null }, false); applyUrlState(); }
  catch (error) { $("editor-status").textContent = error.message; }
});
$("unshare").addEventListener("click", async () => {
  if (!state.editing?.share_token || !await requestConfirmation({ title: "Stop sharing?", message: "Anyone using the current link will no longer be able to view this snippet.", action: "Stop sharing" })) return;
  try {
    await api(`/snippets/${state.editing.id}/share`, { method: "DELETE" });
    state.editing.share_token = null; $("unshare").hidden = true; $("editor-status").textContent = "Sharing stopped.";
  } catch (error) { $("editor-status").textContent = error.message; }
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
  if (narrowLayout() && state.editorContext === "default") closeSurface("editor");
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
addEventListener("popstate", applyUrlState);
document.addEventListener("keydown", event => {
  if ($("delete-account-dialog").open || $("action-confirm-dialog").open) return;
  const editing = !$("editor").hidden, settings = !$("settings-panel").hidden, viewerOpen = narrowLayout() && $("app").classList.contains("viewer-open");
  if (!settings && isSidebarShortcut(event)) { event.preventDefault(); toggleReaderMode(); return; }
  if (event.key === "Escape") {
    if (editing || settings || viewerOpen) leaveRoutedView();
    else if ($("search").value) { event.preventDefault(); clearSearch(); }
    return;
  }
  const defaultDraftField = state.editorContext === "default" && document.activeElement === $("snippet-body");
  if ((editing && (state.editorContext !== "default" || defaultDraftField)) || settings) return;
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); openEditor(); return; }
  const selected = state.filtered[state.selected];
  if (modifier && event.key.toLowerCase() === "e" && selected) { event.preventDefault(); openEditor(selected); return; }
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
  else if (event.key === "ArrowRight" && selected) { event.preventDefault(); openPreview(selected); }
  else if (event.key === "Enter" && selected && document.activeElement === $("search")) { event.preventDefault(); activateSnippet(selected); }
  else if (event.key === "/" && document.activeElement !== $("search")) { event.preventDefault(); $("search").focus(); }
});

load();
