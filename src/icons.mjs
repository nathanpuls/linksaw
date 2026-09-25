import { createElement, ArrowLeft, ChevronRight, Plus, X, Settings, Pencil, Trash2, LogOut, Copy, Eye, Ellipsis, Share2, Undo2, Redo2 } from 'lucide';

const icons = { back: ArrowLeft, forward: ChevronRight, plus: Plus, close: X, settings: Settings, edit: Pencil, trash: Trash2, logout: LogOut, copy: Copy, preview: Eye, more: Ellipsis, share: Share2, undo: Undo2, redo: Redo2 };

export function icon(name, size = 20) {
  return createElement(icons[name], { width: size, height: size, 'stroke-width': 1.75, 'aria-hidden': 'true', focusable: 'false', class: 'app-icon' });
}

export function setupIcons() {
  for (const [id, name] of Object.entries({ back: 'back', 'clear-search': 'close', add: 'plus', settings: 'settings', 'editor-undo': 'undo', 'editor-redo': 'redo', 'cancel-editor': 'close', 'close-settings': 'back', 'delete-snippet': 'trash', 'preview-copy': 'copy', 'preview-share': 'share', 'preview-edit': 'edit', 'preview-more': 'more', 'preview-delete': 'trash' })) {
    document.getElementById(id).replaceChildren(icon(name));
  }
  for (const [id, name] of Object.entries({ 'confirm-delete': 'trash', 'sign-out': 'logout', 'settings-permission': 'settings', 'open-paste-settings': 'settings' })) {
    const button = document.getElementById(id);
    button.classList.add('icon-label');
    button.prepend(icon(name, 16));
  }
}
