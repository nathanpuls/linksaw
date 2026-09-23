const API = "https://snippets-api.linksaw.com";
const icons = {
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
  settings: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49"/></svg>',
  edit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
  externalLink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
  panelClose: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18m7-12-3 3 3 3"/></svg>',
  panelOpen: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18m4 6 3 3-3 3"/></svg>',
  close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>',
};

const $ = id => document.getElementById(id);
const state = { snippets: [], filtered: [], selected: 0, editing: null, previewing: null, user: null };
let toastTimer;

function icon(id, name) { $(id).innerHTML = icons[name]; }
icon("add", "plus"); icon("settings", "settings"); icon("close-editor", "close");
icon("close-preview", "back"); icon("preview-edit", "edit"); icon("preview-copy", "copy"); icon("preview-share", "share"); icon("close-settings", "back");

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
async function copySnippet(snippet) {
  await navigator.clipboard.writeText(snippetText(snippet));
  showToast();
}
async function shareSnippet(snippet) {
  const share = await api(`/snippets/${snippet.id}/share`, { method: "POST" });
  snippet.share_token = share.token;
  if (navigator.share) {
    try { await navigator.share({ title: label(snippet), url: share.url }); return; }
    catch (error) { if (error?.name === "AbortError") return; }
  }
  await navigator.clipboard.writeText(share.url);
  showToast("Link copied");
}
function setSelected(index, scroll = true) {
  state.selected = Math.max(0, Math.min(index, Math.max(0, state.filtered.length - 1)));
  document.querySelectorAll(".result-row").forEach((row, i) => row.classList.toggle("selected", i === state.selected));
  if (scroll) document.querySelector(`.result-row[data-index="${state.selected}"]`)?.scrollIntoView({ block: "nearest" });
  renderViewer(state.filtered[state.selected] || null);
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
    results.append(empty); renderViewer(null); return;
  }
  state.filtered.forEach((snippet, index) => {
    const url = standaloneUrl(snippet);
    const row = document.createElement("article"); row.className = `result-row${url ? " has-url" : ""}${index === state.selected ? " selected" : ""}`; row.dataset.index = index;
    const main = document.createElement("button"); main.type = "button"; main.className = "result-main";
    const text = document.createElement("span"); text.className = "result-text";
    const title = document.createElement("div"); title.className = "result-title"; title.textContent = label(snippet);
    const preview = document.createElement("div"); preview.className = "result-preview"; preview.textContent = snippet.body.replace(/\s+/g, " ").trim();
    text.append(title);
    if (snippet.title.trim() && snippet.body.trim() && snippet.title.trim() !== snippet.body.trim()) text.append(preview);
    main.append(text); main.addEventListener("click", () => { setSelected(index); openPreview(snippet); });
    row.append(main);
    if (url) {
      const open = document.createElement("a"); open.className = "row-open icon-button"; open.href = url; open.target = "_blank"; open.rel = "noopener noreferrer";
      open.ariaLabel = `Open ${label(snippet)} website`; open.title = "Open website"; open.innerHTML = icons.externalLink;
      open.addEventListener("click", () => setSelected(index, false)); row.append(open);
    }
    results.append(row);
  });
  renderViewer(state.filtered[state.selected]);
}
function showError(error) { $("status").textContent = error.message || String(error); }
function showSurface(id) { $(id).hidden = false; document.body.style.overflow = "hidden"; }
function closeSurface(id) {
  $(id).hidden = true;
  if (!["editor", "settings-panel"].some(name => !$(name).hidden)) document.body.style.overflow = "";
  if ($("app").classList.contains("viewer-open")) $("close-preview").focus(); else $("search").focus();
}
function openEditor(snippet = null) {
  state.editing = snippet; $("snippet-title").value = snippet?.title || ""; $("snippet-body").value = snippet?.body || "";
  $("delete").hidden = !snippet; $("unshare").hidden = !snippet?.share_token; $("editor-status").textContent = ""; showSurface("editor");
  setTimeout(() => (snippet?.title ? $("snippet-body") : $("snippet-title")).focus(), 0);
}
function renderViewer(snippet) {
  state.previewing = snippet;
  $("viewer-empty").hidden = Boolean(snippet); $("viewer-content").hidden = !snippet;
  if (!snippet) {
    sessionStorage.setItem("linksaw-reader-mode", "false"); syncReaderMode(); return;
  }
  const heading = snippet.body.trim() && snippet.title.trim() !== snippet.body.trim() ? snippet.title.trim() : "";
  $("preview-title").textContent = heading; $("preview-title").hidden = !heading;
  renderLinkedText($("preview-body"), snippet.body || snippet.title);
  $("preview-open").hidden = !standaloneUrl(snippet);
}
function narrowLayout() { return matchMedia("(max-width: 900px)").matches; }
function syncReaderMode() {
  const enabled = sessionStorage.getItem("linksaw-reader-mode") === "true" && !narrowLayout();
  $("app").classList.toggle("reader-mode", enabled);
  $("reader-toggle").innerHTML = enabled ? icons.panelOpen : icons.panelClose;
  $("reader-toggle").ariaLabel = enabled ? "Show snippet list" : "Hide snippet list";
  $("reader-toggle").title = enabled ? "Show snippet list" : "Hide snippet list";
}
function openPreview(snippet, pushHistory = true) {
  if (!snippet) return;
  renderViewer(snippet);
  if (!narrowLayout()) return;
  const opening = !$("app").classList.contains("viewer-open");
  $("app").classList.add("viewer-open");
  if (opening && pushHistory) history.pushState({ ...(history.state || {}), linksawViewer: true }, "");
  setTimeout(() => $("close-preview").focus(), 0);
}
function closePreview(fromHistory = false) {
  if (!narrowLayout()) { $("search").focus(); return; }
  if (!fromHistory && history.state?.linksawViewer) { history.back(); return; }
  $("app").classList.remove("viewer-open"); $("search").focus();
}
async function load() {
  try {
    const [{ user }, { snippets }] = await Promise.all([api("/me"), api("/snippets")]);
    state.user = user; state.snippets = snippets; $("account").textContent = user.email; $("app").ariaBusy = "false"; render();
    const route = new URLSearchParams(location.search);
    if (location.pathname === "/app/new" || route.get("new") === "1") openEditor();
    else {
      const id = location.pathname.match(/^\/app\/s\/([a-f0-9-]{36})\/?$/)?.[1] || route.get("snippet");
      if (id) { const snippet = snippets.find(item => item.id === id); if (snippet) openPreview(snippet); else $("status").textContent = "Snippet not found"; }
    }
  } catch (error) { showError(error); }
}

