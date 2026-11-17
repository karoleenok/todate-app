/* Слой данных админки. В прототипе всё лежит в браузере (IndexedDB, запасной вариант localStorage).
   В боевой версии это запросы к серверу с проверкой роли по подписи Telegram (initData). */
import { BASE_DISTRICTS, CATEGORIES, DISTRICTS, EVENTS, IDEAS, NOTES, PLANS, ROUTES, type CityEvent, type CityRoute, type Idea, type Note, type RoutePoint } from './data';
import { ROUTE_GEO, type RouteGeo } from './routeGeo';

export type IdeaPatch = Partial<Pick<Idea, 'title' | 'duration' | 'price' | 'metro' | 'description' | 'secret' | 'place' | 'address' | 'category' | 'image'>>;

export interface AdminState {
  ideas: Record<string, IdeaPatch>;
  added: Idea[];
  hidden: string[];
  /** Порядок карточек: первые четыре — колода недели на главной */
  order: string[];
  plans: Record<string, number>;
  freeHints: number;
  picks: Record<string, boolean>;
  eventsAdded: CityEvent[];
  eventEdits: Record<string, Partial<CityEvent>>;
  eventsHidden: string[];
  routesAdded: CityRoute[];
  routeEdits: Record<string, Partial<CityRoute>>;
  routesHidden: string[];
  notesAdded: Note[];
  noteEdits: Record<string, Partial<Note>>;
  notesHidden: string[];
  /** Заметки, которые оставили пользователи и которые ждут проверки */
  notesPending: Note[];
}

const KEY = 'td_admin';
export const emptyAdmin = (): AdminState => ({
  ideas: {}, added: [], hidden: [], order: [], plans: {}, freeHints: 2, picks: {},
  eventsAdded: [], eventEdits: {}, eventsHidden: [],
  routesAdded: [], routeEdits: {}, routesHidden: [],
  notesAdded: [], noteEdits: {}, notesHidden: [], notesPending: [],
});
export const EMPTY_ADMIN = emptyAdmin();

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T));

const BASE_IDEAS = clone(IDEAS);
const BASE_PLANS = clone(PLANS);
const BASE_EVENTS = clone(EVENTS);
const BASE_ROUTES = clone(ROUTES);
const BASE_NOTES = clone(NOTES);
const BASE_GEO = clone(ROUTE_GEO);
export const baseGeo = (id: string): RouteGeo | undefined => BASE_GEO[id];
const BASE_PICKS = Object.fromEntries(EVENTS.map((e) => [e.id, !!e.pick]));

export const BASE = { ideas: BASE_IDEAS, events: BASE_EVENTS, routes: BASE_ROUTES, notes: BASE_NOTES };
export const BASE_IDEA_IDS = new Set(BASE_IDEAS.map((i) => i.id));
export const BASE_EVENT_IDS = new Set(BASE_EVENTS.map((i) => i.id));
export const BASE_ROUTE_IDS = new Set(BASE_ROUTES.map((i) => i.id));
export const BASE_NOTE_IDS = new Set(BASE_NOTES.map((i) => i.id));

/* ---------- хранение ---------- */
let cache: AdminState | null = null;
const DB = 'td_admin_db', STORE = 'kv';

const idb = (): Promise<IDBDatabase> =>
  new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
const idbGet = (db: IDBDatabase) =>
  new Promise<AdminState | undefined>((res, rej) => {
    const q = db.transaction(STORE).objectStore(STORE).get(KEY);
    q.onsuccess = () => res(q.result as AdminState | undefined);
    q.onerror = () => rej(q.error);
  });
const idbPut = (db: IDBDatabase, v: AdminState) =>
  new Promise<void>((res, rej) => {
    const t = db.transaction(STORE, 'readwrite');
    t.objectStore(STORE).put(v, KEY);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });

const readLegacy = (): Partial<AdminState> | null => {
  try { const v = localStorage.getItem(KEY); return v ? (JSON.parse(v) as Partial<AdminState>) : null; } catch { return null; }
};

/** Читает сохранённые правки до первого показа приложения */
export async function hydrateAdmin(): Promise<void> {
  try {
    const db = await idb();
    const v = await idbGet(db);
    if (v) { cache = { ...emptyAdmin(), ...v }; return; }
  } catch { /* IndexedDB недоступна: пробуем localStorage */ }
  const ls = readLegacy();
  if (ls) cache = { ...emptyAdmin(), ...ls };
}

