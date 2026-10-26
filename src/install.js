// Установка на главный экран: на Android — системное окно,
// на iPhone/iPad — подсказка (Safari не умеет показывать окно сам).
let deferred = null;
const listeners = new Set();

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferred = e;
  listeners.forEach((fn) => fn());
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  listeners.forEach((fn) => fn());
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

export async function install() {
  if (!deferred) return 'ios';
  const e = deferred;
  deferred = null;
  await e.prompt();
  return 'prompted';
}

export function onInstallChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
