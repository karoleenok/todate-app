/* Админка. Грузится отдельным куском и только когда включён режим админа.
   В прототипе роль хранится в профиле, а данные лежат в браузере. В боевой версии роль определяет сервер
   по подписи Telegram (initData), флаг в браузере ничего не значит, а сюрпризы хранятся только на сервере. */
import { useEffect, useRef, useState } from 'react';
import type { AppCtx } from './App';
import { EVENTS, IDEAS, NOTES, PLANS, ROUTES } from './data';
import { adminFromJson, adminToJson, emptyAdmin, eventWhen, getFreeHints, money, parseMoney, type AdminState } from './store';
import { IconChevron, Logo } from './ui';
import { CardEditor, CardsList } from './adminCards';
import { EventEditor, EventsList } from './adminEvents';
import { RouteEditor, RoutesList } from './adminRoutes';
import { NotesPage } from './adminNotes';
import { DangerButton, DeskCtx, Field, SectionTitle, Shell, Tag, useDesk } from './adminUi';

function MenuRow({ title, text, onClick, badge }: { title: string; text: string; onClick: () => void; badge?: string }) {
  return (
    <button className="plate" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '14px 16px' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>{title} {badge && <Tag tone="pink">{badge}</Tag>}</span>
        <span style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 2 }}>{text}</span>
      </span>
      <span style={{ color: 'var(--stroke)', flex: 'none' }}><IconChevron /></span>
    </button>
  );
}

const NAV: [string, string][] = [
  ['home', 'Обзор'], ['cards', 'Карточки'], ['events', 'Афиша'], ['routes', 'Маршруты'], ['notes', 'Заметки'], ['plans', 'Подписка и лимит'], ['stats', 'Намёки'], ['data', 'Данные'],
];

export default function Admin({ ctx, id, desktop = false }: { ctx: AppCtx; id?: string; desktop?: boolean }) {
  if (!desktop) return <AdminBody ctx={ctx} id={id} />;
  return (
    <DeskCtx.Provider value={true}>
      <DeskFrame ctx={ctx} id={id}><AdminBody ctx={ctx} id={id} /></DeskFrame>
    </DeskCtx.Provider>
  );
}

function sectionOf(id?: string) {
  if (!id) return 'home';
  if (id === 'new-card' || id.startsWith('c:')) return 'cards';
  if (id.startsWith('new-event') || id.startsWith('e:')) return 'events';
  if (id === 'new-route' || id.startsWith('r:')) return 'routes';
  return id;
}

function DeskFrame({ ctx, id, children }: { ctx: AppCtx; id?: string; children: React.ReactNode }) {
  const active = sectionOf(id);
  // при переходе между разделами страница админки начинается сверху
  useEffect(() => { document.querySelector('.adm-overlay')?.scrollTo({ top: 0 }); }, [id]);
  return (
    <div className="adm">
      <aside className="adm-side">
        <div style={{ padding: '4px 18px 22px' }}><Logo /></div>
        <nav aria-label="Разделы админки" style={{ display: 'grid', gap: 4 }}>
          {NAV.map(([k, label]) => (
            <button key={k} className="adm-nav" aria-current={active === k ? 'page' : undefined} onClick={() => ctx.go(k === 'home' ? { name: 'admin' } : { name: 'admin', id: k })}>
              {label}
              {k === 'notes' && ctx.admin.notesPending.length > 0 && <span className="adm-count">{ctx.admin.notesPending.length}</span>}
            </button>
          ))}
        </nav>
        <div style={{ flex: 1 }} />
        <button className="adm-nav" onClick={() => ctx.go({ name: 'home' })}>← В приложение</button>
        <button className="adm-nav" onClick={() => { ctx.setProfile({ ...ctx.profile, isAdmin: false }); ctx.go({ name: 'profile' }); }}>Выйти из админки</button>
      </aside>
      <main className="adm-main"><div className="adm-wrap">{children}</div></main>
    </div>
  );
}

