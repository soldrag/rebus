// Установка на главный экран: на Android — системное окно,
// на iPhone/iPad — подсказка (Safari не умеет показывать окно сам).
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((fn) => fn());

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

// Кнопка показывается, только если установка реально доступна.
export function canInstall() {
  if (isStandalone()) return false;
  return !!deferred || isIOS();
}

// 'ios' — нужно показать подсказку, 'prompted' — показали системное окно.
export async function install() {
  if (!deferred) return isIOS() ? 'ios' : 'unavailable';
  const e = deferred;
  deferred = null; // окно можно показать только один раз
  try {
    await e.prompt();
    await e.userChoice;
  } catch { /* ignore */ }
  notify();
  return 'prompted';
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
