import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bindBackButton, onViewportChange, safeInsets } from './telegram';
import { Header, BottomNav, type NavKey, IconBell } from './ui';
import { weekInfo } from './links';
import { lazy, Suspense } from 'react';
import { applyAdmin, getFreeHints, loadAdmin, saveAdmin, type AdminState } from './store';
import { Auth, Invite, Accept, Home, IdeaDetail, HintForm, HintSent, HintView, MyHints, Favorites, Routes, RouteDetail, Events, Profile, Account, Paywall, Notes, LimitSheet } from './screens';

const Admin = lazy(() => import('./admin'));

export type RouteName =
  | 'auth' | 'invite' | 'accept' | 'home' | 'idea' | 'hint' | 'hint-sent' | 'hint-view' | 'hints'
  | 'favorites' | 'routes' | 'route' | 'events' | 'profile' | 'account' | 'paywall' | 'notes' | 'admin';

export interface Route { name: RouteName; id?: string }

export interface Hint { id: string; ideaId: string; from: string; to: string; date: string; status: 'отправлен' | 'услышан'; dir?: 'in'; secret?: string }

export interface Profile { name: string; email: string; partner?: string; avatar?: string; partnerStatus?: 'invited' | 'linked'; partnerName?: string; isAdmin?: boolean }

export interface AppCtx {
  go: (r: Route) => void;
  back: () => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  hints: Hint[];
  markHeard: (id: string) => void;
  sendHint: (ideaId: string, from: string, to: string) => void;
  /** Открыть форму намёка или, если бесплатные закончились, показать шторку с подпиской */
  startHint: (ideaId: string) => void;
  /** Сколько бесплатных намёков осталось (null — подписка, лимита нет) */
  freeLeft: number | null;
  subscribed: number;
  subscribe: (days: number) => void;
  profile: Profile;
  setProfile: (p: Profile) => void;
  registered: boolean;
  register: (name: string, email: string) => void;
  invitePartner: (email: string) => void;
  toast: (msg: string) => void;
  admin: AdminState;
  saveAdmin: (s: AdminState) => void;
}

function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch { return fallback; }
}

function routeFromHash(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [name, id] = h.split('/');
  const names: RouteName[] = ['auth', 'invite', 'accept', 'home', 'idea', 'hint', 'hint-sent', 'hint-view', 'hints', 'favorites', 'routes', 'route', 'events', 'profile', 'account', 'paywall', 'notes', 'admin'];
  if (names.includes(name as RouteName)) return { name: name as RouteName, id };
  return { name: 'home' };
}

/** Широкий экран (ПК): админку показываем на всю страницу, а не в телефонной колонке */
function useWide(min = 900) {
  const q = `(min-width: ${min}px)`;
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const h = () => setWide(m.matches);
    m.addEventListener('change', h);
    return () => m.removeEventListener('change', h);
  }, [q]);
  return wide;
}