function AdminBody({ ctx, id }: { ctx: AppCtx; id?: string }) {
  const desk = useDesk();
  const save = (next: AdminState, msg = 'Сохранено') => { ctx.saveAdmin(next); ctx.toast(msg); };

  if (!id) return <Overview ctx={ctx} />;
  if (id === 'cards') return <CardsList ctx={ctx} save={save} />;
  if (id === 'new-card' || id.startsWith('c:')) return <CardEditor key={id} ctx={ctx} id={id} save={save} />;
  if (id === 'events') return <EventsList ctx={ctx} save={save} />;
  if (id.startsWith('new-event') || id.startsWith('e:')) return <EventEditor key={id} ctx={ctx} id={id} save={save} />;
  if (id === 'routes') return <RoutesList ctx={ctx} save={save} />;
  if (id === 'new-route' || id.startsWith('r:')) return <RouteEditor key={id} ctx={ctx} id={id} save={save} />;
  if (id === 'notes') return <NotesPage ctx={ctx} save={save} />;
  if (id === 'plans') return <PlansForm ctx={ctx} save={save} />;
  if (id === 'data') return <DataPage ctx={ctx} save={save} />;
  if (id === 'stats') {
    const out = ctx.hints.filter((h) => h.dir !== 'in');
    const heard = ctx.hints.filter((h) => h.status === 'услышан').length;
    const rows: [string, string | number][] = [
      ['Всего намёков', ctx.hints.length], ['Отправлено', out.length], ['Получено', ctx.hints.length - out.length], ['Услышано', heard],
      ['Бесплатных осталось у этого аккаунта', ctx.freeLeft === null ? 'подписка' : ctx.freeLeft],
    ];
    return (
      <Shell ctx={ctx} title="Намёки" narrow={560} sub="Здесь только цифры. Тексты сюрпризов в статистику не попадают." back={!desk}>
        <div className="plate" style={{ padding: '4px 16px' }}>
          {rows.map(([k, v], n) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', fontSize: 13, borderTop: n ? '1px solid var(--divider)' : 'none' }}>
              <span>{k}</span><b>{v}</b>
            </div>
          ))}
        </div>
      </Shell>
    );
  }
  return <Shell ctx={ctx} title="Не найдено" back><p style={{ fontSize: 13 }}>Такого раздела нет.</p></Shell>;
}

