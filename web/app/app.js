import { detectPastedSnippets, parseCsvSnippets, parseJsonSnippets, snippetsToCsv, snippetsToJson } from "./transfers.js?v=20260927-4";
import { renderMarkdown, sourceOffsetFromRenderedPoint } from "./markdown.js?v=20260927-3";
import { createLucideMenuIcon } from "./lucide-menu-icons.js?v=20260927-1";
import { standaloneWebUrl } from "./linkify.js?v=20260927-3";

const API = "https://snippets-api.linksaw.com";
const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m20 6-11 11-5-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v13"/><path d="m16 6-4-4-4 4"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  panelLeft: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>',
  externalLink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6M14 11v6"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>',
  redo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>',
};

const $ = id => document.getElementById(id);
const state = { snippets: [], filtered: [], selected: -1, editing: null, editorContext: null, previewing: null, user: null };
let deletedSnippets = [];
const isMacPlatform = /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || "");
const sidebarShortcutLabel = isMacPlatform ? "⌘\\" : "Ctrl+\\";
const commandShortcut = key => isMacPlatform ? `⌘${key}` : `Ctrl+${key}`;
const triggerModifierLabels = { Shift: "Shift", Meta: isMacPlatform ? "Command" : "Meta", Control: "Control", Alt: isMacPlatform ? "Option" : "Alt" };
function triggerShortcutLabel(value) {
  if (!value?.startsWith("keys:")) return value || "";
  return value.slice(5).split("+").map(key => triggerModifierLabels[key] || key).join(" + ");
}
function setTriggerShortcut(value) {
  $("autocomplete-trigger").dataset.shortcut = value || "";
  $("autocomplete-trigger").value = triggerShortcutLabel(value);
}
function triggerShortcutFromEvent(event) {
  if (["Shift", "Meta", "Control", "Alt"].includes(event.key) || event.key.length !== 1 || /\s/u.test(event.key)) return "";
  const parts = [];
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  if (event.ctrlKey) parts.push("Control");
  if (event.altKey) parts.push("Alt");
  parts.push(event.key.toUpperCase());
  return parts.length <= 3 ? `keys:${parts.join("+")}` : "";
}
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
let editorSlowSaveTimer;
let saveAgain = false;
let saveFailed = false;
let editorConflict = null;
let editorStartedNew = false;
let pendingNavigation;
let editorSessionId = 0;
let editorCreateId = "";
let localUndo = [];
let localRedo = [];
let localInputGroup = null;
let actionMenuSnippet = null;
let actionMenuIndex = -1;
let actionMenuClearsSelection = false;
let lastPointerPosition = null;

function titleUnderPointer(position = lastPointerPosition) {
  if (!position) return false;
  return [$("preview-title"), $("editor-name")].some(title => {
    if (title.hidden) return false;
    const rect = title.getBoundingClientRect();
    return position.x >= rect.left && position.x <= rect.right && position.y >= rect.top && position.y <= rect.bottom;
  });
}
function trackPointer(event) {
  lastPointerPosition = { x: event.clientX, y: event.clientY };
  if ($("app").classList.contains("suppress-shifted-title-hover") && !titleUnderPointer()) {
    $("app").classList.remove("suppress-shifted-title-hover");
  }
}

function icon(id, name) { $(id).innerHTML = icons[name]; }
function menuIcon(id, name) { $(id).replaceChildren(createLucideMenuIcon(name)); }
icon("add", "plus"); icon("search-icon", "search"); icon("mobile-search-trigger-icon", "search"); icon("clear-search", "close"); icon("close-editor", "close");
icon("close-preview", "back"); icon("preview-edit", "edit"); icon("preview-copy", "copy"); icon("preview-share", "share"); icon("preview-delete", "trash"); icon("close-settings", "close"); icon("close-deleted", "back");
icon("editor-reader-toggle", "panelLeft"); icon("editor-copy", "copy"); icon("editor-share", "share"); icon("editor-undo", "undo"); icon("editor-redo", "redo"); icon("delete", "trash"); icon("mobile-delete", "trash");
menuIcon("snippet-action-open-icon", "externalLink"); menuIcon("snippet-action-copy-icon", "copy"); menuIcon("snippet-action-share-icon", "share"); menuIcon("snippet-action-edit-icon", "pencil"); menuIcon("snippet-action-delete-icon", "trash");
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
  trackPointer(event);
  const target = event.target.closest?.("[data-tooltip]");
  if (target && !target.contains(event.relatedTarget)) showTooltip(target);
});
document.addEventListener("pointermove", trackPointer, { passive: true });
document.addEventListener("pointerdown", trackPointer, { passive: true });
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

