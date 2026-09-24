const API = 'https://snippets-api.linksaw.com';
let cache = null;
let cacheTime = 0;
let pending = null;

async function api(path) {
  const response = await fetch(API + path, { credentials: 'include' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || `Request failed (${response.status})`);
  return data;
}

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