/* ---------- обзор ---------- */
function Overview({ ctx }: { ctx: AppCtx }) {
  const desk = useDesk();
  const inNow = EVENTS.filter((e) => eventWhen(e) === 'now');
  const picks = inNow.filter((e) => e.pick).length;
  const noErid = EVENTS.filter((e) => e.sponsored && (!e.erid || !e.advertiser)).length;
  const pending = ctx.admin.notesPending.length;
  const checks: { ok: boolean; text: string; go?: string }[] = [
    { ok: IDEAS.length >= 4, text: IDEAS.length >= 4 ? 'Колода недели собрана: четыре карточки' : `В колоде недели только ${IDEAS.length} из 4 карточек`, go: 'cards' },
    { ok: inNow.length > 0, text: inNow.length > 0 ? `В афише этой недели событий: ${inNow.length}` : 'В афише этой недели пусто', go: 'events' },
    { ok: picks > 0, text: picks > 0 ? `В «Выборе To Date» событий: ${picks}` : 'В «Выборе To Date» нет событий', go: 'events' },
    { ok: noErid === 0, text: noErid === 0 ? 'У всей рекламы указан рекламодатель и erid' : `Реклама без erid или рекламодателя: ${noErid}`, go: 'events' },
    { ok: pending === 0, text: pending === 0 ? 'Заявок на заметки нет' : `Заметок ждёт проверки: ${pending}`, go: 'notes' },
  ];
  const inN = ctx.hints.filter((h) => h.dir === 'in').length;
  return (
    <Shell ctx={ctx} title="Админка" narrow={desk ? 980 : undefined} sub="Здесь правим всё, что видят пользователи. Сохранённое сразу попадает в приложение.">
      <div className="adm-tiles" style={{ marginBottom: 20, display: desk ? undefined : 'none' }}>
        {([['Карточек', IDEAS.length], ['Событий в афише', inNow.length], ['Маршрутов', ROUTES.length], ['Заметок', NOTES.length]] as [string, number][]).map(([k, v]) => (
          <div key={k} className="plate" style={{ padding: '18px 20px' }}>
            <div className="h2" style={{ margin: 0 }}>{v}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{k}</div>
          </div>
        ))}
      </div>

      <div className="plate" style={{ padding: '6px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', padding: '10px 0 4px' }}>Что проверить на этой неделе</div>
        {checks.map((c, i) => (
          <button key={i} onClick={() => c.go && ctx.go({ name: 'admin', id: c.go })} style={{ display: 'flex', gap: 10, alignItems: 'center', width: '100%', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', padding: '10px 0', borderTop: i ? '1px solid var(--divider)' : 'none', fontSize: 13 }}>
            <span aria-hidden="true" style={{ width: 22, height: 22, borderRadius: '50%', flex: 'none', display: 'grid', placeItems: 'center', fontSize: 12, background: c.ok ? '#DDF1D3' : '#FFE9B8', color: c.ok ? '#3A7D2C' : '#9A5B00' }}>{c.ok ? '✓' : '!'}</span>
            <span style={{ flex: 1 }}>{c.text}</span>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button className="btn-primary" onClick={() => ctx.go({ name: 'admin', id: 'new-card' })}>+ Карточка</button>
        <button className="btn-primary" onClick={() => ctx.go({ name: 'admin', id: 'new-event' })}>+ Событие</button>
        <button className="btn-primary" onClick={() => ctx.go({ name: 'admin', id: 'new-route' })}>+ Маршрут</button>
      </div>

      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: desk ? '1fr 1fr' : '1fr' }}>
        <MenuRow title="Карточки" text={`${IDEAS.length} шт. Колода недели, картинки, сюрпризы.`} onClick={() => ctx.go({ name: 'admin', id: 'cards' })} />
        <MenuRow title="Афиша" text={`${EVENTS.length} событий. По дням и списком, с фото и рекламой.`} onClick={() => ctx.go({ name: 'admin', id: 'events' })} />
        <MenuRow title="Маршруты" text={`${ROUTES.length} шт. Точки, фото, карта.`} onClick={() => ctx.go({ name: 'admin', id: 'routes' })} />
        <MenuRow title="Заметки на полях" text={`${NOTES.length} опубликовано.`} badge={pending ? `${pending} на проверке` : undefined} onClick={() => ctx.go({ name: 'admin', id: 'notes' })} />
        <MenuRow title="Подписка и лимит" text={`Цены, бесплатных намёков: ${getFreeHints()}.`} onClick={() => ctx.go({ name: 'admin', id: 'plans' })} />
        <MenuRow title="Намёки" text={`Всего ${ctx.hints.length}, входящих ${inN}.`} onClick={() => ctx.go({ name: 'admin', id: 'stats' })} />
        <MenuRow title="Данные" text="Копия всех правок, восстановление, сброс." onClick={() => ctx.go({ name: 'admin', id: 'data' })} />
      </div>
      <div className="plate" style={{ marginTop: 18, padding: 16, fontSize: 12, lineHeight: '16px', color: 'var(--text-2)' }}>
        <b style={{ color: 'var(--text)' }}>Это прототип.</b> Правки хранятся в этом браузере и видны только на этом устройстве. Сделайте копию на странице «Данные». В боевой версии данные лежат на сервере, роль проверяет сервер по подписи Telegram, а сюрпризы никогда не попадают в код приложения.
      </div>
      {!desk && <button className="btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => { ctx.setProfile({ ...ctx.profile, isAdmin: false }); ctx.go({ name: 'profile' }); }}>Выйти из админки</button>}
    </Shell>
  );
}

/* ---------- подписка ---------- */
function PlansForm({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(PLANS.map((p) => [p.id, String(parseMoney(p.price))])));
  const [free, setFree] = useState(getFreeHints());
  const ok = PLANS.every((p) => parseMoney(vals[p.id]) >= 1);
  return (
    <Shell ctx={ctx} title="Подписка и лимит" narrow={520} back={!desk}>
      {PLANS.map((p) => (
        <Field key={p.id} id={`plan-${p.id}`} label={`${p.title}, ₽`}>
          <input id={`plan-${p.id}`} className="input" inputMode="numeric" value={vals[p.id]} onChange={(e) => setVals((v) => ({ ...v, [p.id]: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
        </Field>
      ))}
      <Field id="free" label="Бесплатных намёков" hint="Сколько намёков можно отправить без подписки. После этого появится шторка с подпиской.">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button className="round-icon-btn" aria-label="Меньше" onClick={() => setFree((n) => Math.max(0, n - 1))} style={{ fontSize: 20 }}>−</button>
          <b id="free" style={{ minWidth: 28, textAlign: 'center', fontSize: 18 }}>{free}</b>
          <button className="round-icon-btn" aria-label="Больше" onClick={() => setFree((n) => Math.min(20, n + 1))} style={{ fontSize: 20 }}>+</button>
        </div>
      </Field>
      <button className="btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={!ok}
        onClick={() => save({ ...a, plans: Object.fromEntries(PLANS.map((p) => [p.id, parseMoney(vals[p.id])])), freeHints: free })}>
        Сохранить
      </button>
      <p style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 10 }}>Сейчас: {PLANS.map((p) => `${p.title} ${money(parseMoney(p.price))}`).join(', ')}.</p>
    </Shell>
  );
}

/* ---------- данные: копия, восстановление, сброс ---------- */
function DataPage({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const desk = useDesk();
  const a = ctx.admin;
  const fileRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [usage, setUsage] = useState<string>('');
  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => { if (e.usage) setUsage(`${(e.usage / 1048576).toFixed(1)} МБ`); }).catch(() => {});
  }, [a]);
  const counts: [string, number][] = [
    ['Свои карточки', a.added.length], ['Правки встроенных карточек', Object.keys(a.ideas).length], ['Свои события', a.eventsAdded.length],
    ['Правки встроенных событий', Object.keys(a.eventEdits).length], ['Свои маршруты', a.routesAdded.length], ['Правки встроенных маршрутов', Object.keys(a.routeEdits).length],
    ['Свои заметки', a.notesAdded.length], ['Заявки на заметки', a.notesPending.length],
  ];
  const download = () => {
    const url = URL.createObjectURL(new Blob([adminToJson(a)], { type: 'application/json' }));
    const el = document.createElement('a');
    el.href = url; el.download = `todate-admin-${new Date().toISOString().slice(0, 10)}.json`; el.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const upload = async (f?: File) => {
    if (!f) return;
    setErr('');
    if (f.size > 100 * 1024 * 1024) { setErr('Файл слишком большой.'); return; }
    const next = adminFromJson(await f.text());
    if (!next) { setErr('Это не файл копии To Date. Нужен файл, который скачан отсюда же.'); return; }
    save(next, 'Копия восстановлена');
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <Shell ctx={ctx} title="Данные" narrow={620} back={!desk} sub="Правки лежат в этом браузере. Скачайте копию: так вы не потеряете их, если очистите браузер, и сможете открыть админку на другом устройстве.">
      <div className="plate" style={{ padding: '4px 16px', marginBottom: 6 }}>
        {counts.map(([k, v], n) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderTop: n ? '1px solid var(--divider)' : 'none' }}><span>{k}</span><b>{v}</b></div>
        ))}
        {usage && <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontSize: 13, borderTop: '1px solid var(--divider)' }}><span>Занято в браузере</span><b>{usage}</b></div>}
      </div>
      <SectionTitle>Копия</SectionTitle>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="btn-primary" onClick={download}>Скачать копию</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => upload(e.target.files?.[0])} />
        <button className="btn-ghost" onClick={() => fileRef.current?.click()}>Восстановить из файла</button>
      </div>
      {err && <div role="alert" style={{ fontSize: 12, color: '#C23B3B', marginTop: 8 }}>{err}</div>}
      <SectionTitle>Сброс</SectionTitle>
      <p style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', margin: '0 0 10px' }}>Вернёт приложение к исходным данным: свои карточки, события, маршруты и заметки будут удалены.</p>
      <DangerButton label="Сбросить все правки" confirm="Да, сбросить всё" onConfirm={() => save(emptyAdmin(), 'Все правки сброшены')} />
    </Shell>
  );
}