export function loadAdmin(): AdminState {
  return cache ? { ...emptyAdmin(), ...cache } : emptyAdmin();
}

/** Сохраняет правки. IndexedDB вмещает сотни мегабайт, так что картинки не упираются в лимит localStorage */
export function saveAdmin(s: AdminState): boolean {
  cache = s;
  idb().then((db) => idbPut(db, s)).catch(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* места нет и там */ }
  });
  return true;
}

export const adminToJson = (s: AdminState) => JSON.stringify({ app: 'todate-admin', version: 1, data: s });

/** Разбор файла копии. Берём только известные поля нужного вида, остальное отбрасываем */
export function adminFromJson(text: string): AdminState | null {
  try {
    const raw = JSON.parse(text) as { app?: string; data?: Partial<AdminState> };
    if (raw?.app !== 'todate-admin' || !raw.data || typeof raw.data !== 'object') return null;
    const e = emptyAdmin();
    const d = raw.data;
    const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
    const rec = <T,>(v: unknown): Record<string, T> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, T>) : {});
    return {
      ...e,
      ideas: rec(d.ideas), added: arr(d.added), hidden: arr(d.hidden), order: arr(d.order), plans: rec(d.plans),
      freeHints: typeof d.freeHints === 'number' ? Math.max(0, Math.min(20, d.freeHints)) : 2, picks: rec(d.picks),
      eventsAdded: arr(d.eventsAdded), eventEdits: rec(d.eventEdits), eventsHidden: arr(d.eventsHidden),
      routesAdded: arr(d.routesAdded), routeEdits: rec(d.routeEdits), routesHidden: arr(d.routesHidden),
      notesAdded: arr(d.notesAdded), noteEdits: rec(d.noteEdits), notesHidden: arr(d.notesHidden), notesPending: arr(d.notesPending),
    };
  } catch { return null; }
}

/* ---------- мелочи ---------- */
export const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
export const parseMoney = (v: string) => Math.max(0, Math.round(Number(v.replace(/\D/g, '')) || 0));

let freeHints = 2;
export const getFreeHints = () => freeHints;

export const newId = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** Ссылки из админки: только https. Всё остальное (javascript:, data:, http:) отбрасываем */
export const safeLink = (v?: string) => {
  const t = (v ?? '').trim();
  return /^https:\/\/[^\s]+$/i.test(t) ? t : undefined;
};

const MS_DAY = 86400000;
const utc = (y: number, m: number, d: number) => Date.UTC(y, m, d);
/** День недели события относительно понедельника текущей недели: 0–6 — в этой неделе, меньше нуля — прошло, больше шести — позже */
export function offsetFromDate(date: string, now = new Date()): number | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return undefined;
  const mon = utc(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  return Math.round((utc(+m[1], +m[2] - 1, +m[3]) - mon) / MS_DAY);
}

/** Где событие сейчас: в афише, прошло или будет на другой неделе */
export type EventWhen = 'now' | 'past' | 'later';
export function eventWhen(e: CityEvent, now = new Date()): EventWhen {
  const today = (now.getDay() + 6) % 7;
  if (e.dayOffset < today) return 'past';
  if (e.dayOffset > 6) return 'later';
  return 'now';
}

const rad = (x: number) => (x * Math.PI) / 180;
const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

export const hasCoords = (p: RoutePoint) => typeof p.lat === 'number' && typeof p.lng === 'number' && Number.isFinite(p.lat) && Number.isFinite(p.lng);

/** Карта маршрута из точек админки: прямая линия между точками (по улицам такие маршруты пока не строим) */
export function buildGeo(points: RoutePoint[]): RouteGeo | undefined {
  if (points.length < 2 || !points.every(hasCoords)) return undefined;
  const ps = points.map((p) => ({ lat: p.lat as number, lng: p.lng as number }));
  let km = 0;
  for (let i = 1; i < ps.length; i++) km += dist(ps[i - 1], ps[i]);
  km = Math.round(km * 10) / 10;
  return { points: ps.map((p) => ({ ...p, approx: false })), line: ps.map((p) => [p.lng, p.lat] as [number, number]), km, min: Math.round((km / 4.8) * 60) };
}

