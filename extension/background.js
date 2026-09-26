const API = 'https://snippets-api.linksaw.com';
let cache = null;
let cacheTime = 0;
let pending = null;
let badgeTimer = null;

const contextMenus = [
  { id: 'linksaw-save-selection', title: 'Save selection to Linksaw', contexts: ['selection'] },
  { id: 'linksaw-save-page', title: 'Save page to Linksaw', contexts: ['page'] },
  { id: 'linksaw-save-link', title: 'Save link to Linksaw', contexts: ['link'] },
];

async function api(path, options = {}) {
  const response = await fetch(API + path, { credentials: 'include', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}

function showBadge(text, title) {
  clearTimeout(badgeTimer);
  chrome.action.setBadgeBackgroundColor({ color: text === '✓' ? '#676767' : '#171717' });
  chrome.action.setBadgeText({ text });
  chrome.action.setTitle({ title });
  badgeTimer = setTimeout(() => {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: 'Linksaw' });
  }, 2400);
}

function registerContextMenus() {
  chrome.contextMenus.removeAll(() => {
    for (const item of contextMenus) chrome.contextMenus.create(item);
  });
}

function httpUrl(value) {
  try {
    const url = new URL(value || '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function contextSnippet(info, tab) {
  if (info.menuItemId === 'linksaw-save-selection') {
    return { title: '', body: info.selectionText || '' };
  }
  if (info.menuItemId === 'linksaw-save-link') {
    return { title: '', body: httpUrl(info.linkUrl) };
  }
  if (info.menuItemId === 'linksaw-save-page') {
    return { title: (tab?.title || '').trim().slice(0, 160), body: httpUrl(info.pageUrl || tab?.url) };
  }
  return null;
}

async function saveFromContextMenu(info, tab) {
  const snippet = contextSnippet(info, tab);
  if (!snippet || (!snippet.title.trim() && !snippet.body.trim())) throw Error('Nothing to save');
  await api('/snippets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(snippet),
  });
  cache = null;
  cacheTime = 0;
  showBadge('✓', 'Saved to Linksaw');
}

chrome.runtime.onInstalled.addListener(registerContextMenus);
chrome.runtime.onStartup.addListener(registerContextMenus);
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!String(info.menuItemId).startsWith('linksaw-save-')) return;
  saveFromContextMenu(info, tab).catch(error => showBadge('!', error.message || 'Couldn’t save to Linksaw'));
});

chrome.commands.onCommand.addListener(async command => {
  if (command !== 'open-autocomplete') return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'LINKSAW_OPEN_AUTOCOMPLETE' })
    .then(response => { if (!response?.ok) showBadge('!', response?.error || 'Select a text field first'); })
    .catch(() => showBadge('!', 'Select a text field first'));
});

async function linksawData(force = false) {
  if (!force && cache && Date.now() - cacheTime < 30000) return cache;
  if (!pending) {
    pending = Promise.all([api('/snippets'), api('/preferences')])
      .then(([snippetData, preferences]) => {
        cache = { snippets: snippetData.snippets || [], autocompleteTrigger: preferences.autocompleteTrigger || ';' };
        cacheTime = Date.now();
        return cache;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'LINKSAW_OPEN_URL') {
    let destination;
    try { destination = new URL(message.url || ''); }
    catch { sendResponse({ ok: false, error: 'Invalid URL' }); return; }
    if (!['http:', 'https:'].includes(destination.protocol)) {
      sendResponse({ ok: false, error: 'Not allowed' });
      return;
    }
    chrome.tabs.create({ url: destination.href, active: true })
      .then(tab => sendResponse({ ok: true, tabId: tab.id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'LINKSAW_OPEN_SNIPPET') {
    if (!/^[a-f0-9-]{36}$/i.test(message.id || '')) {
      sendResponse({ ok: false, error: 'Invalid snippet' });
      return;
    }
    chrome.tabs.create({ url: `https://linksaw.com/home/?snippet=${message.id}`, active: true })
      .then(tab => sendResponse({ ok: true, tabId: tab.id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === 'LINKSAW_OPEN_ACTIVE_TAB') {
    let source;
    let destination;
    try {
      source = new URL(sender.url || '');
      destination = new URL(message.url || '');
    } catch {
      sendResponse({ ok: false, error: 'Invalid URL' });
      return;
    }
    if (source.hostname !== 'linksaw.com' || !['http:', 'https:'].includes(destination.protocol)) {
      sendResponse({ ok: false, error: 'Not allowed' });
      return;
    }
    chrome.tabs.create({ url: destination.href, active: true })
      .then(tab => sendResponse({ ok: true, tabId: tab.id }))
      .catch(error => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type !== 'LINKSAW_DATA') return;
  linksawData(Boolean(message.force))
    .then(data => sendResponse({ ok: true, ...data }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