export default function App() {
  const wide = useWide();
  const [route, setRoute] = useState<Route>(() => routeFromHash());
  const historyRef = useRef<Route[]>([]);
  const [favorites, setFavorites] = useState<string[]>(() => load('td_favs', ['ciao-kaiju', 'geocaching']));
  const [hints, setHints] = useState<Hint[]>(() =>
    load('td_hints', [
      { id: 'h-in1', ideaId: 'ciao-kaiju', from: 'Матвей', to: 'Каролина', dir: 'in', date: '16.11.2026', status: 'отправлен', secret: 'Демо-сюрприз из админки: после ужина я приготовил для тебя маленький подарок, он лежит у меня в рюкзаке.' },
      { id: 'h1', ideaId: 'naedine', from: 'Каролина', to: 'matvey@example.com', date: '10.11.2026', status: 'услышан' },
      { id: 'h2', ideaId: 'ciao-kaiju', from: 'Каролина', to: 'matvey@example.com', date: '15.11.2026', status: 'отправлен' },
    ]),
  );
  const [admin, setAdmin] = useState<AdminState>(() => { const a = loadAdmin(); applyAdmin(a); return a; });
  const [freeUsed, setFreeUsed] = useState<number>(() => load('td_free_used', 0));
  const [limitOpen, setLimitOpen] = useState(false);
  const [subscribed, setSubscribed] = useState<number>(() => load('td_sub', 0));
  const [profile, setProfile] = useState<Profile>(() => ({ avatar: './avatar.webp', ...load<Profile>('td_profile', { name: 'Каролина', email: 'karolina@example.com' }) }));
  const [registered, setRegistered] = useState<boolean>(() => load('td_registered', false));
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const wk = useMemo(() => weekInfo(), []);
  const [weekOpen, setWeekOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Первый заход за неделю: напоминаем, что карточки обновляются раз в неделю
  useEffect(() => {
    if (route.name !== 'home') return;
    let seen = '';
    try { seen = localStorage.getItem('td_week_seen') ?? ''; } catch { /* ignore */ }
    if (seen === wk.key) return;
    const t = window.setTimeout(() => setWeekOpen(true), 500);
    return () => window.clearTimeout(t);
  }, [route.name, wk.key]);
  const closeWeek = () => { setWeekOpen(false); try { localStorage.setItem('td_week_seen', wk.key); } catch { /* ignore */ } };

  useEffect(() => { localStorage.setItem('td_favs', JSON.stringify(favorites)); }, [favorites]);
  useEffect(() => { localStorage.setItem('td_hints', JSON.stringify(hints)); }, [hints]);
  useEffect(() => { localStorage.setItem('td_free_used', JSON.stringify(freeUsed)); }, [freeUsed]);
  useEffect(() => { localStorage.setItem('td_sub', JSON.stringify(subscribed)); }, [subscribed]);
  useEffect(() => { localStorage.setItem('td_profile', JSON.stringify(profile)); }, [profile]);
  useEffect(() => { localStorage.setItem('td_registered', JSON.stringify(registered)); }, [registered]);

  // Масштабируем холст 390×844 под реальный экран.
  // Высоту берём из screen.height — она стабильна и не зависит от панелей мобильного браузера,
  // иначе Safari с тулбаром уменьшает innerHeight и весь макет «схлопывается» с серыми полями.
  useEffect(() => {
    const apply = () => {
      const h = Math.max(window.innerHeight, window.screen?.height || 0);
      const s = Math.min(window.innerWidth / 390, h / 844);
      const phone = document.querySelector('.phone') as HTMLElement | null;
      if (phone) {
        phone.style.zoom = String(s);
        // Видимая высота в единицах канваса — чтобы шторки экранов ровно доходили до низа без серых полей
        phone.style.setProperty('--canvas-h', `${window.innerHeight / s}px`);
        // Отступы Telegram (кнопки «закрыть/меню» в полноэкранном режиме) тоже переводим в единицы канваса
        const ins = safeInsets();
        phone.style.setProperty('--safe-top', `${ins.top / s}px`);
        phone.style.setProperty('--safe-bottom', `${ins.bottom / s}px`);
      }
    };
    apply();
    window.addEventListener('resize', apply);
    window.addEventListener('orientationchange', apply);
    const off = onViewportChange(apply);
    return () => {
      window.removeEventListener('resize', apply);
      window.removeEventListener('orientationchange', apply);
      off();
    };
  }, []);

  const go = useCallback((r: Route) => {
    setRoute((cur) => { historyRef.current = [...historyRef.current, cur]; return r; });
    window.location.hash = `/${r.name}${r.id ? `/${r.id}` : ''}`;
    window.scrollTo({ top: 0 });
  }, []);
  const back = useCallback(() => {
    const prev = historyRef.current[historyRef.current.length - 1];
    historyRef.current = historyRef.current.slice(0, -1);
    setRoute(prev ?? { name: 'home' });
    window.scrollTo({ top: 0 });
  }, []);

  // Родная кнопка «Назад» в Telegram: свайп вниз отключён, поэтому возвращаться нужно чем-то заметным
  useEffect(() => bindBackButton(route.name !== 'home' && !(route.name === 'admin' && wide), back), [route.name, back, wide]);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg(null), 2200);
  }, []);

  const ctx: AppCtx = useMemo(() => ({
    go, back,
    favorites,
    toggleFavorite: (id) => setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
    hints,
    markHeard: (id) => setHints((hs) => hs.map((h) => (h.id === id ? { ...h, status: 'услышан' } : h))),
    sendHint: (ideaId, from, to) => {
      if (subscribed <= 0) setFreeUsed((n) => n + 1);
      setHints((hs) => [
        { id: `h${Date.now()}`, ideaId, from, to, date: new Date().toLocaleDateString('ru-RU'), status: 'отправлен' },
        ...hs,
      ]);
    },
    freeLeft: subscribed > 0 ? null : Math.max(0, getFreeHints() - freeUsed),
    startHint: (ideaId) => {
      if (subscribed > 0 || freeUsed < getFreeHints()) go({ name: 'hint', id: ideaId });
      else setLimitOpen(true);
    },
    subscribed,
    subscribe: (days) => setSubscribed(days),
    profile, setProfile,
    registered,
    register: (name, email) => { setProfile({ name, email }); setRegistered(true); },
    invitePartner: (email) => setProfile((p) => ({ ...p, partner: email })),
    toast,
    admin,
    saveAdmin: (next) => { if (!saveAdmin(next)) toast('Не хватило места в браузере: уберите лишнюю картинку'); applyAdmin(next); setAdmin(next); },
  }), [go, back, favorites, hints, subscribed, freeUsed, profile, registered, toast, admin]);

  const navActive: NavKey =
    route.name === 'home' || route.name === 'idea' || route.name === 'hint' || route.name === 'hint-sent' ? 'home'
    : route.name === 'hints' || route.name === 'hint-view' ? 'hints'
    : route.name === 'favorites' ? 'favorites'
    : route.name === 'routes' || route.name === 'route' ? 'routes'
    : route.name === 'events' ? 'events'
    : 'profile';

  const deskAdmin = route.name === 'admin' && !!profile.isAdmin && wide;
  const showNav = route.name !== 'auth' && route.name !== 'invite' && route.name !== 'accept' && !deskAdmin;
  const goNav = (k: NavKey) =>
    k === 'home' ? go({ name: 'home' })
    : k === 'routes' ? go({ name: 'routes' })
    : k === 'events' ? go({ name: 'events' })
    : k === 'favorites' ? go({ name: 'favorites' })
    : k === 'hints' ? go({ name: 'hints' })
    : go({ name: 'profile' });

  return (
    <div className="stage">
    <div className="phone">
      {route.name !== 'auth' && route.name !== 'invite' && route.name !== 'accept' && !deskAdmin && <Header mini={route.name === 'routes' || route.name === 'route'} routeKey={route.name} onBell={() => setNotifOpen(true)} onSearch={() => setSearchOpen(true)} />}

      {route.name === 'auth' && <Auth ctx={ctx} />}
      {route.name === 'invite' && <Invite ctx={ctx} />}
      {route.name === 'accept' && <Accept ctx={ctx} />}
      {route.name === 'home' && <Home ctx={ctx} />}
      {route.name === 'idea' && <IdeaDetail ctx={ctx} id={route.id!} />}
      {route.name === 'hint' && <HintForm ctx={ctx} id={route.id!} />}
      {route.name === 'hint-sent' && <HintSent ctx={ctx} id={route.id!} />}
      {route.name === 'hint-view' && <HintView ctx={ctx} id={route.id!} />}
      {route.name === 'hints' && <MyHints ctx={ctx} id={route.id} />}
      {route.name === 'favorites' && <Favorites ctx={ctx} />}
      {route.name === 'routes' && <Routes ctx={ctx} />}
      {route.name === 'route' && <RouteDetail ctx={ctx} id={route.id!} />}
      {route.name === 'events' && <Events ctx={ctx} />}
      {route.name === 'profile' && <Profile ctx={ctx} />}
      {route.name === 'account' && <Account ctx={ctx} />}
      {route.name === 'paywall' && <Paywall ctx={ctx} />}
      {route.name === 'notes' && <Notes ctx={ctx} />}
      {route.name === 'admin' && !profile.isAdmin && <Profile ctx={ctx} />}
      {route.name === 'admin' && profile.isAdmin && !wide && <Suspense fallback={<div className="screen" />}><Admin ctx={ctx} id={route.id} /></Suspense>}

      {showNav && (
        <>
          <div className="fade-bottom" />
          <BottomNav active={navActive} go={goNav} initial={profile.name.charAt(0).toUpperCase()} avatar={profile.avatar} newHints={hints.filter((h) => h.dir === 'in' && h.status === 'отправлен').length} />
        </>
      )}

      {/* Уведомления */}
      {notifOpen && (
        <div className="modal-backdrop" onClick={() => setNotifOpen(false)} role="dialog" aria-modal="true">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="h3" style={{ margin: '14px 0 12px' }}>Уведомления</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {hints.find((h) => h.dir === 'in' && h.status === 'отправлен') && (
                <button
                  className="plate" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, border: 'none', textAlign: 'left', width: '100%', cursor: 'pointer', boxShadow: 'inset 0 0 0 2px var(--primary)' }}
                  onClick={() => { const h = hints.find((x) => x.dir === 'in' && x.status === 'отправлен'); setNotifOpen(false); if (h) go({ name: 'hint-view', id: h.id }); }}
                >
                  <span style={{ color: 'var(--primary)' }}><IconBell /></span>
                  <div style={{ fontSize: 13, lineHeight: '17px' }}>
                    <b>{hints.find((x) => x.dir === 'in' && x.status === 'отправлен')!.from} намекает на свидание.</b> Откройте, чтобы увидеть идею и секрет.
                    <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>{hints.find((x) => x.dir === 'in' && x.status === 'отправлен')!.date}</div>
                  </div>
                </button>
              )}
              <div className="plate" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14 }}>
                <span style={{ color: 'var(--primary)' }}><IconBell /></span>
                <div style={{ fontSize: 13, lineHeight: '17px' }}>
                  <b>Обновление недели:</b> новые карточки в категориях «Еда» и «Релакс», новый маршрут по Коломне.
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>07.11.2026</div>
                </div>
              </div>
              <div className="plate" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14 }}>
                <span style={{ color: 'var(--primary)' }}><IconBell /></span>
                <div style={{ fontSize: 13, lineHeight: '17px' }}>
                  <b>Ваш намёк услышан!</b> Партнёр открыл письмо про фотосессию в «наедине».
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>20.10.2026</div>
                </div>
              </div>
            </div>
            <button className="btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={() => setNotifOpen(false)}>Закрыть</button>
          </div>
        </div>
      )}

      {/* Карточки недели */}
      {weekOpen && (
        <div className="modal-backdrop" onClick={closeWeek} role="dialog" aria-modal="true" aria-label="Карточки на неделю">
          <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="h3" style={{ margin: '14px 0 8px' }}>Карточки на неделю</div>
            <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>
              Здесь четыре идеи на {wk.label}. Смахните карточку влево или вправо, чтобы увидеть следующую, или нажмите на неё, чтобы открыть подробности. Новые карточки откроем {wk.nextLabel}.
            </p>
            <button className="btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={closeWeek}>Понятно</button>
          </div>
        </div>
      )}

      {/* Бесплатные намёки закончились */}
      {limitOpen && (
        <LimitSheet
          ctx={ctx}
          onClose={() => setLimitOpen(false)}
          onReset={() => { setFreeUsed(0); setLimitOpen(false); toast('Демо: бесплатные намёки вернулись'); }}
        />
      )}

      {/* Поиск */}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} ctx={ctx} />}

      {/* Быстрый вход в события из профиля-меню нет; добавим скрытый доступ: долгое нажатие на логотип не нужно. */}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
    {deskAdmin && (
      <div className="adm-overlay">
        <Suspense fallback={null}><Admin ctx={ctx} id={route.id} desktop /></Suspense>
        {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
      </div>
    )}
    </div>
  );
}

import { useState as useStateS } from 'react';
import { IDEAS } from './data';
import { IdeaTile } from './ui';

function SearchModal({ onClose, ctx }: { onClose: () => void; ctx: AppCtx }) {
  const [q, setQ] = useStateS('');
  const res = q.trim()
    ? IDEAS.filter((i) => i.title.toLowerCase().includes(q.trim().toLowerCase()))
    : IDEAS;
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" style={{ position: 'static', margin: '6px auto 14px' }} />
        <div className="h3" style={{ marginBottom: 12 }}>Поиск по картотеке</div>
        <input className="input" autoFocus placeholder="Например: пицца, фотосессия, геокэшинг" value={q} onChange={(e) => setQ(e.target.value)} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 14 }}>
          {res.length === 0 && <div style={{ gridColumn: '1/-1', fontSize: 13, color: 'var(--text-2)', padding: '8px 0' }}>Ничего не нашлось. Попробуйте «пицца» или «фотосессия».</div>}
          {res.map((i) => (
            <IdeaTile key={i.id} idea={i} onClick={() => { onClose(); ctx.go({ name: 'idea', id: i.id }); }} />
          ))}
        </div>
        <button className="btn-ghost" style={{ width: '100%', marginTop: 14 }} onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}
