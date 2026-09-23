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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'LINKSAW_DATA') return;
  linksawData(Boolean(message.force))
    .then(data => sendResponse({ ok: true, ...data }))
    .catch(error => sendResponse({ ok: false, error: error.message }));
  return true;
});
