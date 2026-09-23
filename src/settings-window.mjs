import { getCurrentWindow, currentMonitor, PhysicalSize, PhysicalPosition } from '@tauri-apps/api/window';

// Keep window changes in order when Settings is closed while resizing, or opened
// again quickly. The launcher's actual size and position are saved per visit.
export function setupSettingsWindow({ dialog, native, onError }) {
  let saved = null, pending = Promise.resolve();
  const enqueue = action => {
    pending = pending.then(action).catch(onError);
    return pending;
  };
  const enter = () => enqueue(async () => {
    if (!native || !dialog.open) return;
    const window = getCurrentWindow();
    if (!saved) {
      const [size, position] = await Promise.all([window.outerSize(), window.outerPosition()]);
      saved = { size, position };
    }
    const monitor = await currentMonitor();
    if (!monitor || !dialog.open) return;
    const scale = monitor.scaleFactor, area = monitor.workArea;
    const margin = Math.round(16 * scale);
    const width = Math.round(Math.min(Math.max(saved.size.width, 960 * scale), area.size.width - margin * 2));
    const height = Math.round(Math.min(Math.max(saved.size.height, 700 * scale), area.size.height - margin * 2));
    const x = Math.round(Math.max(area.position.x + margin, Math.min(saved.position.x + (saved.size.width - width) / 2, area.position.x + area.size.width - margin - width)));
    const y = Math.round(Math.max(area.position.y + margin, Math.min(saved.position.y + (saved.size.height - height) / 2, area.position.y + area.size.height - margin - height)));
    await window.setSize(new PhysicalSize(width, height));
    await window.setPosition(new PhysicalPosition(x, y));
  });
  dialog.addEventListener('close', () => { void enqueue(async () => {
    if (!native || !saved) return;
    const window = getCurrentWindow();
    await window.setSize(saved.size);
    await window.setPosition(saved.position);
    saved = null;
  }); });
  return { enter };
}
