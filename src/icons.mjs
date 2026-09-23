import { createElement, ArrowLeft, Plus, X, Settings, Pencil, Trash2, Upload, LogOut, Copy, Eye } from 'lucide';

const icons = { back: ArrowLeft, plus: Plus, close: X, settings: Settings, edit: Pencil, trash: Trash2, import: Upload, logout: LogOut, copy: Copy, preview: Eye };

export function icon(name, size = 20) {
  return createElement(icons[name], { width: size, height: size, 'stroke-width': 1.75, 'aria-hidden': 'true', focusable: 'false', class: 'app-icon' });
}

export function setupIcons() {
  for (const [id, name] of Object.entries({ back: 'back', 'clear-search': 'close', add: 'plus', settings: 'settings', 'cancel-editor': 'close', 'close-settings': 'back', 'delete-snippet': 'trash', 'preview-edit': 'edit', 'preview-copy': 'copy' })) {
    document.getElementById(id).replaceChildren(icon(name));
  }
  for (const [id, name] of Object.entries({ 'confirm-delete': 'trash', 'open-import': 'import', 'sign-out': 'logout', 'settings-permission': 'settings', 'open-paste-settings': 'settings' })) {
    const button = document.getElementById(id);
    button.classList.add('icon-label');
    button.prepend(icon(name, 16));
  }
}
