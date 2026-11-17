// Внешние ссылки: Яндекс Карты и Telegram

// Имя бота — временное, подставим боевое, когда заведём бота в BotFather
export const BOT_USERNAME = 'todate_bot';

type Pt = { lat: number; lng: number };

// Маршрут по точкам: rtext=lat,lon~lat,lon, rtt=pd — пешком (формат из документации Яндекса)
export const yandexRoute = (pts: Pt[]) =>
  `https://yandex.ru/maps/?rtext=${pts.map((p) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`).join('~')}&rtt=pd`;

// Одна точка на карте: pt=lon,lat
export const yandexPoint = (p: Pt) =>
  `https://yandex.ru/maps/?pt=${p.lng.toFixed(6)},${p.lat.toFixed(6)}&z=16&l=map`;

// Поиск места по названию (для афиши, где координат нет)
export const yandexSearch = (text: string) =>
  `https://yandex.ru/maps/?text=${encodeURIComponent(`${text}, Санкт-Петербург`)}`;

export const telegramShare = (url: string, text: string) =>
  `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;

// Ссылка на бота: после «Старт» бот получает код и связывает двоих
export const botLink = (code: string) => `https://t.me/${BOT_USERNAME}?start=${code}`;

// Внутри Telegram открываем через его методы, в браузере — новой вкладкой
export function openExternal(url: string) {
  const tg = (window as unknown as { Telegram?: { WebApp?: { openLink?: (u: string) => void; openTelegramLink?: (u: string) => void } } }).Telegram?.WebApp;
  if (tg && url.startsWith('https://t.me/') && tg.openTelegramLink) tg.openTelegramLink(url);
  else if (tg && tg.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener,noreferrer');
}

// Неделя: понедельник — воскресенье
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const DOW = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function weekInfo(now = new Date()) {
  const d0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const mon = new Date(d0); mon.setDate(d0.getDate() - ((d0.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const next = new Date(mon); next.setDate(mon.getDate() + 7);
  const key = `${mon.getFullYear()}-${mon.getMonth() + 1}-${mon.getDate()}`;
  const label = mon.getMonth() === sun.getMonth()
    ? `${mon.getDate()}–${sun.getDate()} ${MONTHS[sun.getMonth()]}`
    : `${mon.getDate()} ${MONTHS[mon.getMonth()]} – ${sun.getDate()} ${MONTHS[sun.getMonth()]}`;
  const nextLabel = `${next.getDate()} ${MONTHS[next.getMonth()]}`;
  const todayOffset = Math.round((d0.getTime() - mon.getTime()) / 86400000);
  const day = (offset: number) => {
    const d = new Date(mon); d.setDate(mon.getDate() + offset);
    return { date: d, short: `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, num: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}` };
  };
  return { key, label, nextLabel, todayOffset, day };
}