$("search").addEventListener("input", () => { state.selected = 0; render(); });
$("add").addEventListener("click", () => openEditor());
$("settings").addEventListener("click", () => showSurface("settings-panel"));
$("close-editor").addEventListener("click", () => closeSurface("editor"));
$("close-preview").addEventListener("click", () => closePreview());
$("close-settings").addEventListener("click", () => closeSurface("settings-panel"));
$("preview-copy").addEventListener("click", () => copySnippet(state.previewing).catch(showError));
$("preview-share").addEventListener("click", () => shareSnippet(state.previewing).catch(showError));
$("preview-edit").addEventListener("click", () => openEditor(state.previewing));
$("preview-open").addEventListener("click", () => {
  const url = standaloneUrl(state.previewing); if (url) window.open(url, "_blank", "noopener,noreferrer");
});
$("reader-toggle").addEventListener("click", () => {
  sessionStorage.setItem("linksaw-reader-mode", String(!$("app").classList.contains("reader-mode"))); syncReaderMode();
});
$("editor-form").addEventListener("submit", async event => {
  event.preventDefault(); const submit = event.submitter; submit.disabled = true; $("editor-status").textContent = "Saving…";
  const payload = { title: $("snippet-title").value, body: $("snippet-body").value };
  try {
    const saved = await api(state.editing ? `/snippets/${state.editing.id}` : "/snippets", { method: state.editing ? "PUT" : "POST", body: JSON.stringify(payload) });
    const savedId = state.editing?.id || saved.id;
    const data = await api("/snippets"); state.snippets = data.snippets; state.selected = Math.max(0, data.snippets.findIndex(snippet => snippet.id === savedId)); closeSurface("editor"); render();
  } catch (error) { $("editor-status").textContent = error.message; } finally { submit.disabled = false; }
});
$("delete").addEventListener("click", async () => {
  if (!state.editing || !confirm("Delete this snippet?")) return;
  try { await api(`/snippets/${state.editing.id}`, { method: "DELETE" }); state.snippets = state.snippets.filter(s => s.id !== state.editing.id); closeSurface("editor"); render(); }
  catch (error) { $("editor-status").textContent = error.message; }
});
$("unshare").addEventListener("click", async () => {
  if (!state.editing?.share_token || !confirm("Stop sharing this snippet? The current link will no longer work.")) return;
  try {
    await api(`/snippets/${state.editing.id}/share`, { method: "DELETE" });
    state.editing.share_token = null; $("unshare").hidden = true; $("editor-status").textContent = "Sharing stopped.";
  } catch (error) { $("editor-status").textContent = error.message; }
});
$("sign-out").addEventListener("click", async () => { try { await api("/auth/logout", { method: "POST" }); } finally { location.replace("/"); } });
$("appearance").value = localStorage.getItem("linksaw-theme") || "system";
function applyTheme(value) { document.documentElement.dataset.theme = value === "system" ? "" : value; }
applyTheme($("appearance").value);
syncReaderMode();
matchMedia("(max-width: 900px)").addEventListener("change", syncReaderMode);
$("appearance").addEventListener("change", event => { localStorage.setItem("linksaw-theme", event.target.value); applyTheme(event.target.value); });
addEventListener("popstate", () => closePreview(true));
document.addEventListener("keydown", event => {
  const editing = !$("editor").hidden, settings = !$("settings-panel").hidden, viewerOpen = narrowLayout() && $("app").classList.contains("viewer-open");
  if (event.key === "Escape") { if (editing) closeSurface("editor"); else if (settings) closeSurface("settings-panel"); else if (viewerOpen) closePreview(); return; }
  if (editing || settings) return;
  const modifier = event.metaKey || event.ctrlKey;
  if (modifier && event.key.toLowerCase() === "n") { event.preventDefault(); openEditor(); return; }
  const selected = state.filtered[state.selected];
  if (modifier && event.key.toLowerCase() === "e" && selected) { event.preventDefault(); openEditor(selected); return; }
  if (modifier && event.key.toLowerCase() === "c" && selected) { event.preventDefault(); copySnippet(selected).catch(showError); return; }
  if (modifier && event.key === "Enter" && selected) {
    const url = standaloneUrl(selected); if (url) { event.preventDefault(); window.open(url, "_blank", "noopener,noreferrer"); }
    return;
  }
  if (modifier && /^[1-9]$/.test(event.key)) {
    const numbered = state.filtered[Number(event.key) - 1];
    if (numbered) { event.preventDefault(); setSelected(Number(event.key) - 1); }
    return;
  }
  if (event.key === "ArrowDown") { event.preventDefault(); setSelected(state.selected + 1); }
  else if (event.key === "ArrowUp") { event.preventDefault(); setSelected(state.selected - 1); }
  else if (event.key === "ArrowRight" && selected) { event.preventDefault(); openPreview(selected); }
  else if (event.key === "Enter" && selected && document.activeElement === $("search")) { event.preventDefault(); openPreview(selected); }
  else if (event.key === "/" && document.activeElement !== $("search")) { event.preventDefault(); $("search").focus(); }
});

load();
