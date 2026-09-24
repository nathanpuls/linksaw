import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { setupSettings, rightCommandEnabled, updatePermission } from "./settings.mjs";
import { icon, setupIcons } from './icons.mjs';
import { setupTooltips } from './tooltips.mjs';
import { setupSettingsWindow } from './settings-window.mjs';
import { listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { expandDynamic, rankedSnippets, searchTemplate, snippetLabel, standaloneUrl, trim } from "./lib.mjs";
import linksawLogo from "../web/icon.png?url";

const native = Boolean(window.__TAURI_INTERNALS__);
const WEB_TRANSFER_SETTINGS_URL = "https://linksaw.com/home/?view=settings#import-export";
setupIcons();
setupTooltips();
const ui = Object.fromEntries(["search", "clear-search", "results", "status", "paste-permission", "enable-pasting", "open-paste-settings", "back", "add", "settings", "settings-dialog",
  "settings-form", "api-url", "account", "sign-out", "cancel-settings", "editor-dialog", "editor-form", "editor-title",
  "snippet-title", "snippet-body", "delete-snippet", "cancel-editor"]
  .map(id => [id.replaceAll("-", ""), document.getElementById(id)]));

const settingsWindow = setupSettingsWindow({ dialog: ui.settingsdialog, native,
  onError: () => { document.getElementById('settings-feedback').textContent = 'Could not adjust the window size. Settings are still available.'; },
});

const state = {
  api: import.meta.env.VITE_API_URL || "https://snippets-api.linksaw.com",
  token: "", user: null, snippets: [], selected: 0, query: "",
  searchService: null, editing: null, loading: false,
  signingIn: false, lastRefreshedAt: 0, refreshError: "", refreshSlow: false,
};
let lastPointer = null;
document.addEventListener("pointermove", event => {
  if (event.pointerType && event.pointerType !== 'mouse') return;
  const moved = !lastPointer || event.clientX !== lastPointer.x || event.clientY !== lastPointer.y;
  lastPointer = { x: event.clientX, y: event.clientY };
  if (!moved) return;
  if (document.querySelector('dialog[open]')) return;
  const wrapper = event.target.closest('.result-row');
  if (wrapper) { state.selected = Number(wrapper.dataset.index); updateSelection(false); }
});

async function readToken() {
  return native ? await invoke("read_session") : sessionStorage.getItem("linksaw-demo-token") || "";
}
async function saveToken(token) {
  if (native) await invoke("save_session", { token });
  else sessionStorage.setItem("linksaw-demo-token", token);
  state.token = token;
}
async function clearToken() {
  if (native) await invoke("clear_session");
  else sessionStorage.removeItem("linksaw-demo-token");
  state.token = "";
  state.lastRefreshedAt = 0; state.refreshError = "";
}
function status(message) { ui.status.textContent = message; }
let toastTimer;
let copyHideTimer;
function cancelCopyHide() { clearTimeout(copyHideTimer); }
document.addEventListener('keydown', cancelCopyHide, true);
document.addEventListener('pointerdown', cancelCopyHide, true);
document.addEventListener('input', cancelCopyHide, true);
document.addEventListener('wheel', cancelCopyHide, { capture: true, passive: true });
window.addEventListener('blur', cancelCopyHide);
function copiedToast() {
  const toast = document.getElementById('copy-toast');
  clearTimeout(toastTimer); toast.hidden = false;
  status('');
  cancelCopyHide();
  if (native) copyHideTimer = setTimeout(() => {
    toast.hidden = true;
    hide().catch(error => status(errorMessage(error)));
  }, 900);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 1600);
}
function errorMessage(error) { return error instanceof Error ? error.message : String(error || "Unknown error"); }

async function checkPastePermission() {
  await updatePermission();
  if (native && navigator.platform.includes("Mac")) {
    try { ui.pastepermission.hidden = await invoke("paste_access_status"); }
    catch { ui.pastepermission.hidden = true; }
  }
}

