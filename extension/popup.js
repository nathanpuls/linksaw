const API = 'https://snippets-api.linksaw.com';
const $ = id => document.getElementById(id);
const svg = paths => `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
const icons = { plus: svg('<path d="M5 12h14M12 5v14"/>'), copy: svg('<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>'), open: svg('<path d="M15 3h6v6M10 14 21 3"/><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>') };
$('new').innerHTML = icons.plus;
let snippets = [], selected = 0, tabId, tooltipTimer, tooltipTarget;
const status = message => { $('status').textContent = message; };
function hideTooltip() { clearTimeout(tooltipTimer); tooltipTarget = null; $('linksaw-tooltip').hidden = true; }
function showTooltip(target) {
  if (!target?.dataset.tooltip) return;
  tooltipTarget = target;
  tooltipTimer = setTimeout(() => {
    if (tooltipTarget !== target || (!target.matches(':hover') && document.activeElement !== target)) return;
    const tooltip = $('linksaw-tooltip'); tooltip.textContent = target.dataset.tooltip; tooltip.hidden = false;
    const rect = target.getBoundingClientRect(), tip = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(6, Math.min(innerWidth - tip.width - 6, rect.left + rect.width / 2 - tip.width / 2))}px`;
    tooltip.style.top = `${rect.bottom + 7 + tip.height <= innerHeight - 6 ? rect.bottom + 7 : rect.top - tip.height - 7}px`;
  }, 450);
}
document.addEventListener('pointerover', event => { const target = event.target.closest?.('[data-tooltip]'); if (target && !target.contains(event.relatedTarget)) showTooltip(target); });
document.addEventListener('pointerout', event => { const target = event.target.closest?.('[data-tooltip]'); if (!target || target.contains(event.relatedTarget)) return; queueMicrotask(() => { if (!target.matches(':hover') && document.activeElement !== target) hideTooltip(); }); });
document.addEventListener('focusin', event => showTooltip(event.target.closest?.('[data-tooltip]')));
document.addEventListener('focusout', event => { const target = event.target.closest?.('[data-tooltip]'); queueMicrotask(() => { if (target && !target.matches(':hover') && document.activeElement !== target) hideTooltip(); }); });
document.addEventListener('click', hideTooltip);
addEventListener('scroll', hideTooltip, true);
const content = snippet => snippet.body || snippet.title;
const label = snippet => snippet.title.trim() || snippet.body.trim().split(/\r?\n/, 1)[0].slice(0, 80) || 'Untitled';
function urlFor(text) { const value = text.trim(); if (/^https?:\/\/[^\s]+$/i.test(value)) return value; if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(value)) return `https://${value}`; return ''; }
function filtered() { const q = $('search').value.trim().toLowerCase(); return snippets.map((item, order) => ({ item, order, rank: !q ? 0 : label(item).toLowerCase() === q ? 0 : label(item).toLowerCase().startsWith(q) ? 1 : label(item).toLowerCase().includes(q) ? 2 : item.body.toLowerCase().includes(q) ? 3 : 99 })).filter(x => x.rank < 99).sort((a,b) => a.rank - b.rank || a.order - b.order).map(x => x.item); }
async function api(path) {
  const response = await fetch(API + path, { credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}
async function copy(text, message = 'Copied') { await navigator.clipboard.writeText(text); status(message); }
async function use(snippet) {
  const expanded = LinksawDynamic.expandDynamic(content(snippet));
  const text = expanded.text, url = urlFor(text);
  if (url) { await chrome.tabs.create({ url }); return; }
  try {
    if (!tabId) throw Error('No active tab');
    const [result] = await chrome.scripting.executeScript({ target: { tabId }, func: insert, args: [text, expanded.cursorLeft] });
    if (result?.result) { window.close(); return; }
  } catch { /* Restricted page: copy fallback. */ }
  await copy(text, 'Copied—paste manually');
}
function insert(text, cursorLeft = 0) {
  let target = document.activeElement;
  while (target?.shadowRoot?.activeElement) target = target.shadowRoot.activeElement;
  if (!target || target.disabled || target.readOnly) return false;
  if (target instanceof HTMLTextAreaElement || (target instanceof HTMLInputElement && /^(text|search|url|email|tel|password)$/.test(target.type))) {
    const start = target.selectionStart, end = target.selectionEnd;
    if (start === null || end === null) return false;
    target.focus(); target.setRangeText(text, start, end, 'end');
    const point = start + [...text].slice(0, Math.max(0, [...text].length - cursorLeft)).join('').length;
    target.setSelectionRange(point, point);
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }
  if (target.isContentEditable && target.getAttribute('contenteditable') !== 'false') {
    const selection = window.getSelection();
    if (!selection?.rangeCount || !target.contains(selection.anchorNode)) return false;
    target.focus(); const range = selection.getRangeAt(0); range.deleteContents();
    const node = document.createTextNode(text); range.insertNode(node);
    const point = [...text].slice(0, Math.max(0, [...text].length - cursorLeft)).join('').length;
    range.setStart(node, point); range.collapse(true);
    selection.removeAllRanges(); selection.addRange(range);
    target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    return true;
  }
  return false;
}
function render() {
  const found = filtered(); selected = Math.min(selected, Math.max(0, found.length - 1)); $('results').replaceChildren();
  if (!found.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = snippets.length ? 'No matching snippets' : 'No snippets yet'; $('results').append(empty); return; }
  found.forEach((snippet, index) => {
    const row = document.createElement('div'); row.className = `row${index === selected ? ' selected' : ''}`;
    const main = document.createElement('button'); main.className = 'primary'; main.type = 'button';
    const title = document.createElement('span'); title.className = 'title'; title.textContent = label(snippet); main.append(title);
    if (snippet.title.trim() && snippet.body.trim()) { const preview = document.createElement('span'); preview.className = 'preview'; preview.textContent = snippet.body.replace(/\s+/g, ' ').trim(); main.append(preview); }
    main.addEventListener('click', () => use(snippet).catch(error => status(error.message)));
    const copyButton = document.createElement('button'); copyButton.className = 'action'; copyButton.type = 'button'; copyButton.dataset.tooltip = 'Copy snippet'; copyButton.ariaLabel = `Copy ${label(snippet)}`; copyButton.innerHTML = icons.copy; copyButton.addEventListener('click', () => copy(content(snippet)).catch(error => status(error.message)));
    const open = document.createElement('button'); open.className = 'action'; open.type = 'button'; open.dataset.tooltip = 'Open in Linksaw'; open.ariaLabel = `Open ${label(snippet)} in Linksaw`; open.innerHTML = icons.open; open.addEventListener('click', () => chrome.tabs.create({ url: `https://linksaw.com/app/s/${snippet.id}` }));
    row.append(main, copyButton, open); $('results').append(row);
  });
}
async function refresh() {
  try { status(''); snippets = (await api('/snippets')).snippets; $('login').hidden = true; render(); }
  catch (error) { $('login').hidden = false; status(error.message === 'Sign in required' ? 'Sign in on the Linksaw website, then reopen this popup' : error.message); }
}
$('login').addEventListener('click', () => chrome.tabs.create({ url: 'https://linksaw.com/login' }));
$('new').addEventListener('click', () => chrome.tabs.create({ url: 'https://linksaw.com/app/new' }));
$('search').addEventListener('input', () => { selected = 0; render(); });
$('search').addEventListener('keydown', event => {
  const found = filtered();
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, Math.min(found.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1))); render(); }
  if (event.key === 'Enter' && found[selected]) { event.preventDefault(); use(found[selected]).catch(error => status(error.message)); }
});
const [active] = await chrome.tabs.query({ active: true, currentWindow: true }); tabId = active?.id;
await refresh();
$('search').focus();