const sortByOrder = <T extends { id: string }>(list: T[], order: string[]) => {
  if (!order.length) return list;
  const pos = new Map(order.map((id, i) => [id, i]));
  return list
    .map((x, i) => ({ x, k: pos.has(x.id) ? (pos.get(x.id) as number) : order.length + i }))
    .sort((a, b) => a.k - b.k)
    .map((r) => r.x);
};

const overlay = <T extends { id: string }>(base: T[], added: T[], edits: Record<string, Partial<T>>, hidden: string[]) =>
  [...clone(base), ...clone(added)].map((x) => ({ ...x, ...(edits[x.id] ?? {}) })).filter((x) => !hidden.includes(x.id));

const hueByCategory: Record<string, number> = { музыка: 35, кино: 260, выставки: 330, лекции: 210, еда: 25, игры: 90 };
export const defaultHue = (category: string) => hueByCategory[category] ?? 200;

/** Накладывает правки админа на данные приложения. Можно вызывать много раз: сначала всё возвращается к исходному */
export function applyAdmin(s: AdminState) {
  // карточки
  const ideas = overlay(BASE_IDEAS, s.added, s.ideas as Record<string, Partial<Idea>>, s.hidden);
  IDEAS.splice(0, IDEAS.length, ...sortByOrder(ideas, s.order));

  // подписка
  PLANS.forEach((p, k) => {
    Object.assign(p, BASE_PLANS[k]);
    const v = s.plans[p.id];
    if (v) {
      p.price = money(v);
      p.per = p.id === 'week' ? 'попробовать' : `≈ ${Math.round(v / p.days)} ₽ в день`;
    }
  });

  // афиша
  const ev = overlay(BASE_EVENTS, s.eventsAdded, s.eventEdits, s.eventsHidden).map((e) => {
    const pick = BASE_EVENT_IDS.has(e.id) && !(e.id in s.eventEdits && 'pick' in s.eventEdits[e.id]) ? (s.picks[e.id] ?? BASE_PICKS[e.id]) : e.pick;
    const off = e.date ? offsetFromDate(e.date) : undefined;
    return { ...e, pick, link: safeLink(e.link), dayOffset: off ?? e.dayOffset };
  });
  EVENTS.splice(0, EVENTS.length, ...ev);

  // маршруты
  const routes = overlay(BASE_ROUTES, s.routesAdded, s.routeEdits, s.routesHidden);
  ROUTES.splice(0, ROUTES.length, ...routes);
  for (const k of Object.keys(ROUTE_GEO)) delete ROUTE_GEO[k];
  for (const [k, g] of Object.entries(clone(BASE_GEO))) ROUTE_GEO[k] = g;
  for (const r of routes) {
    const builtIn = BASE_ROUTE_IDS.has(r.id);
    if (builtIn && !(s.routeEdits[r.id] && 'points' in s.routeEdits[r.id])) continue; // не трогали точки: остаётся линия по улицам
    const base = BASE_GEO[r.id];
    if (builtIn && base) {
      // точки встроенного маршрута не сдвинули и не добавили: оставляем построенную по улицам линию
      const same = r.points.length === base.points.length && r.points.every((p, i) =>
        !hasCoords(p) || (Math.abs((p.lat as number) - base.points[i].lat) < 1e-5 && Math.abs((p.lng as number) - base.points[i].lng) < 1e-5));
      if (same) continue;
    }
    const g = buildGeo(r.points);
    if (g) ROUTE_GEO[r.id] = g; else delete ROUTE_GEO[r.id];
  }
  const extra = routes.map((r) => r.district).filter((d) => d && !BASE_DISTRICTS.includes(d));
  DISTRICTS.splice(0, DISTRICTS.length, ...BASE_DISTRICTS, ...Array.from(new Set(extra)));

  // заметки
  NOTES.splice(0, NOTES.length, ...overlay(BASE_NOTES, s.notesAdded, s.noteEdits, s.notesHidden));

  freeHints = Math.max(0, Math.min(20, s.freeHints));
}

export const categoryOptions = CATEGORIES;

export const plural = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c;
};
const WORDS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
export const numWord = (n: number) => WORDS[n] ?? String(n);