async function api(path, options = {}) {
  const base = new URL(state.api);
  if (base.protocol !== "https:" && !(base.protocol === "http:" && ["localhost", "127.0.0.1"].includes(base.hostname)))
    throw new Error("Use an HTTPS Worker URL, or localhost for development.");
  const response = await fetch(new URL(path, base).toString(), {
    method: options.method || "GET",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    const error = new Error(data.error || `Server returned ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function visibleItems() {
  if (state.searchService) {
    const query = trim(state.query);
    return query ? [{ type: "search-query", label: `Search for “${query}”`, query, service: state.searchService }] : [];
  }
  return rankedSnippets(state.snippets, state.query).slice(0, 80).map(item => ({ ...item, type: "snippet", label: snippetLabel(item) }));
}

function render() {
  updateRefreshFeedback();
  document.body.classList.toggle("signed-out", !state.user);
  const items = visibleItems();
  state.selected = Math.min(state.selected, Math.max(0, items.length - 1));
  ui.back.hidden = !state.searchService;
  ui.clearsearch.hidden = ui.search.value.length === 0;
  ui.search.placeholder = state.searchService ? `Search ${snippetLabel(state.searchService)}` : "Search";
  ui.results.replaceChildren();
  if (!state.user) {
    const box = document.createElement("div"); box.className = "login";
    const mark = document.createElement("img"); mark.className = "login-mark"; mark.src = linksawLogo; mark.alt = "Linksaw";
    const heading = document.createElement("h1"); heading.textContent = "Sign in to Linksaw";
    const caption = document.createElement("p"); caption.textContent = state.token ? "Your sign-in is saved. Try connecting again." : "Your snippets, on every device.";
    box.append(mark, heading, caption);
    const button = document.createElement("button"); button.className = "primary"; button.textContent = state.signingIn ? "Signing in…" : state.token ? "Retry connection" : "Continue with Google";
    button.disabled = state.signingIn;
    button.addEventListener("click", state.token ? restoreSession : signIn); box.append(button); ui.results.append(box); return;
  }
  if (!items.length) {
    const box = document.createElement("div"); box.className = "empty";
    box.textContent = state.query ? "No matches" : "No snippets yet. Use New snippet to add one.";
    ui.results.append(box); return;
  }
  items.forEach((item, index) => {
    const wrapper = document.createElement("div"); wrapper.className = "result-row";
    wrapper.dataset.index = index;
    const row = document.createElement("button"); row.type = "button";
    row.className = `result${index === state.selected ? " selected" : ""}`;
    const left = document.createElement("span");
    const title = document.createElement("div"); title.className = "result-title"; title.textContent = item.label;
    const meta = document.createElement("div"); meta.className = "result-meta";
    meta.textContent = item.type === 'search-query' ? 'Return to open in browser'
      : trim(item.body).replace(/\s+/g, ' ').slice(0, 110);
    left.append(title);
    const repeatsTitle = item.type === 'snippet' && trim(item.title) === trim(item.body);
    if (item.type === 'search-query' || (item.type === 'snippet' && trim(item.title) && !repeatsTitle)) left.append(meta);
    const key = document.createElement("span"); key.className = "result-key"; key.textContent = index < 9 ? `${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}${index + 1}` : "";
    row.append(left, key);
    row.addEventListener("click", () => act(item));
    wrapper.addEventListener('contextmenu', event => { event.preventDefault(); state.selected = index; updateSelection(false); openActions(item); });
    wrapper.prepend(row);
    const editable = item.type === "snippet" ? item : null;
    if (editable) {
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "result-edit";
      edit.append(icon('more', 17));
      edit.setAttribute("aria-label", `More options for ${snippetLabel(editable)}`);
      edit.dataset.tooltip = 'More options';
      edit.addEventListener("click", () => openActions(editable));
      wrapper.append(edit);
    }
    ui.results.append(wrapper);
  });
  updateSelection();
}

function updateSelection(scroll = true) {
  [...ui.results.querySelectorAll(".result")].forEach((row, index) => row.classList.toggle("selected", index === state.selected));
  [...ui.results.querySelectorAll(".result-row")].forEach((row, index) => row.classList.toggle("selected", index === state.selected));
  if (scroll) ui.results.querySelector(".result.selected")?.scrollIntoView({ block: "nearest" });
}

function resetSearch() { state.query = ""; state.selected = 0; ui.search.value = ""; render(); ui.search.focus(); }
function goBack() {
  if (state.searchService) state.searchService = null;
  else return false;
  resetSearch(); return true;
}

async function clipboardText() {
  if (native) return invoke("read_clipboard");
  try { return await navigator.clipboard.readText(); } catch { return ""; }
}
async function copyText(text) {
  if (native) return invoke("copy_text", { text });
  await navigator.clipboard.writeText(text);
}
async function hide() { if (native) await getCurrentWindow().hide(); }

async function act(item) {
  if (!item) return;
  if (item.type === "search-query") {
    const url = item.service.template.replaceAll("$", encodeURIComponent(item.query));
    if (native) await openUrl(url); else window.open(url, "_blank", "noopener");
    await hide(); return;
  }
  const body = item.body || "";
  if (item.type === "snippet") {
    const template = searchTemplate(body);
    if (template) { state.searchService = { ...item, template }; resetSearch(); return; }
  }
  const priorClipboard = await clipboardText();
  const expanded = expandDynamic(body, { clipboard: priorClipboard });
  const url = standaloneUrl(expanded.text);
  if (url) {
    if (native) await openUrl(url); else window.open(url, "_blank", "noopener");
    await hide(); return;
  }
  if (native) {
    try {
      const pasted = await invoke("paste_text", { text: expanded.text, cursorLeft: expanded.cursorLeft });
      if (!pasted) copiedToast();
    } catch (error) { status(errorMessage(error)); await checkPastePermission(); }
  } else { await copyText(expanded.text); copiedToast(); }
}

const STALE_AFTER_MS = 2_500;
let refreshPromise = null, refreshAgain = false, refreshSlowTimer = null;
function updateRefreshFeedback() {
  const feedback = document.getElementById('refresh-feedback');
  feedback.hidden = !state.user || (!state.refreshSlow && !state.refreshError);
  document.getElementById('refresh-message').textContent = state.loading ? 'Refreshing…' : state.refreshError;
  document.getElementById('retry-refresh').hidden = state.loading || !state.refreshError;
}
function refreshIfStale() {
  if (!state.user || !state.token) return;
  if (state.refreshError || !state.lastRefreshedAt || Date.now() - state.lastRefreshedAt >= STALE_AFTER_MS)
    return refresh({ force: false });
}
function refresh({ force = true } = {}) {
  if (!state.token || !state.user) return Promise.resolve();
  if (refreshPromise) {
    // Reopens share the existing request. Manual refresh and refresh after a
    // write queue another read, so a read begun before the write cannot win.
    if (force) refreshAgain = true;
    return refreshPromise;
  }
  state.loading = true;
  state.refreshSlow = false;
  clearTimeout(refreshSlowTimer);
  refreshSlowTimer = setTimeout(() => { if (state.loading) { state.refreshSlow = true; updateRefreshFeedback(); } }, 1600);
  if (!state.snippets.length) render();
  refreshPromise = (async () => {
    try {
      do {
        refreshAgain = false;
        const token = state.token, owner = state.user;
        try {
          const data = await api('/snippets');
          if (state.token !== token || state.user !== owner) continue;
          if (!Array.isArray(data.snippets)) throw new Error('The server returned an invalid snippet list.');
          const selected = visibleItems()[state.selected];
          state.snippets = data.snippets;
          state.lastRefreshedAt = Date.now(); state.refreshError = '';
          status('');
          if (selected?.type === 'snippet') {
            const index = visibleItems().findIndex(item => item.type === 'snippet' && item.id === selected.id);
            if (index >= 0) state.selected = index;
          }
          render();
        } catch (error) {
          if (state.token !== token || state.user !== owner) continue;
          if (error.status === 401) {
            await clearToken(); state.user = null; state.snippets = [];
            status('Sign in again to open your snippets.');
          } else {
            state.refreshError = `Could not refresh snippets: ${errorMessage(error)}`;
          }
        }
      } while (refreshAgain && state.token && state.user);
    } finally {
      clearTimeout(refreshSlowTimer);
      state.loading = false; state.refreshSlow = false; refreshPromise = null;
      updateRefreshFeedback();
      // Existing results stay interactive during the request and on failure.
      // Only an empty or signed-out view needs its loading message replaced.
      if (!state.user || !ui.results.querySelector('.result-row')) render();
    }
  })();
  return refreshPromise;
}

async function restoreSession() {
  state.token = await readToken();
  if (!state.token) { render(); return; }
  try { state.user = (await api("/me")).user; await api("/details", { method: "DELETE" }); await refresh(); }
  catch (error) {
    if (error.status === 401) await clearToken();
    state.user = null;
    status(error.status === 401 ? "Sign in again to open your snippets." : `Could not connect: ${errorMessage(error)}`);
    render();
  }
}

async function signIn() {
  if (state.signingIn) return;
  state.signingIn = true; render();
  const launcher = native ? getCurrentWindow() : null;
  try {
    status("Opening Google sign-in…");
    const bytes = crypto.getRandomValues(new Uint8Array(48));
    const verifier = btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash))).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
    const request = await api("/auth/start", { method: "POST", body: { codeChallenge: challenge } });
    // The launcher floats above normal windows; get it out of the way before opening the browser.
    await launcher?.hide();
    if (native) await openUrl(request.url); else window.open(request.url, "_blank", "noopener");
    const deadline = Date.now() + 300000;
    while (Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const result = await api("/auth/poll", { method: "POST", body: { requestId: request.requestId, verifier } });
      if (result.pending) continue;
      await saveToken(result.token);
      state.user = (await api("/me")).user;
      await api("/details", { method: "DELETE" });
      ui.settingsdialog.close();
      await refresh(); await launcher?.show(); await launcher?.setFocus(); ui.search.focus(); return;
    }
    status("Sign-in timed out. Try again.");
    await launcher?.show(); await launcher?.setFocus();
  } catch (error) {
    status(errorMessage(error));
    await launcher?.show(); await launcher?.setFocus();
  } finally { state.signingIn = false; render(); }
}

function openSettings() {
  void checkPastePermission();
  ui.account.textContent = state.user ? `Signed in as ${state.user.email}` : "Not signed in";
  ui.signout.hidden = !state.user;
  ui.settingsdialog.showModal();
  void settingsWindow.enter();
}

let editorBaseline = '', editorSaving = false, editorAutosaveTimer, editorSaveAgain = false, editorConflict = null;
function resizeEditorArea(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = `${textarea.scrollHeight}px`;
}
function editorSnapshot() {
  return JSON.stringify({ title: ui.snippettitle.value, body: ui.snippetbody.value });
}
function openEditor(snippet = null) {
  if (!state.user) { status("Sign in first."); return; }
  state.editing = snippet;
  editorConflict = null;
  clearTimeout(editorAutosaveTimer);
  document.getElementById('unsaved-confirmation').hidden = true;
  document.getElementById('delete-confirmation').hidden = true;
  document.getElementById('editor-feedback').textContent = '';
  ui.editortitle.textContent = snippet ? "Edit snippet" : "New snippet";
  ui.snippettitle.value = snippet?.title || "";
  ui.snippetbody.value = snippet?.body || "";
  ui.deletesnippet.hidden = !snippet;
  editorBaseline = editorSnapshot();
  ui.editordialog.showModal();
  resizeEditorArea(ui.snippetbody);
  ui.snippetbody.focus();
}
async function saveEditor(event, { closeAfter = false } = {}) {
  event?.preventDefault();
  clearTimeout(editorAutosaveTimer);
  if (editorSaving) { editorSaveAgain = true; return false; }
  if (!ui.snippettitle.value.trim() && !ui.snippetbody.value.trim()) {
    document.getElementById('editor-feedback').textContent = '';
    if (closeAfter) ui.editordialog.close();
    return true;
  }
  if (closeAfter && editorConflict && state.editing) { state.editing = { ...state.editing, ...editorConflict }; editorConflict = null; }
  editorSaving = true;
  document.getElementById('editor-feedback').textContent = 'Saving…';
  const snapshot = editorSnapshot();
  const body = { title: ui.snippettitle.value, body: ui.snippetbody.value, ...(state.editing ? { version: state.editing.version } : {}) };
  let saved = false;
  try {
    const result = state.editing
      ? await api(`/snippets/${state.editing.id}`, { method: "PUT", body })
      : await api("/snippets", { method: "POST", body });
    if (result.snippet) state.editing = result.snippet;
    editorBaseline = snapshot;
    editorConflict = null;
    document.getElementById('editor-feedback').textContent = 'Saved';
    saved = true;
    await refresh();
  } catch (error) {
    if (error.status === 409) {
      const conflict = error.data?.snippet || null;
      if (conflict && conflict.title === body.title && conflict.body === body.body) {
        state.editing = conflict;
        editorBaseline = snapshot;
        editorConflict = null;
        document.getElementById('editor-feedback').textContent = 'Saved';
        saved = true;
        await refresh();
      } else {
        editorConflict = conflict;
        document.getElementById('editor-feedback').textContent = 'Couldn’t save · Try again';
      }
    } else document.getElementById('editor-feedback').textContent = 'Couldn’t save · Try again';
  } finally {
    editorSaving = false;
    if (editorSaveAgain && !editorConflict) {
      editorSaveAgain = false;
      saved = await saveEditor(null, { closeAfter: false });
    }
  }
  if (saved && closeAfter && editorSnapshot() === editorBaseline) ui.editordialog.close();
  return saved;
}
function scheduleEditorAutosave() {
  clearTimeout(editorAutosaveTimer);
  if (editorConflict || editorSnapshot() === editorBaseline) return;
  document.getElementById('editor-feedback').textContent = 'Saving…';
  editorAutosaveTimer = setTimeout(() => { void saveEditor(null, { closeAfter: false }); }, 700);
}
async function closeEditorAfterAutosave() {
  clearTimeout(editorAutosaveTimer);
  if (editorSaving) {
    editorSaveAgain = editorSnapshot() !== editorBaseline;
    document.getElementById('editor-feedback').textContent = 'Saving…';
    while (editorSaving) await new Promise(resolve => setTimeout(resolve, 30));
  }
  if (editorSnapshot() === editorBaseline || (!state.editing && !ui.snippettitle.value.trim() && !ui.snippetbody.value.trim())) {
    ui.editordialog.close();
    return true;
  }
  return saveEditor(null, { closeAfter: true });
}

// Require both press and release on the backdrop, not a drag from a field.
let editorBackdropPress = false;
function outsideEditor(event) {
  const box = ui.editordialog.getBoundingClientRect();
  return event.target === ui.editordialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
}
ui.editordialog.addEventListener('pointerdown', event => { editorBackdropPress = outsideEditor(event); });
ui.editordialog.addEventListener('click', event => {
  if (editorBackdropPress && outsideEditor(event)) void closeEditorAfterAutosave();
  editorBackdropPress = false;
});
ui.editordialog.addEventListener('cancel', event => { event.preventDefault(); void closeEditorAfterAutosave(); });
ui.canceleditor.addEventListener('click', () => { void closeEditorAfterAutosave(); });
ui.editordialog.addEventListener('keydown', event => {
  if (event.isComposing || !(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
  event.preventDefault(); void saveEditor(null, { closeAfter: false });
});

ui.search.addEventListener("input", () => { state.query = ui.search.value; state.selected = 0; render(); });
ui.snippetbody.addEventListener('input', () => { resizeEditorArea(ui.snippetbody); scheduleEditorAutosave(); });
ui.clearsearch.addEventListener("click", resetSearch);
ui.back.addEventListener("click", goBack);
ui.add.addEventListener("click", () => openEditor());
document.getElementById("retry-refresh").addEventListener("click", () => { void refresh(); });
ui.settings.addEventListener("click", openSettings);
document.getElementById("close-settings").onclick = () => ui.settingsdialog.close();
document.getElementById("open-web-settings").addEventListener("click", async () => {
  try {
    if (native) await openUrl(WEB_TRANSFER_SETTINGS_URL);
    else window.open(WEB_TRANSFER_SETTINGS_URL, "_blank", "noopener");
  } catch (error) {
    document.getElementById("settings-feedback").textContent = errorMessage(error);
  }
});
ui.settingsform.addEventListener("submit", event => {
  event.preventDefault();
  ui.settingsdialog.close();
});
ui.signout.addEventListener("click", async () => {
  try { await api("/auth/logout", { method: "POST" }); } catch { /* local sign-out still completes */ }
  await clearToken(); state.user = null; state.snippets = [];
  ui.settingsdialog.close(); status("Signed out"); render();
});
ui.editorform.addEventListener("submit", event => { event.preventDefault(); void saveEditor(null, { closeAfter: false }); });
ui.deletesnippet.addEventListener("click", async () => {
  if (!state.editing) return;
  document.getElementById('delete-confirmation').hidden = false;
  document.getElementById('confirm-delete').focus();
});
document.getElementById('cancel-delete').addEventListener('click', () => { document.getElementById('delete-confirmation').hidden = true; });
document.getElementById('confirm-delete').addEventListener('click', async event => {
  if (!state.editing || event.currentTarget.disabled) return;
  const button = event.currentTarget; button.disabled = true;
  try {
    await api(`/snippets/${state.editing.id}`, { method: 'DELETE' });
    ui.editordialog.close(); state.editing = null; await refresh();
  } catch (error) { document.getElementById('editor-feedback').textContent = `Could not delete: ${errorMessage(error)}`; }
  finally { button.disabled = false; }
});
document.getElementById('edit-hint').textContent = navigator.platform.includes('Mac') ? '⌘E' : 'Ctrl E';
document.querySelectorAll('[data-shortcut]').forEach(key => {
  key.textContent = `${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl '}${key.dataset.shortcut}`;
});
function focusSearch() {
  if (state.user && !document.querySelector('dialog[open]')) ui.search.focus();
}
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => queueMicrotask(focusSearch)));
window.addEventListener('focus', focusSearch);
ui.openpastesettings.addEventListener("click", async () => {
  const launcher = getCurrentWindow();
  try { await launcher.hide(); await invoke("open_paste_settings"); }
  catch (error) { await launcher.show(); await launcher.setFocus(); status(errorMessage(error)); }
});
window.addEventListener("focus", checkPastePermission);
window.addEventListener("focus", () => { void refreshIfStale(); });

document.addEventListener("keydown", async event => {
  if (document.querySelector('dialog[open]')) return;
  if (event.isComposing || !state.user) return;
  if (document.activeElement !== ui.search && !event.metaKey && !event.ctrlKey && !event.altKey) {
    if (event.key === '/') { event.preventDefault(); focusSearch(); return; }
    if (event.key.length === 1) {
      event.preventDefault(); focusSearch();
      ui.search.setRangeText(event.key, ui.search.selectionStart, ui.search.selectionEnd, 'end');
      ui.search.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'n') {
    event.preventDefault();
    if (!event.repeat) openEditor();
    return;
  }
  const items = visibleItems();
  if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'c') {
    const item = items[state.selected];
    if (item && item.type !== 'search-query') { event.preventDefault(); if (!event.repeat) await copyItem(item); }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openActions(items[state.selected]); return; }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'p') { event.preventDefault(); openPreview(items[state.selected]); return; }
  if (event.shiftKey && event.key === 'F10') { event.preventDefault(); openActions(items[state.selected]); return; }
  if (["ArrowDown", "ArrowUp"].includes(event.key)) {
    event.preventDefault(); state.selected = Math.max(0, Math.min(items.length - 1, state.selected + (event.key === "ArrowDown" ? 1 : -1))); updateSelection();
  } else if (event.key === "Enter") { event.preventDefault(); await act(items[state.selected]); }
  else if (event.key === "ArrowRight") {
    const item = items[state.selected];
    if (item?.type === "snippet") { event.preventDefault(); openPreview(item); }
  } else if (event.key === "ArrowLeft") { if (goBack()) event.preventDefault(); }
  else if (event.key === "Escape") { event.preventDefault(); if (!goBack()) await hide(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") { event.preventDefault(); await refresh(); }
  else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "e") {
    const item = items[state.selected];
    if (item?.type === "snippet") { event.preventDefault(); openEditor(item); }
  } else if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
    const item = items[Number(event.key) - 1]; if (item) { event.preventDefault(); await act(item); }
  }
});

