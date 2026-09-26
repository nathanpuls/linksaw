(() => {
  if (window.top !== window || window.__linksawAutocomplete) return;
  window.__linksawAutocomplete = true;

  if (location.hostname === 'linksaw.com') {
    const markBridgeReady = () => {
      if (!document.documentElement) return false;
      document.documentElement.dataset.linksawExtension = 'ready';
      return true;
    };
    if (!markBridgeReady()) {
      const observer = new MutationObserver(() => {
        if (markBridgeReady()) observer.disconnect();
      });
      observer.observe(document, { childList: true, subtree: true });
    }
    window.addEventListener('LINKSAW_OPEN_ACTIVE_TAB', event => {
      if (typeof event.detail !== 'string') return;
      chrome.runtime.sendMessage({ type: 'LINKSAW_OPEN_ACTIVE_TAB', url: event.detail }).catch(() => {});
    });
  }

  let data = { snippets: [], autocompleteTrigger: ';' };
  let loadedAt = 0;
  let host = null;
  let search = null;
  let clearSearch = null;
  let results = null;
  let status = null;
  let loading = false;
  let selected = 0;
  let target = null;
  let inputSelection = null;
  let editableRange = null;

  const label = snippet => snippet.title?.trim() || snippet.body?.trim().split(/\r?\n/, 1)[0].slice(0, 80) || 'Untitled';
  const content = snippet => snippet.body || '';
  function urlFor(text) {
    const value = text.trim();
    if (/^https?:\/\/[^\s]+$/i.test(value)) return value;
    if (/^(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?$/i.test(value)) return `https://${value}`;
    return '';
  }

  function editable(element) {
    if (!element || element.disabled || element.readOnly) return null;
    if (element instanceof HTMLTextAreaElement) return element;
    if (element instanceof HTMLInputElement && /^(text|search|url|email|tel|password)$/.test(element.type)) return element;
    return element.isContentEditable && element.getAttribute('contenteditable') !== 'false' ? element : null;
  }

  function beforeCaret(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return element.value.slice(0, element.selectionStart ?? 0).slice(-1);
    }
    const selection = getSelection();
    if (!selection?.rangeCount || !element.contains(selection.anchorNode)) return '';
    const range = selection.getRangeAt(0).cloneRange();
    range.selectNodeContents(element); range.setEnd(selection.anchorNode, selection.anchorOffset);
    return range.toString().slice(-1);
  }

  function atBoundary(element) {
    const previous = beforeCaret(element);
    return !previous || /\s/.test(previous);
  }

  async function refresh(force = false) {
    if (!force && Date.now() - loadedAt < 30000 && data.snippets.length) return data;
    const response = await chrome.runtime.sendMessage({ type: 'LINKSAW_DATA', force });
    if (!response?.ok) throw Error(response?.error || 'Could not load Linksaw');
    data = response; loadedAt = Date.now(); return data;
  }

  function found() {
    const query = search.value.trim().toLowerCase();
    return data.snippets.map((item, order) => {
      const name = label(item).toLowerCase();
      const rank = !query ? 0 : name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : (item.body || '').toLowerCase().includes(query) ? 3 : 99;
      return { item, order, rank };
    }).filter(result => result.rank < 99).sort((a, b) => a.rank - b.rank || a.order - b.order).map(result => result.item);
  }

  function render() {
    if (!search || !results) return;
    clearSearch.hidden = !search.value;
    const snippets = found(); selected = Math.min(selected, Math.max(0, snippets.length - 1)); results.replaceChildren();
    if (!snippets.length) {
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = loading ? 'Loading…' : data.snippets.length ? 'No matches' : 'No snippets yet'; results.append(empty); return;
    }
    snippets.slice(0, 9).forEach((snippet, index) => {
      const row = document.createElement('div'); row.className = `row${index === selected ? ' selected' : ''}`;
      const button = document.createElement('button'); button.type = 'button'; button.className = 'primary';
      const title = document.createElement('span'); title.className = 'title'; title.textContent = label(snippet); button.append(title);
      if (snippet.title?.trim() && snippet.body?.trim()) {
        const preview = document.createElement('span'); preview.className = 'preview'; preview.textContent = snippet.body.replace(/\s+/g, ' ').trim(); button.append(preview);
      }
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('pointerenter', () => {
        if (selected === index) return;
        results.querySelector('.selected')?.classList.remove('selected');
        selected = index;
        row.classList.add('selected');
      });
      button.setAttribute('aria-label', urlFor(content(snippet)) ? `Open ${label(snippet)} website` : `Paste ${label(snippet)}`);
      button.addEventListener('click', () => choose(snippet));
      const viewButton = document.createElement('button'); viewButton.type = 'button'; viewButton.className = 'view'; viewButton.setAttribute('aria-label', 'View details'); viewButton.title = 'View details'; viewButton.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>';
      viewButton.addEventListener('click', event => { event.stopPropagation(); openInLinksaw(snippet); });
      row.append(button, viewButton); results.append(row);
    });
    results.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
  }

  function captureTarget(element) {
    target = element; inputSelection = null; editableRange = null;
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) inputSelection = [element.selectionStart, element.selectionEnd];
    else {
      const selection = getSelection();
      if (selection?.rangeCount && element.contains(selection.anchorNode)) editableRange = selection.getRangeAt(0).cloneRange();
    }
  }

  function insert(text, cursorLeft = 0) {
    if (!target?.isConnected) return false;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const [start, end] = inputSelection || [target.value.length, target.value.length];
      target.focus(); target.setRangeText(text, start ?? 0, end ?? start ?? 0, 'end');
      const point = (start ?? 0) + [...text].slice(0, Math.max(0, [...text].length - cursorLeft)).join('').length;
      target.setSelectionRange(point, point);
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); return true;
    }
    if (target.isContentEditable && editableRange) {
      target.focus(); editableRange.deleteContents(); const node = document.createTextNode(text); editableRange.insertNode(node);
      const point = [...text].slice(0, Math.max(0, [...text].length - cursorLeft)).join('').length;
      editableRange.setStart(node, point); editableRange.collapse(true); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(editableRange);
      target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })); return true;
    }
    return false;
  }

  function close() { host?.remove(); host = search = clearSearch = results = status = null; loading = false; target?.focus(); }
  function choose(snippet) {
    const expanded = LinksawDynamic.expandDynamic(content(snippet));
    const url = urlFor(expanded.text);
    close();
    if (url) { chrome.runtime.sendMessage({ type: 'LINKSAW_OPEN_URL', url }).catch(() => {}); return; }
    insert(expanded.text, expanded.cursorLeft);
  }
  function openInLinksaw(snippet) { close(); chrome.runtime.sendMessage({ type: 'LINKSAW_OPEN_SNIPPET', id: snippet.id }).catch(() => {}); }

  function open(element) {
    captureTarget(element); selected = 0;
    host = document.createElement('div'); host.id = 'linksaw-autocomplete-root'; const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `<style>:host{all:initial}.backdrop{position:fixed;inset:0;z-index:2147483647;background:#0002;display:grid;place-items:start center;padding:14vh 20px 40px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717}.panel{width:min(680px,calc(100vw - 40px));max-height:min(620px,72vh);display:flex;flex-direction:column;overflow:hidden;border:1px solid #d8d8dc;border-radius:14px;background:#fff;box-shadow:0 22px 70px #0004}.search-wrap{min-height:70px;display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;border-bottom:1px solid #e5e5e7;padding:0 10px 0 12px}.search{min-width:0;width:100%;border:0;outline:0;padding:18px 0;background:transparent;color:#171717;font:inherit;font-size:28px;letter-spacing:-.035em}.search::-webkit-search-cancel-button{-webkit-appearance:none;appearance:none;display:none}.search-icon,.clear{width:40px;height:40px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#777}.search-icon{cursor:text}.clear{cursor:pointer}.clear:hover,.clear:focus-visible{background:#f1f1f2;color:#171717;outline:0}.clear[hidden]{display:none}.search-icon svg,.clear svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.results{overflow:auto;padding:7px}.row{width:100%;min-height:58px;display:flex;align-items:center;border-radius:10px;padding:4px 6px 4px 12px;background:transparent;color:inherit;font:inherit}.row:hover,.row.selected{background:#f1f1f2}.primary{min-width:0;flex:1;border:0;padding:5px 0;background:transparent;color:inherit;text-align:left;font:inherit;cursor:pointer}.view{width:40px;height:40px;flex:0 0 40px;display:grid;place-items:center;border:0;border-radius:8px;background:transparent;color:#777;opacity:0;cursor:pointer}.row:hover .view,.row.selected .view,.view:focus-visible{opacity:1}.view svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.title,.preview{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.title{font-size:14px;font-weight:650}.preview{margin-top:4px;color:#777;font-size:12px}.empty{padding:44px 18px;text-align:center;color:#777;font-size:13px}.status{padding:0 22px 14px;color:#777;font-size:12px}.status:empty{display:none}@media(prefers-color-scheme:dark){.panel{border-color:#454549;background:#242426;color:#f5f5f5}.search-wrap{border-color:#414145}.search{color:#f5f5f5}.row:hover,.row.selected,.clear:hover,.clear:focus-visible{background:#39393c}.preview,.status,.empty,.view,.search-icon,.clear{color:#aaa}.clear:hover,.clear:focus-visible{color:#f5f5f5}}</style><div class="backdrop"><section class="panel" role="dialog" aria-modal="true" aria-label="Linksaw autocomplete"><div class="search-wrap"><button class="search-icon" type="button" tabindex="-1" aria-label="Focus search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path></svg></button><input class="search" type="search" placeholder="Search" autocomplete="off" aria-label="Search snippets"><button class="clear" type="button" aria-label="Clear search" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"></path></svg></button></div><div class="results" role="listbox" aria-label="Recent snippets"></div><div class="status" role="status" aria-live="polite"></div></section></div>`;
    search = root.querySelector('.search'); clearSearch = root.querySelector('.clear'); results = root.querySelector('.results'); status = root.querySelector('.status');
    root.querySelector('.backdrop').addEventListener('pointerdown', event => { if (event.target.classList.contains('backdrop')) close(); });
    root.querySelector('.search-icon').addEventListener('click', () => search.focus());
    clearSearch.addEventListener('click', () => { search.value = ''; selected = 0; render(); search.focus(); });
    search.addEventListener('input', () => { selected = 0; render(); });
    search.addEventListener('keydown', event => {
      const snippets = found().slice(0, 9);
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); selected = Math.max(0, Math.min(snippets.length - 1, selected + (event.key === 'ArrowDown' ? 1 : -1))); render(); }
      else if (event.key === 'Enter' && snippets[selected]) { event.preventDefault(); choose(snippets[selected]); }
      else if (event.key === 'ArrowRight' && snippets[selected]) { event.preventDefault(); openInLinksaw(snippets[selected]); }
    });
    document.documentElement.append(host);
    const openingHost = host;
    loading = !data.snippets.length;
    render(); search.focus();
    refresh(true).then(() => {
      if (host !== openingHost) return;
      loading = false; status.textContent = ''; render();
    }).catch(error => {
      if (host !== openingHost) return;
      loading = false; results.replaceChildren();
      const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Couldn’t load snippets'; results.append(empty);
      status.textContent = error.message;
    });
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== 'LINKSAW_OPEN_AUTOCOMPLETE') return;
    if (host) {
      search?.focus();
      sendResponse({ ok: true });
      return;
    }
    const element = editable(document.activeElement);
    if (!element) {
      sendResponse({ ok: false, error: 'Select a text field first' });
      return;
    }
    open(element);
    sendResponse({ ok: true });
  });

  document.addEventListener('keydown', event => {
    if (host || event.defaultPrevented || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
    const element = editable(event.target);
    if (!element || event.key !== data.autocompleteTrigger || !atBoundary(element)) return;
    event.preventDefault(); event.stopImmediatePropagation(); open(element);
  }, true);

  refresh().catch(() => {});
  addEventListener('focus', () => refresh().catch(() => {}));
})();
