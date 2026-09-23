const API = "https://snippets-api.linksaw.com";
const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
};

const $ = id => document.getElementById(id);
const state = { snippets: [], filtered: [], selected: 0, editing: null, previewing: null, user: null };
let toastTimer;

function icon(id, name) { $(id).innerHTML = icons[name]; }
icon("add", "plus"); icon("settings", "settings"); icon("close-editor", "close");
icon("close-preview", "back"); icon("preview-edit", "edit"); icon("preview-copy", "copy"); icon("close-settings", "back");

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
function snippetText(snippet) { return snippet.body || snippet.title; }
function standaloneUrl(snippet) {
  const text = snippetText(snippet).trim();
  if (/^https?:\/\/[^\s]+$/i.test(text)) return text;
  if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(text)) return `https://${text}`;
  return "";
}
function showToast(message = "Copied") {
  clearTimeout(toastTimer); $("toast").textContent = message; $("toast").hidden = false;
  toastTimer = setTimeout(() => { $("toast").hidden = true; }, 1400);
}
async function copySnippet(snippet) {
  await navigator.clipboard.writeText(snippetText(snippet));
  showToast();
}
function useSnippet(snippet) {
  const url = standaloneUrl(snippet);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  else copySnippet(snippet).catch(showError);
}
function setSelected(index, scroll = true) {
  state.selected = Math.max(0, Math.min(index, Math.max(0, state.filtered.length - 1)));
  document.querySelectorAll(".result-row").forEach((row, i) => row.classList.toggle("selected", i === state.selected));
  if (scroll) document.querySelector(`.result-row[data-index="${state.selected}"]`)?.scrollIntoView({ block: "nearest" });
}
function render() {
  const query = $("search").value.trim().toLowerCase();
  state.filtered = state.snippets.filter(s => !query || `${s.title}\n${s.body}`.toLowerCase().includes(query));
  state.selected = Math.min(state.selected, Math.max(0, state.filtered.length - 1));
  const results = $("results"); results.replaceChildren();
  if (!state.filtered.length) {
    const empty = document.createElement("div"); empty.className = "empty";
    empty.textContent = query ? "No matching snippets" : "No snippets yet";
    if (!query) { const button = document.createElement("button"); button.className = "text-button"; button.textContent = "Create a snippet"; button.addEventListener("click", () => openEditor()); empty.append(button); }
    results.append(empty); return;
  }
  state.filtered.forEach((snippet, index) => {
    const row = document.createElement("article"); row.className = `result-row${index === state.selected ? " selected" : ""}`; row.dataset.index = index;
    const main = document.createElement("button"); main.type = "button"; main.className = "result-main";
    const text = document.createElement("span"); text.className = "result-text";
    const title = document.createElement("div"); title.className = "result-title"; title.textContent = label(snippet);
    const preview = document.createElement("div"); preview.className = "result-preview"; preview.textContent = snippet.body.replace(/\s+/g, " ").trim();
    text.append(title);
    if (snippet.title.trim() && snippet.body.trim()) text.append(preview);
    const key = document.createElement("span"); key.className = "result-key"; key.textContent = index < 9 ? `${navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}${index + 1}` : "";
    main.append(text, key); main.addEventListener("click", () => { setSelected(index); useSnippet(snippet); });
    const copy = document.createElement("button"); copy.type = "button"; copy.className = "icon-button result-action"; copy.ariaLabel = "Copy snippet"; copy.title = "Copy"; copy.innerHTML = icons.copy; copy.addEventListener("click", () => { setSelected(index); copySnippet(snippet).catch(showError); });
    const edit = document.createElement("button"); edit.type = "button"; edit.className = "icon-button result-action"; edit.ariaLabel = "Edit snippet"; edit.title = "Edit"; edit.innerHTML = icons.edit; edit.addEventListener("click", () => { setSelected(index); openEditor(snippet); });
    row.addEventListener("pointerenter", event => { if (event.pointerType !== "touch") setSelected(index, false); });
    row.append(main, copy, edit); results.append(row);
  });
}
function showError(error) { $("status").textContent = error.message || String(error); }
function showSurface(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeSurface(id) { $(id).hidden = true; if (!["editor", "preview", "settings-panel"].some(name => !$(name).hidden)) document.body.style.overflow = ""; $("search").focus(); }
function openEditor(snippet = null) {
  state.editing = snippet; $("snippet-title").value = snippet?.title || ""; $("snippet-body").value = snippet?.body || "";
  $("delete").hidden = !snippet; $("editor-status").textContent = ""; showSurface("editor");
  setTimeout(() => (snippet?.title ? $("snippet-body") : $("snippet-title")).focus(), 0);
}
function openPreview(snippet) {
  if (!snippet) return; state.previewing = snippet; $("preview-title").textContent = label(snippet); $("preview-body").textContent = snippet.body || snippet.title; showSurface("preview");
}
async function load() {
  try {
    const [{ user }, { snippets }] = await Promise.all([api("/me"), api("/snippets")]);
    state.user = user; state.snippets = snippets; $("account").textContent = user.email; $("app").ariaBusy = "false"; render();
  } catch (error) { showError(error); }
}

$("search").addEventListener("input", () => { state.selected = 0; render(); });
$("add").addEventListener("click", () => openEditor());
$("settings").addEventListener("click", () => showSurface("settings-panel"));
$("close-editor").addEventListener("click", () => closeSurface("editor"));
$("close-preview").addEventListener("click", () => closeSurface("preview"));
$("close-settings").addEventListener("click", () => closeSurface("settings-panel"));
$("preview-copy").addEventListener("click", () => copySnippet(state.previewing).catch(showError));
$("preview-edit").addEventListener("click", () => { closeSurface("preview"); openEditor(state.previewing); });
$("editor-form").addEventListener("submit", async event => {
  event.preventDefault(); const submit = event.submitter; submit.disabled = true; $("editor-status").textContent = "Saving…";
  const payload = { title: $("snippet-title").value, body: $("snippet-body").value };
  try {
    await api(state.editing ? `/snippets/${state.editing.id}` : "/snippets", { method: state.editing ? "PUT" : "POST", body: JSON.stringify(payload) });
    const data = await api("/snippets"); state.snippets = data.snippets; closeSurface("editor"); render();
  } catch (error) { $("editor-status").textContent = error.message; } finally { submit.disabled = false; }
});
$("delete").addEventListener("click", async () => {
  if (!state.editing || !confirm("Delete this snippet?")) return;
  try { await api(`/snippets/${state.editing.id}`, { method: "DELETE" }); state.snippets = state.snippets.filter(s => s.id !== state.editing.id); closeSurface("editor"); render(); }
  catch (error) { $("editor-status").textContent = error.message; }
});
$("sign-out").addEventListener("click", async () => { try { await api("/auth/logout", { method: "POST" }); } finally { location.replace("/"); } });
$("appearance").value = localStorage.getItem("linksaw-theme") || "system";
function applyTheme(value) { document.documentElement.dataset.theme = value === "system" ? "" : value; }
applyTheme($("appearance").value);
$("appearance").addEventListener("change", event => { localStorage.setItem("linksaw-theme", event.target.value); applyTheme(event.target.value); });
document.addEventListener("keydown", event => {
  const editing = !$("editor").hidden, previewing = !$("preview").hidden, settings = !$("settings-panel").hidden;
  if (event.key === "Escape") { if (editing) closeSurface("editor"); else if (previewing) closeSurface("preview"); else if (settings) closeSurface("settings-panel"); return; }
  if (editing || settings) return;
  if (previewing) return;
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); openEditor(); return; }
  const selected = state.filtered[state.selected];
  if (modifier && event.key.toLowerCase() === "e" && selected) { event.preventDefault(); openEditor(selected); return; }
  if (modifier && event.key.toLowerCase() === "c" && selected) { event.preventDefault(); copySnippet(selected).catch(showError); return; }
  if (modifier && /^[1-9]$/.test(event.key)) {
    const numbered = state.filtered[Number(event.key) - 1];
    if (numbered) { event.preventDefault(); setSelected(Number(event.key) - 1); useSnippet(numbered); }
    return;
  }
  if (event.key === "ArrowDown") { event.preventDefault(); setSelected(state.selected + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); setSelected(state.selected - 1); }
  else if (event.key === "ArrowRight" && selected) { event.preventDefault(); openPreview(selected); }
  else if (event.key === "Enter" && selected && document.activeElement === $("search")) { event.preventDefault(); useSnippet(selected); }
  else if (event.key === "/" && document.activeElement !== $("search")) { event.preventDefault(); $("search").focus(); }
});

load();