const actionDialog = document.getElementById('snippet-actions');
const previewDialog = document.getElementById('snippet-preview');
let previewItem = null;
document.getElementById('close-preview').append(icon('close'));
function closePreview() { previewDialog.close(); ui.search.focus(); }
document.getElementById('close-preview').onclick = closePreview;
previewDialog.addEventListener('cancel', event => { event.preventDefault(); closePreview(); });
function openPreview(item) {
  if (!item || item.type === 'search-query') return;
  previewItem = item;
  const previewTitle = document.getElementById('preview-title');
  const previewBody = document.getElementById('preview-body');
  previewTitle.textContent = item.title || '';
  previewTitle.hidden = !item.title;
  previewBody.textContent = item.body || '';
  previewBody.hidden = !item.body;
  document.getElementById('preview-feedback').textContent = '';
  previewDialog.showModal();
  previewDialog.focus();
}
document.getElementById('preview-edit').onclick = () => { previewDialog.close(); openEditor(previewItem); };
async function copyItem(item) {
  try { await copyText(item.body || ''); status('Copied'); }
  catch (error) { status(errorMessage(error)); }
}
async function copyPreview() {
  const feedback = document.getElementById('preview-feedback');
  try { await copyText(previewItem.body || ''); feedback.textContent = 'Copied'; }
  catch (error) { feedback.textContent = errorMessage(error); }
}
document.getElementById('preview-copy').onclick = copyPreview;
async function sharePreview() {
  const feedback = document.getElementById('preview-feedback');
  try {
    const share = await api(`/snippets/${previewItem.id}/share`, { method: 'POST' });
    previewItem.share_token = share.token;
    await copyText(share.url);
    feedback.textContent = 'Link copied';
  } catch (error) { feedback.textContent = errorMessage(error); }
}
document.getElementById('preview-share').onclick = sharePreview;
async function deletePreview() {
  const deleting = previewItem;
  if (!deleting) return;
  const button = document.getElementById('preview-delete');
  button.disabled = true;
  try {
    const result = await api(`/snippets/${deleting.id}`, { method: 'DELETE' });
    previewDialog.close(); previewItem = null;
    await refresh();
    showDeletedToast(result.deleted || deleting);
  } catch (error) { document.getElementById('preview-feedback').textContent = errorMessage(error); }
  finally { button.disabled = false; }
}
document.getElementById('preview-delete').onclick = deletePreview;
let deletedUndo = null, deletedUndoTimer = null;
function showDeletedToast(deleted) {
  deletedUndo = deleted;
  const toast = document.getElementById('delete-toast');
  toast.hidden = false;
  clearTimeout(deletedUndoTimer);
  deletedUndoTimer = setTimeout(() => { deletedUndo = null; toast.hidden = true; }, 7000);
}
document.getElementById('undo-delete').addEventListener('click', async () => {
  if (!deletedUndo) return;
  const deleted = deletedUndo;
  deletedUndo = null;
  clearTimeout(deletedUndoTimer);
  document.getElementById('delete-toast').hidden = true;
  try {
    await api(`/snippets/${deleted.id}/restore`, { method: 'POST', body: deleted });
    await refresh();
  } catch (error) { status(`Could not undo deletion: ${errorMessage(error)}`); }
});
previewDialog.addEventListener('keydown', async event => {
  event.stopPropagation();
  if (event.isComposing || event.altKey || event.shiftKey) return;
  const mod = event.metaKey || event.ctrlKey;
  if (mod && event.key.toLowerCase() === 'c') {
    event.preventDefault(); if (!event.repeat) await copyPreview();
  } else if (!mod && ['ArrowLeft', 'Escape'].includes(event.key)) {
    event.preventDefault(); closePreview();
  } else if ((!mod && event.key === 'Enter') || (mod && event.key === '1')) {
    if (!mod && document.activeElement?.tagName === 'BUTTON' && document.activeElement.id !== 'close-preview') return;
    event.preventDefault(); if (!event.repeat) { closePreview(); await act(previewItem); }
  }
});
function openActions(item) {
  if (!item || item.type === 'search-query') return;
  const list = document.getElementById('snippet-action-list'); list.replaceChildren();
  const editable = item;
  const actions = [
    ['Preview', 'preview', () => openPreview(item)],
    ['Edit content', 'edit', () => openEditor(editable)],
    ['Rename', 'edit', () => openRename(editable)],
    ['Copy', 'copy', () => copyItem(item)],
    ['Delete snippet…', 'trash', () => { openEditor(editable); ui.deletesnippet.click(); }],
  ];
  for (const [label, name, run] of actions) {
    const button = document.createElement('button'); button.type = 'button'; button.append(icon(name, 16), document.createTextNode(label));
    button.onclick = () => { actionDialog.close(); run(); }; list.append(button);
  }
  actionDialog.showModal();
}
actionDialog.addEventListener('click', event => { if (event.target === actionDialog) actionDialog.close(); });
actionDialog.addEventListener('keydown', event => {
  if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return;
  event.preventDefault(); const buttons = [...actionDialog.querySelectorAll('button')];
  const index = buttons.indexOf(document.activeElement); buttons[(index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length].focus();
});

let renamingSnippet = null;
function openRename(item) {
  if (!item || item.type === 'search-query') return;
  renamingSnippet = item;
  const input = document.getElementById('rename-input');
  input.value = item.title || '';
  document.getElementById('rename-feedback').textContent = '';
  document.getElementById('rename-dialog').showModal();
  input.focus(); input.select();
}
document.getElementById('cancel-rename').addEventListener('click', () => document.getElementById('rename-dialog').close());
document.getElementById('rename-dialog').addEventListener('click', event => { if (event.target === event.currentTarget) event.currentTarget.close(); });
document.getElementById('rename-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!renamingSnippet) return;
  const title = document.getElementById('rename-input').value;
  const feedback = document.getElementById('rename-feedback');
  if (!title.trim() && !renamingSnippet.body.trim()) { feedback.textContent = 'A snippet without content needs a name.'; return; }
  feedback.textContent = 'Saving…';
  try {
    await api(`/snippets/${renamingSnippet.id}`, { method: 'PUT', body: { title, body: renamingSnippet.body, version: renamingSnippet.version } });
    document.getElementById('rename-dialog').close(); await refresh();
  } catch (error) { feedback.textContent = errorMessage(error); }
});