function syncMobileListViewport() {
  const viewport = window.visualViewport;
  const height = Math.round(viewport?.height || window.innerHeight);
  const top = Math.round(viewport?.offsetTop || 0);
  document.documentElement.style.setProperty("--mobile-viewport-height", `${height}px`);
  document.documentElement.style.setProperty("--mobile-viewport-top", `${top}px`);
}
syncMobileListViewport();
window.visualViewport?.addEventListener("resize", syncMobileListViewport);
window.visualViewport?.addEventListener("scroll", syncMobileListViewport);
window.addEventListener("orientationchange", syncMobileListViewport);

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
function snippetText(snippet) { return snippet.body || snippet.title || ""; }
function standaloneUrl(snippet) {
  return standaloneWebUrl(snippetText(snippet));
}
function openInNewTab(url) {
  window.open(url, "_blank", "noopener,noreferrer");
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
function showCopySuccess(button = $("preview-copy")) {
  clearTimeout(copyFeedbackTimer);
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
async function shareSnippet(snippet, button = $("preview-share")) {
  hideTooltip();
  const share = await api(`/snippets/${snippet.id}/share`, { method: "POST" });
  snippet.share_token = share.token;
  if (navigator.share) {
    try { await navigator.share({ title: label(snippet), url: share.url }); return; }
    catch (error) { if (error?.name === "AbortError") return; }
    finally { hideTooltip(); button.blur(); }
  }
  await navigator.clipboard.writeText(share.url);
  button.blur();
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
function clearListSelection() {
  state.selected = -1;
  document.querySelectorAll(".result-row").forEach(row => {
    row.classList.remove("selected");
    row.querySelector(".result-main")?.setAttribute("aria-current", "false");
  });
  renderViewer(null);
}
function beginKeyboardListNavigation() {
  $("results").classList.add("keyboard-navigation");
  document.activeElement?.closest?.(".result-main")?.blur();
}
function hoveredListItem() {
  if ($("results").classList.contains("keyboard-navigation")) return null;
  const row = document.querySelector(".result-row:hover");
  if (!row) return null;
  const index = Number(row.dataset.index);
  const snippet = state.filtered[index];
  return snippet ? { index, snippet } : null;
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
function closeSnippetActionMenu() {
  if (actionMenuClearsSelection) clearListSelection();
  actionMenuClearsSelection = false;
  actionMenuSnippet = null;
  if ($("snippet-action-menu").open) $("snippet-action-menu").close();
}
function clearInteractiveSelection() {
  window.getSelection?.()?.removeAllRanges();
}
function openSnippetActionMenu(snippet, point = null, { clearSelectionOnClose = false } = {}) {
  if (!snippet) return;
  clearInteractiveSelection();
  actionMenuSnippet = snippet;
  actionMenuIndex = state.filtered.findIndex(item => item.id === snippet.id);
  actionMenuClearsSelection = clearSelectionOnClose;
  const menu = $("snippet-action-menu");
  const open = $("snippet-action-open");
  const url = standaloneUrl(snippet);
  open.hidden = !url;
  const desktopContext = Boolean(point && !narrowLayout());
  menu.classList.toggle("desktop-context", desktopContext);
  menu.style.removeProperty("left"); menu.style.removeProperty("top");
  menu.showModal();
  if (desktopContext) {
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(point.x, innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(point.y, innerHeight - rect.height - 8))}px`;
  }
  menu.focus({ preventScroll: true });
}
function installLongPress(main, snippet, index) {
  let timer = 0;
  let startX = 0;
  let startY = 0;
  let handled = false;
  const cancel = () => { clearTimeout(timer); timer = 0; };
  main.addEventListener("pointerdown", event => {
    if (!narrowLayout() || event.pointerType === "mouse") return;
    startX = event.clientX; startY = event.clientY; handled = false;
    timer = setTimeout(() => {
      handled = true;
      navigator.vibrate?.(10);
      setSelected(index, false);
      openSnippetActionMenu(snippet, null, { clearSelectionOnClose: true });
      setTimeout(() => { handled = false; }, 800);
    }, 550);
  });
  main.addEventListener("pointermove", event => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancel();
  });
  main.addEventListener("pointerup", cancel);
  main.addEventListener("pointercancel", cancel);
  main.addEventListener("touchstart", clearInteractiveSelection, { passive: true });
  main.addEventListener("selectstart", event => { if (narrowLayout()) event.preventDefault(); });
  main.addEventListener("contextmenu", event => {
    event.preventDefault();
    if (!narrowLayout()) {
      const point = { x: event.clientX, y: event.clientY };
      runListActionAfterSave(() => { setSelected(index, false); openSnippetActionMenu(snippet, point); });
    }
  });
  return () => {
    if (!handled) return false;
    handled = false;
    return true;
  };
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
    main.ariaLabel = `Open ${label(snippet)} in Linksaw`;
    main.setAttribute("aria-description", "Open snippet viewer");
    main.addEventListener("focus", () => setSelected(index, false));
    const consumedLongPress = installLongPress(main, snippet, index);
    main.addEventListener("click", event => {
      if (consumedLongPress()) { event.preventDefault(); return; }
      runListActionAfterSave(() => { setSelected(index, false); openSnippet(snippet); });
    });
    row.append(main);
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
  if (!["editor", "settings-panel", "deleted-panel"].some(name => !$(name).hidden)) document.body.style.overflow = "";
  if ($("app").classList.contains("viewer-open")) $("close-preview").focus(); else $("search").focus();
}
function syncEditorName() {
  $("editor-name").textContent = editorCustomName.trim();
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
  $("mobile-editor-status-text").textContent = status;
  $("mobile-editor-status").hidden = !status;
  setEditorRetryVisible(status === "Couldn’t save ·");
}
function beginEditorSaveFeedback() {
  clearTimeout(editorSlowSaveTimer);
  setEditorStatus("");
  editorSlowSaveTimer = setTimeout(() => setEditorStatus("Saving…"), 1600);
}
function clearEditorSaveFeedback() {
  clearTimeout(editorSlowSaveTimer);
  editorSlowSaveTimer = null;
  setEditorStatus("");
}
function setEditorRetryVisible(visible) {
  $("editor-retry").hidden = !visible;
  $("mobile-editor-retry").hidden = !visible;
}
function setEditorRetryLabel(label) {
  $("editor-retry").textContent = label;
  $("mobile-editor-retry").textContent = label;
}
function setEditorDeleteVisible(visible) {
  $("delete").hidden = !visible;
  $("mobile-delete").hidden = !visible;
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
  setEditorRetryVisible(false);
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
    beginEditorSaveFeedback();
    try {
      const creating = !state.editing;
      const result = await api(creating ? "/snippets" : `/snippets/${state.editing.id}`, {
        method: creating ? "POST" : "PUT",
        body: JSON.stringify(creating ? { ...value, importId: editorCreateId } : { ...value, version: state.editing.version }),
      });
      if (sessionId !== editorSessionId) { clearEditorSaveFeedback(); return true; }
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
      setEditorDeleteVisible(true);
      $("unshare").hidden = !savedSnippet.share_token;
      if (wasNew && state.editorContext !== "default") {
        updateUrl({ view: state.editorContext === "mobile" ? null : "edit", snippet: savedSnippet.id }, false);
      }
      if (editorSnapshot() === editorBaseline) clearEditorSaveFeedback();
    } catch (error) {
      clearTimeout(editorSlowSaveTimer);
      editorSlowSaveTimer = null;
      if (sessionId !== editorSessionId) { setEditorStatus(""); return false; }
      const conflict = error.status === 409 ? error.data?.snippet || null : null;
      // A request can reach D1 even when its response is lost. If the server's
      // newer row is exactly this settled edit, treat the retry as confirmed.
      if (conflict && conflict.title === value.title && conflict.body === value.body) {
        editorBaseline = snapshot;
        saveFailed = false;
        editorConflict = null;
        clearEditorDraft();
        upsertSavedSnippet(conflict);
        clearEditorSaveFeedback();
        continue;
      }
      saveFailed = true;
      editorConflict = conflict;
      setEditorStatus(editorConflict ? "Changed elsewhere ·" : "Couldn’t save ·");
      setEditorRetryLabel(editorConflict ? "Save mine" : "Retry");
      setEditorRetryVisible(true);
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
function beginInlineRename(caretOffset = null) {
  hideTooltip();
  inlineRenameBaseline = editorCustomName;
  $("editor-name-input").value = editorCustomName;
  $("editor-name").hidden = true;
  $("editor-name-input").hidden = false;
  const input = $("editor-name-input");
  input.focus({ preventScroll: true });
  if (Number.isInteger(caretOffset)) {
    const offset = Math.max(0, Math.min(caretOffset, input.value.length));
    input.setSelectionRange(offset, offset);
  } else input.select();
}
function finishInlineRename({ cancel = false } = {}) {
  const enteredName = $("editor-name-input").value.trim();
  editorCustomName = cancel ? inlineRenameBaseline : enteredName;
  $("editor-name-input").hidden = true;
  $("editor-name").hidden = false;
  syncEditorName();
  if (!cancel && editorSnapshot() !== editorBaseline) scheduleAutosave();
}
function leaveRoutedView() {
  if (!narrowLayout() && editorStartedNew && state.editing && !$("editor").hidden) {
    const snippetId = state.editing.id;
    editorStartedNew = false;
    updateUrl({ view: null, snippet: snippetId }, false);
    applyUrlState();
    return;
  }
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
  const mobileUnified = narrowLayout();
  editorStartedNew = !snippet;
  state.editing = snippet; $("snippet-body").value = snippet?.body || ""; editorCustomName = snippet?.title || "";
  editorCreateId = snippet ? "" : crypto.randomUUID();
  saveFailed = false; editorConflict = null; saveAgain = false; pendingNavigation = null; localUndo = []; localRedo = []; localInputGroup = null;
  state.editorContext = defaultDraft ? "default" : mobileUnified ? "mobile" : "routed";
  $("editor").classList.toggle("mobile-unified", mobileUnified);
  $("editor").classList.toggle("is-editing", mobileUnified && focus);
  renderMarkdown($("mobile-snippet-view"), $("snippet-body").value);
  $("mobile-snippet-view").hidden = !mobileUnified;
  $("mobile-snippet-view").setAttribute("aria-hidden", mobileUnified && !focus ? "false" : "true");
  $("mobile-snippet-view").tabIndex = mobileUnified && !focus ? 0 : -1;
  $("snippet-body").hidden = false;
  $("snippet-body").setAttribute("aria-hidden", mobileUnified && !focus ? "true" : "false");
  $("snippet-body").tabIndex = mobileUnified && !focus ? -1 : 0;
  $("close-editor").innerHTML = icons[mobileUnified ? "back" : "close"];
  $("close-editor").ariaLabel = mobileUnified ? "Back to snippets" : "Close editor";
  $("close-editor").dataset.tooltip = mobileUnified ? "Back to snippets" : "Close editor";
  $("editor-heading").textContent = snippet ? "Edit snippet" : "New snippet";
  $("close-editor").hidden = defaultDraft;
  setEditorDeleteVisible(Boolean(snippet)); $("unshare").hidden = !snippet?.share_token; setEditorStatus("");
  $("editor-name-input").hidden = true; $("editor-name").hidden = false; syncEditorName(); showSurface("editor");
  editorBaseline = editorSnapshot();
  try {
    const draft = JSON.parse(localStorage.getItem(editorDraftKey()) || "null");
    if (draft?.snapshot && (draft.version === null || draft.version === snippet?.version)) {
      applyEditorSnapshot(draft.snapshot);
      setEditorStatus("");
    }
  } catch { clearEditorDraft(); }
  syncHistoryControls();
  if (pushHistory) updateUrl({ view: snippet && mobileUnified ? null : snippet ? "edit" : "new", snippet: snippet?.id || null });
  if (focus) setTimeout(() => {
    const input = $("snippet-body");
    const previousScrollTop = input.scrollTop;
    input.focus({ preventScroll: true });
    const fullyVisible = input.scrollHeight <= input.clientHeight + 2;
    const offset = !snippet ? 0 : mobileUnified && fullyVisible ? input.value.length : 0;
    input.setSelectionRange(offset, offset);
    if (mobileUnified && !fullyVisible) input.scrollTop = previousScrollTop;
  }, 0);
}
function renderViewer(snippet) {
  state.previewing = snippet;
  $("viewer-empty").hidden = Boolean(snippet); $("viewer-content").hidden = !snippet;
  if (!snippet) return;
  const heading = snippet.title.trim();
  $("preview-title").textContent = heading; $("preview-title").hidden = false;
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
  if (narrowLayout()) { openEditor(snippet, pushHistory, { focus: false }); return; }
  hideTooltip();
  renderViewer(snippet);
  if (pushHistory) updateUrl({ view: null, snippet: snippet.id });
  if (!narrowLayout()) {
    requestAnimationFrame(() => $("preview-body").focus({ preventScroll: true }));
    return;
  }
  const opening = !$("app").classList.contains("viewer-open");
  $("app").classList.add("viewer-open");
  setTimeout(() => $("close-preview").focus(), 0);
}
function closePreview() {
  $("close-preview").blur();
  leaveRoutedView();
}
function openSettings(pushHistory = true) {
  hideTooltip();
  $("deleted-panel").hidden = true;
  showSurface("settings-panel");
  if (pushHistory) updateUrl({ view: "settings", snippet: null });
  if (location.hash === "#import-export" && !matchMedia("(max-width: 700px)").matches) {
    requestAnimationFrame(() => $("import-export").scrollIntoView({ block: "start" }));
  }
}
function openDeletedSnippets(pushHistory = true) {
  hideTooltip();
  $("settings-panel").hidden = true;
  showSurface("deleted-panel");
  void loadDeletedSnippets();
  if (pushHistory) updateUrl({ view: "deleted", snippet: null });
}
function returnToSettings() {
  $("deleted-panel").hidden = true;
  openSettings(false);
  updateUrl({ view: "settings", snippet: null }, false);
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
  closeSurface("editor"); closeSurface("settings-panel"); closeSurface("deleted-panel"); $("app").classList.remove("viewer-open");
  const params = new URLSearchParams(location.search);
  syncReaderMode();
  const legacySnippet = location.pathname.match(/^\/home\/s\/([a-f0-9-]{36})\/?$/)?.[1];
  const snippetId = params.get("snippet") || legacySnippet;
  const view = params.get("view") || (location.pathname === "/home/new" || params.get("new") === "1" ? "new" : "");
  if (location.pathname !== "/home/" || params.has("new")) {
    updateUrl({ view: view || null, snippet: snippetId || null }, false);
  }
  if (view === "settings") { openSettings(false); revealInitialView(); return; }
  if (view === "deleted") { openDeletedSnippets(false); revealInitialView(); return; }
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
    setTriggerShortcut(preferences.autocompleteTrigger || ";");
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
          setEditorRetryLabel("Save mine");
          setEditorRetryVisible(true);
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
      setEditorRetryLabel("Retry");
      setEditorRetryVisible(true);
      persistEditorDraft();
    }
  } finally { syncInFlight = false; }
}

$("search").addEventListener("input", () => {
  const query = $("search").value.trim();
  $("clear-search").hidden = !$("search").value;
  state.selected = -1; render();
  $("results").scrollTop = 0;
  if (query && state.filtered.length) setSelected(0, false);
  else if (!query && !hasExplicitRoute() && !narrowLayout() && $("editor").hidden) openEditor(null, false, { defaultDraft: true, focus: false });
});
$("search").addEventListener("focus", () => {
  document.querySelector(".list-pane")?.classList.add("search-active");
  syncMobileListViewport();
  setTimeout(syncMobileListViewport, 250);
});
$("search").addEventListener("blur", () => {
  document.querySelector(".list-pane")?.classList.remove("search-active");
  setTimeout(syncMobileListViewport, 0);
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
function activateMobileSearch() {
  const input = $("search");
  document.querySelector(".list-pane")?.classList.add("search-active");
  // The resting mobile layout does not render the text field. Reveal it before
  // focusing so mobile browsers can open the keyboard within this user gesture.
  void input.offsetWidth;
  input.focus({ preventScroll: true });
}
$("mobile-search-trigger").addEventListener("click", activateMobileSearch);
$("add").addEventListener("click", () => { void navigateAfterSave(() => openEditor()); });
$("settings").addEventListener("click", () => { void navigateAfterSave(() => openSettings()); });
function closeEditorFromControl() {
  $("close-editor").blur();
  const mobileEditing = narrowLayout() && $("editor").classList.contains("is-editing");
  if (!mobileEditing) { void navigateAfterSave(leaveRoutedView); return; }
  const emptyUnsavedSnippet = !state.editing && !$('snippet-body').value.trim();
  if (emptyUnsavedSnippet) { void navigateAfterSave(leaveRoutedView); return; }
  void navigateAfterSave(() => {
    $("snippet-body").blur();
    setMobileEditorState(false);
    if (state.editing) updateUrl({ view: null, snippet: state.editing.id }, false);
  });
}
$("close-editor").addEventListener("click", closeEditorFromControl);
$("close-preview").addEventListener("click", () => closePreview());
$("close-settings").addEventListener("click", leaveRoutedView);
$("open-recently-deleted").addEventListener("click", () => openDeletedSnippets());
$("close-deleted").addEventListener("click", returnToSettings);
$("preview-copy").addEventListener("click", () => copySnippet(state.previewing).catch(showCopyError));
$("preview-share").addEventListener("click", () => shareSnippet(state.previewing).catch(showError));
$("preview-edit").addEventListener("click", () => openEditor(state.previewing));
$("preview-delete").addEventListener("click", () => deleteSnippet(state.previewing));
$("preview-title").addEventListener("click", event => {
  if (!state.previewing) return;
  const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = point?.offsetNode || range?.startContainer;
  const rawOffset = point?.offset ?? range?.startOffset;
  const offset = node && $("preview-title").contains(node) && Number.isInteger(rawOffset) ? rawOffset : null;
  openEditor(state.previewing, true, { focus: false });
  requestAnimationFrame(() => beginInlineRename(offset));
});
let renderedViewLongPressUntil = 0;
function selectionInside(element) {
  const selection = getSelection();
  return Boolean(selection && !selection.isCollapsed
    && (element.contains(selection.anchorNode) || element.contains(selection.focusNode)));
}
function installRenderedSelectionGuard(element) {
  let timer = 0;
  let startedAt = 0;
  let startX = 0;
  let startY = 0;
  const cancelTimer = () => { clearTimeout(timer); timer = 0; };
  element.addEventListener("pointerdown", event => {
    if (event.button !== 0 || event.target.closest?.("a")) return;
    cancelTimer();
    startedAt = performance.now();
    startX = event.clientX;
    startY = event.clientY;
    timer = setTimeout(() => { renderedViewLongPressUntil = Date.now() + 900; }, 450);
  });
  element.addEventListener("pointermove", event => {
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 8) cancelTimer();
  });
  element.addEventListener("pointerup", () => {
    if (startedAt && performance.now() - startedAt >= 450) renderedViewLongPressUntil = Date.now() + 900;
    startedAt = 0;
    cancelTimer();
  });
  element.addEventListener("pointercancel", cancelTimer);
  element.addEventListener("contextmenu", () => { renderedViewLongPressUntil = Date.now() + 900; });
}
function renderedCaretOffset(event, element, source) {
  const point = document.caretPositionFromPoint?.(event.clientX, event.clientY);
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  return sourceOffsetFromRenderedPoint(
    element,
    source,
    point?.offsetNode || range?.startContainer || event.target,
    point?.offset ?? range?.startOffset ?? 0,
    event.clientX,
    event.clientY,
  );
}
installRenderedSelectionGuard($("preview-body"));
installRenderedSelectionGuard($("mobile-snippet-view"));
$("preview-body").addEventListener("click", event => {
  if (event.target.closest?.("a") || !state.previewing || narrowLayout()) return;
  if (Date.now() < renderedViewLongPressUntil || selectionInside($("preview-body"))) return;
  const offset = renderedCaretOffset(event, $("preview-body"), state.previewing.body);
  const snippet = state.previewing;
  openEditor(snippet, true, { focus: false });
  requestAnimationFrame(() => {
    $("snippet-body").focus({ preventScroll: true });
    $("snippet-body").setSelectionRange(offset, offset);
  });
});
$("preview-body").addEventListener("keydown", event => {
  if ((event.key !== "Enter" && event.key !== " ") || !state.previewing || narrowLayout()) return;
  event.preventDefault();
  const snippet = state.previewing;
  openEditor(snippet, true, { focus: false });
  requestAnimationFrame(() => {
    $("snippet-body").focus({ preventScroll: true });
    $("snippet-body").setSelectionRange(0, 0);
  });
});
$("editor-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("snippet-body").value);
    showCopySuccess($("editor-copy"));
  } catch (error) { showCopyError(error); }
});
$("editor-share").addEventListener("click", async () => {
  if (!await flushEditorSave() || !state.editing) return;
  shareSnippet(state.editing, $("editor-share")).catch(showError);
});
$("editor-name").addEventListener("click", beginInlineRename);
$("editor-name-input").addEventListener("keydown", event => {
  if (event.key === "Enter") { event.preventDefault(); finishInlineRename(); $("snippet-body").focus(); }
  else if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); finishInlineRename({ cancel: true }); $("snippet-body").focus(); }
});
$("editor-name-input").addEventListener("blur", () => { if (!$("editor-name-input").hidden) finishInlineRename(); });
function toggleReaderMode() {
  hideTooltip();
  const enabled = !$("app").classList.contains("reader-mode");
  if (enabled) $("app").classList.add("suppress-shifted-title-hover");
  sessionStorage.setItem("linksaw-reader-mode", String(enabled)); updateUrl({ list: enabled ? "off" : "on" }, false); syncReaderMode();
  if (enabled) requestAnimationFrame(() => {
    if (lastPointerPosition && !titleUnderPointer()) $("app").classList.remove("suppress-shifted-title-hover");
  });
}
function isSidebarShortcut(event) {
  if (event.key !== "\\" || event.altKey || event.shiftKey) return false;
  return isMacPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
}
$("reader-toggle").addEventListener("click", toggleReaderMode);
$("editor-reader-toggle").addEventListener("click", toggleReaderMode);
for (const title of [$("preview-title"), $("editor-name")]) {
  title.addEventListener("pointerleave", () => $("app").classList.remove("suppress-shifted-title-hover"));
}
for (const input of [$("snippet-body"), $("editor-name-input")]) {
  input.addEventListener("beforeinput", event => {
    if (!event.inputType.startsWith("history")) rememberLocalState(input.id);
  });
}
$("snippet-body").addEventListener("input", () => {
  renderMarkdown($("mobile-snippet-view"), $("snippet-body").value);
  if (!editorCustomName.trim()) syncEditorName();
  scheduleAutosave();
});
function setMobileEditorState(editing) {
  const view = $("mobile-snippet-view");
  const input = $("snippet-body");
  $("editor").classList.toggle("is-editing", editing);
  view.setAttribute("aria-hidden", editing ? "true" : "false");
  view.tabIndex = editing ? -1 : 0;
  input.setAttribute("aria-hidden", editing ? "false" : "true");
  input.tabIndex = editing ? 0 : -1;
}
let mobileScrollSyncFrame = 0;
function syncMobileScroll(source, target) {
  if (mobileScrollSyncFrame || !$("editor").classList.contains("mobile-unified")) return;
  const sourceRange = Math.max(0, source.scrollHeight - source.clientHeight);
  const targetRange = Math.max(0, target.scrollHeight - target.clientHeight);
  target.scrollTop = sourceRange && targetRange ? (source.scrollTop / sourceRange) * targetRange : 0;
  mobileScrollSyncFrame = requestAnimationFrame(() => { mobileScrollSyncFrame = 0; });
}
function enterMobileEdit(offset = $("snippet-body").value.length) {
  if (!$("editor").classList.contains("mobile-unified")) return;
  const input = $("snippet-body");
  syncMobileScroll($("mobile-snippet-view"), input);
  setMobileEditorState(true);
  input.focus({ preventScroll: true });
  input.setSelectionRange(offset, offset);
  requestAnimationFrame(() => input.setSelectionRange(offset, offset));
}
$("mobile-snippet-view").addEventListener("click", event => {
  if (event.target.closest?.("a") || Date.now() < renderedViewLongPressUntil || selectionInside($("mobile-snippet-view"))) return;
  enterMobileEdit(renderedCaretOffset(event, $("mobile-snippet-view"), $("snippet-body").value));
});
$("mobile-snippet-view").addEventListener("keydown", event => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); enterMobileEdit(); }
});
$("snippet-body").addEventListener("scroll", () => {
  if (!$("editor").classList.contains("is-editing")) syncMobileScroll($("snippet-body"), $("mobile-snippet-view"));
});
$("snippet-body").addEventListener("focus", () => {
  if ($("editor").classList.contains("mobile-unified")) setMobileEditorState(true);
});
$("snippet-body").addEventListener("blur", () => {
  if (!$("editor").classList.contains("mobile-unified")) return;
  renderMarkdown($("mobile-snippet-view"), $("snippet-body").value);
  setMobileEditorState(false);
  requestAnimationFrame(() => syncMobileScroll($("snippet-body"), $("mobile-snippet-view")));
});
window.visualViewport?.addEventListener("resize", () => {
  const input = $("snippet-body");
  if (!$("editor").classList.contains("mobile-unified") || document.activeElement !== input) return;
  if (window.visualViewport.height >= document.documentElement.clientHeight - 80) input.blur();
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
  beginEditorSaveFeedback();
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
    clearEditorSaveFeedback();
    $("snippet-body").focus();
  } catch {
    clearTimeout(editorSlowSaveTimer);
    editorSlowSaveTimer = null;
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
$("mobile-editor-retry").addEventListener("click", () => $("editor-retry").click());
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
cancelDialogOnBackdrop($("snippet-action-menu"));
cancelDialogOnBackdrop($("paste-import-dialog"));
$("snippet-action-menu").addEventListener("touchstart", clearInteractiveSelection, { passive: true });
$("snippet-action-menu").addEventListener("selectstart", event => event.preventDefault());
$("snippet-action-menu").addEventListener("contextmenu", event => event.preventDefault());
$("snippet-action-menu").addEventListener("close", () => {
  if (actionMenuClearsSelection) clearListSelection();
  actionMenuClearsSelection = false;
  actionMenuSnippet = null;
});
async function deleteSnippet(snippet, { selectNext = true } = {}) {
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
    state.selected = selectNext && filteredCount > 1 ? Math.min(Math.max(filteredIndex, 0), filteredCount - 2) : -1;
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
$("mobile-delete").addEventListener("click", () => deleteSnippet(state.editing));
$("snippet-action-open").addEventListener("click", () => {
  const snippet = actionMenuSnippet; const url = snippet && standaloneUrl(snippet); closeSnippetActionMenu();
  if (url) openInNewTab(url);
});
$("snippet-action-copy").addEventListener("click", () => {
  const snippet = actionMenuSnippet;
  const index = actionMenuIndex;
  const keepSelection = !actionMenuClearsSelection;
  closeSnippetActionMenu();
  if (keepSelection && index >= 0) setSelected(index, false);
  if (snippet) navigator.clipboard.writeText(snippetText(snippet)).then(() => {
    const currentIndex = state.filtered.findIndex(item => item.id === snippet.id);
    if (keepSelection && currentIndex >= 0) setSelected(currentIndex, false);
    showToast("Copied");
  }).catch(showCopyError);
});
$("snippet-action-share").addEventListener("click", () => {
  const snippet = actionMenuSnippet; const button = $("snippet-action-share"); closeSnippetActionMenu();
  if (snippet) shareSnippet(snippet, button).catch(showError);
});
$("snippet-action-edit").addEventListener("click", () => {
  const snippet = actionMenuSnippet; closeSnippetActionMenu();
  if (snippet) runListActionAfterSave(() => openEditor(snippet));
});
$("snippet-action-delete").addEventListener("click", () => {
  const snippet = actionMenuSnippet;
  const selectNext = !actionMenuClearsSelection;
  closeSnippetActionMenu();
  if (snippet) void deleteSnippet(snippet, { selectNext });
});
async function undoRecentDeletion() {
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
}
$("toast-action").addEventListener("click", () => { void undoRecentDeletion(); });
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
  try {
    const snippets = parser(await file.text());
    await importParsedSnippets(snippets, $("transfer-status"));
  } catch (error) {
    $("transfer-status").textContent = error.message || String(error);
  } finally {
    input.value = "";
    setTransferBusy(false);
  }
}
async function importParsedSnippets(snippets, status) {
  let completed = 0;
  try {
    for (const snippet of snippets) {
      status.textContent = `Importing ${completed + 1} of ${snippets.length}…`;
      await api("/snippets", { method: "POST", body: JSON.stringify({ ...snippet, importId: crypto.randomUUID() }) });
      completed++;
    }
  } finally {
    if (completed) {
      const data = await api("/snippets").catch(() => null);
      if (data) { state.snippets = data.snippets; state.selected = -1; render(); }
    }
  }
  status.textContent = `Imported ${completed} snippet${completed === 1 ? "" : "s"}. Existing snippets were not changed.`;
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
$("import-format").addEventListener("change", event => {
  const format = event.target.value;
  event.target.value = "";
  if (format) chooseImport(`import-${format}-file`);
});
$("export-format").addEventListener("change", event => {
  const format = event.target.value;
  event.target.value = "";
  if (format === "csv") downloadLibrary(snippetsToCsv(state.snippets), "text/csv;charset=utf-8", "csv");
  if (format === "json") downloadLibrary(snippetsToJson(state.snippets), "application/json;charset=utf-8", "json");
});

let reviewedPasteImport = null;
function openPasteImport() {
  reviewedPasteImport = null;
  $("paste-import-data").value = "";
  $("paste-import-format").value = "auto";
  $("paste-import-status").textContent = "";
  $("confirm-paste-import").disabled = true;
  $("paste-import-dialog").showModal();
  $("paste-import-data").focus();
}
function reviewPasteImport() {
  reviewedPasteImport = null;
  $("confirm-paste-import").disabled = true;
  try {
    reviewedPasteImport = detectPastedSnippets($("paste-import-data").value, $("paste-import-format").value);
    const count = reviewedPasteImport.snippets.length;
    $("paste-import-status").textContent = `${count} snippet${count === 1 ? "" : "s"} ready to import · ${reviewedPasteImport.format}`;
    $("confirm-paste-import").disabled = false;
  } catch (error) { $("paste-import-status").textContent = error.message || String(error); }
}
$("paste-import").addEventListener("click", openPasteImport);
$("paste-import-mobile").addEventListener("click", openPasteImport);
$("cancel-paste-import").addEventListener("click", () => $("paste-import-dialog").close());
$("preview-paste-import").addEventListener("click", reviewPasteImport);
for (const id of ["paste-import-data", "paste-import-format"]) $(id).addEventListener("input", () => {
  reviewedPasteImport = null;
  $("confirm-paste-import").disabled = true;
  $("paste-import-status").textContent = "";
});
$("paste-import-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (!reviewedPasteImport || transferBusy) return;
  setTransferBusy(true);
  const button = $("confirm-paste-import"); button.disabled = true;
  try {
    await importParsedSnippets(reviewedPasteImport.snippets, $("paste-import-status"));
    $("transfer-status").textContent = $("paste-import-status").textContent;
    $("paste-import-dialog").close();
  } catch (error) { $("paste-import-status").textContent = error.message || String(error); }
  finally { setTransferBusy(false); }
});

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
$("autocomplete-trigger").addEventListener("keydown", event => {
  if (event.key === "Tab") return;
  event.preventDefault();
  const shortcut = triggerShortcutFromEvent(event);
  if (!shortcut) {
    if (!["Shift", "Meta", "Control", "Alt"].includes(event.key)) $("trigger-status").textContent = "Use one to three keys.";
    return;
  }
  setTriggerShortcut(shortcut);
  $("trigger-status").textContent = "";
});
$("save-trigger").addEventListener("click", async () => {
  const button = $("save-trigger"); button.disabled = true; $("trigger-status").textContent = "";
  try {
    const saved = await api("/preferences", { method: "PUT", body: JSON.stringify({ autocompleteTrigger: $("autocomplete-trigger").dataset.shortcut }) });
    setTriggerShortcut(saved.autocompleteTrigger);
    showToast("Saved");
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
// The vanilla client remains available during the React migration, but it no
// longer scans the complete library every few seconds. Returning to the tab
// still refreshes immediately; React owns the near-real-time change feed.
setInterval(() => { if (!document.hidden) void syncFromServer(); }, 600000);
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
  const editing = !$("editor").hidden, settings = !$("settings-panel").hidden,
    deleted = !$("deleted-panel").hidden,
    viewerOpen = narrowLayout() && $("app").classList.contains("viewer-open");
  const undoShortcut = editing && !event.altKey && event.key.toLowerCase() === "z"
    && (isMacPlatform ? event.metaKey && !event.ctrlKey && !event.shiftKey : event.ctrlKey && !event.metaKey && !event.shiftKey);
  const redoShortcut = editing && !event.altKey && (
    (isMacPlatform && event.metaKey && !event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "z")
    || (!isMacPlatform && event.ctrlKey && !event.metaKey && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z")))
  );
  if (undoShortcut || redoShortcut) { event.preventDefault(); void performEditorHistory(undoShortcut ? "undo" : "redo"); return; }
  const deletionUndoShortcut = pendingUndo && !editing && !event.altKey && !event.shiftKey
    && event.key.toLowerCase() === "z"
    && (isMacPlatform ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey);
  if (deletionUndoShortcut) { event.preventDefault(); void undoRecentDeletion(); return; }
  if (!settings && isSidebarShortcut(event)) { event.preventDefault(); toggleReaderMode(); return; }
  if (!settings && !deleted && event.key === "Escape" && $("app").classList.contains("reader-mode")) {
    event.preventDefault(); toggleReaderMode(); return;
  }
  if (event.key === "Escape") {
    if (editing) { event.preventDefault(); void navigateAfterSave(leaveRoutedView); }
    else if (deleted) { event.preventDefault(); returnToSettings(); }
    else if (settings || viewerOpen) leaveRoutedView();
    else if ($("search").value) { event.preventDefault(); clearSearch(); }
    return;
  }
  const defaultDraftField = state.editorContext === "default" && document.activeElement === $("snippet-body");
  if ((editing && (state.editorContext !== "default" || defaultDraftField)) || settings || deleted) return;
  if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); void navigateAfterSave(() => openEditor()); return; }
  const selected = state.filtered[state.selected];
  if (modifier && event.key.toLowerCase() === "e" && selected) { event.preventDefault(); void navigateAfterSave(() => openEditor(selected)); return; }
  if (modifier && event.key.toLowerCase() === "c" && selected) { event.preventDefault(); copySnippet(selected).catch(showCopyError); return; }
  if (modifier && event.key === "Enter" && selected) {
    const url = standaloneUrl(selected); if (url) { event.preventDefault(); openInNewTab(url); }
    return;
  }
  const deleteKey = event.key === "Delete" || (isMacPlatform && event.key === "Backspace");
  const searchHasText = document.activeElement === $("search") && Boolean($("search").value);
  if (!narrowLayout() && deleteKey && selected && !searchHasText) {
    event.preventDefault();
    void deleteSnippet(selected);
    return;
  }
  if (modifier && /^[1-9]$/.test(event.key)) {
    const numbered = state.filtered[Number(event.key) - 1];
    if (numbered) { event.preventDefault(); setSelected(Number(event.key) - 1); }
    return;
  }
  if (event.key === "ArrowDown") {
    event.preventDefault();
    beginKeyboardListNavigation();
    if (!$("app").classList.contains("reader-mode")) $("search").focus({ preventScroll: true });
    setSelected(state.selected + 1);
  }
  else if (event.key === "ArrowUp") {
    event.preventDefault();
    beginKeyboardListNavigation();
    if (!$("app").classList.contains("reader-mode")) $("search").focus({ preventScroll: true });
    setSelected(state.selected - 1);
  }
  else if (event.key === "ArrowRight") {
    const hovered = hoveredListItem();
    const target = hovered?.snippet || selected;
    if (target) {
      event.preventDefault();
      if (hovered) setSelected(hovered.index, false);
      runListActionAfterSave(() => { void useSnippet(target).catch(showCopyError); });
    }
  }
  else if (event.key === "Enter" && selected && document.activeElement === $("search")) { event.preventDefault(); runListActionAfterSave(() => openSnippet(selected)); }
  else if (event.key === "/" && document.activeElement !== $("search")) { event.preventDefault(); $("search").focus(); }
});

$("results").addEventListener("pointermove", event => {
  if (event.pointerType === "mouse") $("results").classList.remove("keyboard-navigation");
});

load();
