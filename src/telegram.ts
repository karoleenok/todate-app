/* Связка с Telegram Mini Apps. Вне Telegram (обычный браузер) всё это молча ничего не делает. */

interface Inset { top: number; bottom: number; left: number; right: number }
interface TgWebApp {
  platform: string;
  initData: string;
  version: string;
  isVersionAtLeast: (v: string) => boolean;
  ready: () => void;
  expand: () => void;
  isExpanded?: boolean;
  isFullscreen?: boolean;
  disableVerticalSwipes?: () => void;
  requestFullscreen?: () => void;
  setHeaderColor?: (c: string) => void;
  setBackgroundColor?: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  safeAreaInset?: Inset;
  contentSafeAreaInset?: Inset;
  onEvent: (e: string, cb: () => void) => void;
  offEvent: (e: string, cb: () => void) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
}

const tg = (): TgWebApp | null => {
  const w = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  // в обычном браузере объект есть, но platform = 'unknown' и initData пустой
  return w && w.platform && w.platform !== 'unknown' ? w : null;
};

export const inTelegram = () => tg() !== null;

const BG = '#F5F6F8';

/** Одна попытка «раскрыть максимально». Безопасно вызывать много раз: уже сделанное повторно не трогаем */
function expandMax() {
  const w = tg();
  if (!w) return;
  try {
    w.ready();
    if (!w.isExpanded) w.expand();
    if (w.isVersionAtLeast('7.7')) w.disableVerticalSwipes?.();
    // настоящий полный экран есть только на телефонах, на десктопе Telegram это окно и так нужного размера
    if (!w.isFullscreen && w.isVersionAtLeast('8.0') && (w.platform === 'ios' || w.platform === 'android')) w.requestFullscreen?.();
    if (w.isVersionAtLeast('6.1')) { w.setHeaderColor?.(BG); w.setBackgroundColor?.(BG); }
    if (w.isVersionAtLeast('7.10')) w.setBottomBarColor?.(BG);
  } catch { /* старый клиент: просто работаем как обычная страница */ }
}

/** Запуск: раскрываем сразу, потом ещё несколько раз (клиент иногда не готов в первый момент), и по первому касанию.
    Если Telegram сам свернул окно, раскрываем снова. */
export function initTelegram() {
  const w = tg();
  if (!w) return;
  expandMax();
  window.setTimeout(expandMax, 300);
  window.setTimeout(expandMax, 1200);
  window.addEventListener('pointerdown', expandMax, { once: true, passive: true });
  w.onEvent('viewportChanged', () => { if (!w.isExpanded) w.expand(); });
  w.onEvent('fullscreenFailed', () => { /* телефон или клиент не поддерживает: остаёмся в раскрытом окне */ });
}

/** Отступы под кнопки Telegram и вырез экрана, в пикселях окна (0 вне Telegram) */
export function safeInsets(): { top: number; bottom: number } {
  const w = tg();
  if (!w) return { top: 0, bottom: 0 };
  return {
    top: (w.safeAreaInset?.top ?? 0) + (w.contentSafeAreaInset?.top ?? 0),
    bottom: w.safeAreaInset?.bottom ?? 0,
  };
}

/** Подписка на смену отступов и полноэкранного режима. Возвращает функцию отписки */
export function onViewportChange(cb: () => void): () => void {
  const w = tg();
  if (!w) return () => {};
  const events = ['safeAreaChanged', 'contentSafeAreaChanged', 'fullscreenChanged', 'viewportChanged'];
  events.forEach((e) => w.onEvent(e, cb));
  return () => events.forEach((e) => w.offEvent(e, cb));
}

/** Родная кнопка «Назад» Telegram. Без свайпа вниз это основной способ вернуться, закрыть приложение можно крестиком */
export function bindBackButton(visible: boolean, onBack: () => void): () => void {
  const w = tg();
  if (!w || !w.isVersionAtLeast('6.1')) return () => {};
  if (visible) { w.BackButton.onClick(onBack); w.BackButton.show(); } else w.BackButton.hide();
  return () => { w.BackButton.offClick(onBack); };
}
