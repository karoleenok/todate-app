/* Слой данных админки. В прототипе всё лежит в localStorage.
   В боевой версии это запросы к серверу с проверкой роли по подписи Telegram (initData). */
import { EVENTS, IDEAS, PLANS, type Idea } from './data';

export type IdeaPatch = Partial<Pick<Idea, 'title' | 'duration' | 'price' | 'metro' | 'description' | 'secret' | 'place' | 'address'>>;

export interface AdminState {
  ideas: Record<string, IdeaPatch>;
  added: Idea[];
  hidden: string[];
  plans: Record<string, number>;
  freeHints: number;
  picks: Record<string, boolean>;
}

const KEY = 'td_admin';
export const EMPTY_ADMIN: AdminState = { ideas: {}, added: [], hidden: [], plans: {}, freeHints: 2, picks: {} };

const BASE_IDEAS = IDEAS.map((i) => ({ ...i }));
const BASE_PLANS = PLANS.map((p) => ({ ...p }));
const BASE_PICKS = Object.fromEntries(EVENTS.map((e) => [e.id, !!e.pick]));

export function loadAdmin(): AdminState {
  try {
    const v = localStorage.getItem(KEY);
    return v ? { ...EMPTY_ADMIN, ...(JSON.parse(v) as Partial<AdminState>) } : { ...EMPTY_ADMIN };
  } catch { return { ...EMPTY_ADMIN }; }
}

export function saveAdmin(s: AdminState): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export const money = (n: number) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
export const parseMoney = (v: string) => Math.max(0, Math.round(Number(v.replace(/\D/g, '')) || 0));

let freeHints = 2;
export const getFreeHints = () => freeHints;

/** Накладывает правки админа на данные приложения. Можно вызывать много раз: сначала всё возвращается к исходному */
export function applyAdmin(s: AdminState) {
  IDEAS.splice(0, IDEAS.length, ...BASE_IDEAS.map((i) => ({ ...i })), ...s.added.map((i) => ({ ...i })));
  for (const i of IDEAS) Object.assign(i, s.ideas[i.id] ?? {});
  if (s.hidden.length) {
    const keep = IDEAS.filter((i) => !s.hidden.includes(i.id));
    IDEAS.splice(0, IDEAS.length, ...keep);
  }
  PLANS.forEach((p, k) => {
    Object.assign(p, BASE_PLANS[k]);
    const v = s.plans[p.id];
    if (v) {
      p.price = money(v);
      p.per = p.id === 'week' ? 'попробовать' : `≈ ${Math.round(v / p.days)} ₽ в день`;
    }
  });
  for (const e of EVENTS) e.pick = s.picks[e.id] ?? BASE_PICKS[e.id];
  freeHints = Math.max(0, Math.min(20, s.freeHints));
}

export const plural = (n: number, a: string, b: string, c: string) => {
  const m10 = n % 10, m100 = n % 100;
  return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20) ? b : c;
};
const WORDS = ['ноль', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'];
export const numWord = (n: number) => WORDS[n] ?? String(n);