async function boot() {
  await checkPastePermission();
  if (native) {
    // Native window focus also covers Dock reopen and application activation,
    // which do not always produce a browser-level focus event in a WebView.
    await getCurrentWindow().onFocusChanged(({ payload }) => { if (payload) void refreshIfStale(); });
    await listen('request-quit', async () => {
      if (!ui.editordialog.open) { await invoke('finish_quit'); return; }
      await getCurrentWindow().show(); await getCurrentWindow().setFocus();
      if (await closeEditorAfterAutosave()) await invoke('finish_quit');
    });
    // Settings can grant access while the launcher is hidden.
    setInterval(checkPastePermission, 2000);
    let toggling = false;
    const toggleLauncher = async () => {
      if (toggling) return;
      toggling = true;
      try {
        const window = getCurrentWindow();
        if (await window.isFocused()) await window.hide();
        else { await invoke("remember_target_app"); await window.show(); await window.setFocus(); resetSearch(); void refreshIfStale(); await checkPastePermission(); }
      } catch (error) { status(errorMessage(error)); }
      finally { toggling = false; }
    };
    // Native macOS listener handles a solo right-Command tap; the conventional
    // shortcut remains available on both macOS and Windows.
    await listen("right-command-tap", () => { if (rightCommandEnabled()) return toggleLauncher(); });
    await setupSettings(toggleLauncher);
  } else { await setupSettings(() => {}); }
  try { await restoreSession(); } catch (error) { status(errorMessage(error)); }
  render();
}
setInterval(() => { void refreshIfStale(); }, 3000);
boot();
