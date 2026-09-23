// One shared tooltip handles both static controls and dynamically rendered rows.
// A manual popover stays above modal dialogs without taking keyboard focus.
const SHOW_DELAY_MS = 350;

export function setupTooltips() {
  const tooltip = document.createElement('div');
  tooltip.id = 'control-tooltip'; tooltip.className = 'app-tooltip';
  tooltip.setAttribute('role', 'tooltip'); tooltip.hidden = true;
  const popover = typeof tooltip.showPopover === 'function';
  if (popover) tooltip.setAttribute('popover', 'manual');
  document.body.append(tooltip);
  let timer = null, hovered = null, focused = null, described = null, keyboard = false;
  const selector = '[data-tooltip], button[title], button.bare, button.result-edit, button.icon-label';
  const controlFor = target => target instanceof Element ? target.closest(selector) : null;
  const labelFor = control => control.dataset.tooltip || control.getAttribute('aria-label') || control.textContent.trim();
  const usable = control => {
    const modal = document.querySelector('dialog[open]');
    return control?.isConnected && !control.disabled && !control.closest('[hidden]')
      && (!modal || modal.contains(control)) && control.getClientRects().length > 0;
  };
  const hide = () => {
    clearTimeout(timer); timer = null;
    tooltip.classList.remove('is-visible');
    if (described) {
      const ids = (described.getAttribute('aria-describedby') || '').split(/\s+/).filter(id => id && id !== tooltip.id);
      if (ids.length) described.setAttribute('aria-describedby', ids.join(' ')); else described.removeAttribute('aria-describedby');
      described = null;
    }
    if (popover && tooltip.matches(':popover-open')) tooltip.hidePopover();
    tooltip.hidden = true;
  };
  const place = control => {
    const box = control.getBoundingClientRect(), size = tooltip.getBoundingClientRect();
    const gap = 8, margin = 10;
    const left = Math.max(margin, Math.min(box.left + (box.width - size.width) / 2, window.innerWidth - size.width - margin));
    const below = box.bottom + gap;
    const top = below + size.height <= window.innerHeight - margin ? below : Math.max(margin, box.top - gap - size.height);
    tooltip.style.left = `${Math.round(left)}px`; tooltip.style.top = `${Math.round(top)}px`;
  };
  const show = control => {
    if (!usable(control)) return;
    const label = labelFor(control); if (!label) return;
    tooltip.replaceChildren(document.createTextNode(label));
    const shortcut = control.dataset.tooltipShortcut;
    if (shortcut) {
      const key = document.createElement('kbd');
      key.textContent = /^[A-Z0-9]$/.test(shortcut) ? `${navigator.platform.includes('Mac') ? '⌘' : 'Ctrl+'}${shortcut}` : shortcut;
      tooltip.append(key);
    }
    if (!popover) (control.closest('dialog[open]') || document.body).append(tooltip);
    tooltip.style.visibility = 'hidden'; tooltip.hidden = false;
    if (popover) tooltip.showPopover();
    place(control); tooltip.style.visibility = 'visible';
    // Force the concealed starting state to paint before the short entrance.
    tooltip.getBoundingClientRect();
    tooltip.classList.add('is-visible');
    const ids = new Set((control.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
    ids.add(tooltip.id); control.setAttribute('aria-describedby', [...ids].join(' ')); described = control;
  };
  const schedule = control => {
    hide();
    if (control) timer = setTimeout(() => { timer = null; show(control); }, SHOW_DELAY_MS);
  };
  // Remove native title bubbles so they do not compete with the styled tooltip.
  const adoptTitles = root => {
    if (!(root instanceof Element)) return;
    for (const control of [root, ...root.querySelectorAll('button[title], [data-tooltip][title]')]) {
      if (!control.matches('button[title], [data-tooltip][title]')) continue;
      if (!control.dataset.tooltip) control.dataset.tooltip = control.getAttribute('title');
      control.removeAttribute('title');
    }
  };
  adoptTitles(document.body);
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'childList') record.addedNodes.forEach(adoptTitles);
      else if (record.attributeName === 'title') adoptTitles(record.target);
    }
    if (described && !usable(described)) hide();
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['title', 'hidden', 'disabled'] });
  document.addEventListener('pointerover', event => {
    if (event.pointerType === 'touch') return;
    const control = controlFor(event.target);
    if (control === hovered) return;
    hovered = control; schedule(hovered || focused);
  });
  document.addEventListener('pointerout', event => {
    if (!hovered || hovered.contains(event.relatedTarget)) return;
    if (hovered.contains(event.target)) { hovered = null; schedule(focused); }
  });
  document.addEventListener('pointerdown', () => { keyboard = false; focused = null; hide(); }, true);
  document.addEventListener('keydown', event => { keyboard = true; if (event.key === 'Escape') hide(); }, true);
  document.addEventListener('focusin', event => {
    focused = keyboard ? controlFor(event.target) : null;
    schedule(focused || hovered);
  });
  document.addEventListener('focusout', () => { focused = null; schedule(hovered); });
  document.addEventListener('scroll', hide, true);
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', () => { hovered = focused = null; hide(); }));
  window.addEventListener('resize', hide);
  window.addEventListener('blur', () => { hovered = focused = null; hide(); });
}
