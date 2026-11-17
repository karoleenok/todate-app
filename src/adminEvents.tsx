/* Админка: афиша. Неделя по дням, список, полноценный редактор события с предпросмотром. */
import { useState } from 'react';
import type { AppCtx } from './App';
import { EVENTS, EVENT_CATEGORIES, eventSrc, type CityEvent, type EventCategory } from './data';
import { weekInfo } from './links';
import { BASE, BASE_EVENT_IDS, defaultHue, eventWhen, newId, offsetFromDate, safeLink, type AdminState } from './store';
import { EventDetailBody, EventPick, EventRow } from './screens';
import { Chips, DangerButton, EditLayout, Empty, Field, ImageField, Preview, Shell, Tag, ToggleRow, area, useDesk } from './adminUi';

const EVENT_IMG = { w: 1000, h: 800, q: 0.82 } as const;

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const mondayOf = (now = new Date()) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate()); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const eventISO = (e: CityEvent) => e.date ?? iso(addDays(mondayOf(), e.dayOffset));
const longDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }); };
const DOW = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const WHEN_TAG = { now: null, past: <Tag>Прошло</Tag>, later: <Tag tone="blue">Позже</Tag> } as const;

function Thumb({ e, size = 40 }: { e: CityEvent; size?: number }) {
  return e.photo
    ? <img src={eventSrc(e.photo)} alt="" style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flex: 'none', display: 'block' }} />
    : <span style={{ width: size, height: size, borderRadius: 10, flex: 'none', background: `hsl(${e.hue} 70% 82%)`, display: 'block' }} />;
}

function Badges({ e }: { e: CityEvent }) {
  return (
    <>
      {e.pick && <Tag tone="pink">Выбор</Tag>}
      {e.sponsored && <Tag tone={e.erid ? 'amber' : 'pink'}>{e.erid ? 'Реклама' : 'Реклама без erid'}</Tag>}
      {WHEN_TAG[eventWhen(e)]}
    </>
  );
}

type Filter = 'all' | 'now' | 'later' | 'past' | 'hidden';

export function EventsList({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const [view, setView] = useState<'week' | 'list'>('week');
  const [shift, setShift] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const monday = addDays(mondayOf(), shift * 7);
  const hidden = BASE.events.filter((e) => a.eventsHidden.includes(e.id));
  const open = (e: CityEvent) => ctx.go({ name: 'admin', id: `e:${e.id}` });
  const add = (date?: string) => ctx.go({ name: 'admin', id: date ? `new-event:${date}` : 'new-event' });

  const inNow = EVENTS.filter((e) => eventWhen(e) === 'now').length;
  const sorted = [...EVENTS].sort((x, y) => eventISO(x).localeCompare(eventISO(y)) || x.time.localeCompare(y.time));
  const listed = filter === 'hidden' ? [] : sorted.filter((e) => filter === 'all' || eventWhen(e) === filter);

  const weekLabel = `${monday.getDate()} ${monday.toLocaleDateString('ru-RU', { month: 'long' })} – ${addDays(monday, 6).getDate()} ${addDays(monday, 6).toLocaleDateString('ru-RU', { month: 'long' })}`;
  const today = iso(new Date());

  return (
    <Shell
      ctx={ctx} title="Афиша" back={!desk}
      sub="Приложение показывает события текущей недели. Событие на другую неделю появится само в её понедельник."
      actions={<button className="btn-primary" onClick={() => add()}>+ Добавить событие</button>}
    >
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 18 }}>
        <Chips options={[{ key: 'week', label: 'По дням' }, { key: 'list', label: 'Список' }]} value={view} onChange={setView} />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
          В афише сейчас: <b style={{ color: 'var(--text)' }}>{inNow}</b>
          {inNow === 0 && <span style={{ color: '#B7791F' }}> · афиша недели пуста</span>}
        </span>
      </div>

      {view === 'week' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <button className="adm-mini" aria-label="Прошлая неделя" onClick={() => setShift((s) => s - 1)}>←</button>
            <b style={{ fontSize: 14, minWidth: 190, textAlign: 'center' }}>{weekLabel}{shift === 0 ? ' · эта неделя' : ''}</b>
            <button className="adm-mini" aria-label="Следующая неделя" onClick={() => setShift((s) => s + 1)}>→</button>
            {shift !== 0 && <button className="link-btn" onClick={() => setShift(0)}>К этой неделе</button>}
          </div>
          <div className="adm-week">
            {DOW.map((n, i) => {
              const d = addDays(monday, i), key = iso(d);
              const items = sorted.filter((e) => eventISO(e) === key);
              return (
                <div key={key} className={`adm-day ${key === today ? 'today' : ''}`}>
                  <div className="adm-day-h">
                    <span><b>{n}</b> {d.getDate()}</span>
                    <button className="adm-mini" aria-label={`Добавить событие на ${key}`} onClick={() => add(key)}>+</button>
                  </div>
                  {items.length === 0 && <div style={{ fontSize: 11, color: 'var(--text-2)', padding: '6px 2px' }}>Пусто</div>}
                  {items.map((e) => (
                    <button key={e.id} className="adm-ev" onClick={() => open(e)}>
                      <Thumb e={e} />
                      <span style={{ minWidth: 0, textAlign: 'left' }}>
                        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--primary-dark)' }}>{e.time}</span>
                        <span style={{ fontSize: 12, lineHeight: '15px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{e.title}</span>
                        <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}><Badges e={e} /></span>
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <div style={{ marginBottom: 14 }}>
            <Chips<Filter>
              options={[{ key: 'all', label: 'Все' }, { key: 'now', label: 'В афише' }, { key: 'later', label: 'Позже' }, { key: 'past', label: 'Прошли' }, { key: 'hidden', label: `Скрытые (${hidden.length})` }]}
              value={filter} onChange={setFilter}
            />
          </div>
          {filter !== 'hidden' && listed.length === 0 && (
            <Empty title="Здесь пока пусто" text="Добавьте событие: можно с фото, описанием, ссылкой партнёра и пометкой «Реклама»." action={<button className="btn-primary" onClick={() => add()}>+ Добавить событие</button>} />
          )}
          <div style={{ display: 'grid', gap: 8 }}>
            {listed.map((e) => (
              <button key={e.id} className="plate adm-row" onClick={() => open(e)}>
                <Thumb e={e} size={52} />
                <span style={{ minWidth: 0, textAlign: 'left' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>{e.title}</span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{e.place} · {e.price}</span>
                </span>
                <span style={{ fontSize: 12, textAlign: 'left' }}>{longDate(eventISO(e))}<br />{e.time}</span>
                <span style={{ fontSize: 12, textAlign: 'left' }}>{EVENT_CATEGORIES.find((c) => c.key === e.category)?.label}</span>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}><Badges e={e} /></span>
              </button>
            ))}
            {filter === 'hidden' && hidden.length === 0 && <Empty title="Скрытых нет" text="Скрытые события можно вернуть отсюда." />}
            {filter === 'hidden' && hidden.map((e) => (
              <div key={e.id} className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{e.title}</span>
                <button className="btn-ghost" onClick={() => save({ ...a, eventsHidden: a.eventsHidden.filter((x) => x !== e.id) }, 'Событие снова в афише')}>Вернуть</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

export function EventEditor({ ctx, id, save }: { ctx: AppCtx; id: string; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const isNew = id.startsWith('new-event');
  const base = isNew ? undefined : EVENTS.find((e) => e.id === id.slice(2));
  const dateParam = isNew ? id.split(':')[1] : undefined;
  const startDate = base ? eventISO(base) : dateParam ?? iso(new Date());

  const [f, setF] = useState({
    title: base?.title ?? '', date: startDate, time: base?.time ?? '19:00', price: base?.price ?? 'бесплатно', place: base?.place ?? '',
    description: base?.description ?? '', link: base?.link ?? '', advertiser: base?.advertiser ?? '', erid: base?.erid ?? '',
  });
  const [cat, setCat] = useState<EventCategory>(base?.category ?? 'музыка');
  const [photo, setPhoto] = useState<string | undefined>(base?.photo);
  const [pick, setPick] = useState(!!base?.pick);
  const [ad, setAd] = useState(!!base?.sponsored);
  const [tab, setTab] = useState<'row' | 'pick' | 'sheet'>('row');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  if (!isNew && !base) return <Shell ctx={ctx} title="Не найдено" back><p style={{ fontSize: 13 }}>События нет или оно скрыто.</p></Shell>;

  const off = offsetFromDate(f.date);
  const linkOk = !f.link.trim() || !!safeLink(f.link);
  const valid = f.title.trim().length >= 3 && f.place.trim().length >= 2 && off !== undefined && /^\d{2}:\d{2}$/.test(f.time) && linkOk;
  const build = (eid: string): CityEvent => ({
    id: eid, title: f.title.trim(), date: f.date, dayOffset: off ?? 0, time: f.time, price: f.price.trim() || 'бесплатно', place: f.place.trim(),
    category: cat, description: f.description.trim(), hue: defaultHue(cat), pick, photo, link: f.link.trim() || undefined,
    sponsored: ad, advertiser: ad ? f.advertiser.trim() || undefined : undefined, erid: ad ? f.erid.trim() || undefined : undefined,
  });
  const isAdded = !!base && a.eventsAdded.some((e) => e.id === base.id);
  const patchOf = (e: CityEvent) => { const { id: _id, ...rest } = e; void _id; return rest; };

  const submit = () => {
    if (isNew) save({ ...a, eventsAdded: [...a.eventsAdded, build(newId('e'))] }, 'Событие добавлено');
    else if (isAdded) save({ ...a, eventsAdded: a.eventsAdded.map((e) => (e.id === base!.id ? build(e.id) : e)) });
    else save({ ...a, eventEdits: { ...a.eventEdits, [base!.id]: patchOf(build(base!.id)) } });
    ctx.back();
  };
  const copyNextWeek = () => {
    const [y, m, d] = f.date.split('-').map(Number);
    const next = iso(addDays(new Date(y, m - 1, d), 7));
    const copy = { ...build(newId('e')), date: next, dayOffset: offsetFromDate(next) ?? 0 };
    save({ ...a, eventsAdded: [...a.eventsAdded, copy] }, `Копия создана на ${longDate(next)}`);
    ctx.go({ name: 'admin', id: `e:${copy.id}` });
  };
  const remove = () => {
    if (!base) return;
    if (isAdded) save({ ...a, eventsAdded: a.eventsAdded.filter((e) => e.id !== base.id) }, 'Событие удалено');
    else save({ ...a, eventsHidden: [...a.eventsHidden, base.id] }, 'Событие скрыто. Вернуть можно в списке «Скрытые»');
    ctx.back();
  };

  const draft = build('draft');
  const when = off === undefined ? null : eventWhen(draft);
  const startOfWeek = off === undefined ? null : addDays(mondayOf(), Math.floor(off / 7) * 7);
  const whenText = off === undefined || !startOfWeek ? 'Укажите дату.'
    : when === 'now' ? 'Попадёт в афишу этой недели.'
    : when === 'past' ? 'Дата уже прошла: в афише не покажется.'
    : `Появится в афише с понедельника, ${startOfWeek.getDate()} ${startOfWeek.toLocaleDateString('ru-RU', { month: 'long' })}.`;

  const form = (
    <div className={desk ? 'adm-form' : undefined}>
      <ImageField id="e-img" label="Фото события" opts={EVENT_IMG} value={photo} onChange={setPhoto} src={eventSrc} previewW={96}
        hint="PNG, JPG или WebP. Обрежем по центру до 5:4 и ужмём. Без фото покажется цветная заглушка." />
      <Field id="e-title" wide label="Название"><input id="e-title" className="input" value={f.title} onChange={set('title')} maxLength={120} /></Field>
      <Field id="e-date" label="Дата" hint={whenText}><input id="e-date" type="date" className="input" value={f.date} onChange={set('date')} /></Field>
      <Field id="e-time" label="Время"><input id="e-time" type="time" className="input" value={f.time} onChange={set('time')} /></Field>
      <Field id="e-place" label="Место"><input id="e-place" className="input" placeholder="Название площадки" value={f.place} onChange={set('place')} maxLength={80} /></Field>
      <Field id="e-price" label="Цена"><input id="e-price" className="input" placeholder="бесплатно или от 500 ₽" value={f.price} onChange={set('price')} maxLength={30} /></Field>
      <Field id="e-cat" wide label="Категория"><Chips options={EVENT_CATEGORIES} value={cat} onChange={setCat} /></Field>
      <Field id="e-desc" wide label="Описание"><textarea id="e-desc" style={area} value={f.description} onChange={set('description')} maxLength={500} /></Field>
      <Field id="e-link" wide label="Ссылка «Подробнее»" hint={linkOk ? 'Страница партнёра: сайт, канал, афиша. Только https://' : undefined}>
        <input id="e-link" className="input" placeholder="https://" value={f.link} onChange={set('link')} maxLength={300} aria-invalid={!linkOk} />
        {!linkOk && <div role="alert" style={{ fontSize: 12, color: '#C23B3B', marginTop: 5 }}>Ссылка должна начинаться с https://</div>}
      </Field>
      <ToggleRow title="Выбор To Date" text="Событие попадёт в крупный блок вверху афиши." on={pick} onChange={setPick} />
      <ToggleRow title="Реклама партнёра" text="Платное размещение. По закону нужна пометка «Реклама», рекламодатель и erid." on={ad} onChange={setAd} />
      {ad && (
        <>
          <Field id="e-adv" label="Рекламодатель"><input id="e-adv" className="input" placeholder="ООО «Название» или ИП, ИНН" value={f.advertiser} onChange={set('advertiser')} maxLength={120} /></Field>
          <Field id="e-erid" label="erid" hint="Токен из ОРД (оператора рекламных данных)."><input id="e-erid" className="input" value={f.erid} onChange={set('erid')} maxLength={80} /></Field>
          {(!f.advertiser.trim() || !f.erid.trim()) && (
            <div className="wide" role="alert" style={{ fontSize: 12, lineHeight: '16px', color: '#9A5B00', background: '#FFF4DB', borderRadius: 16, padding: '10px 14px' }}>
              Без рекламодателя и erid такое событие публиковать нельзя: это нарушение закона о рекламе.
            </div>
          )}
        </>
      )}
      <div className="wide adm-actions">
        <button className="btn-primary" disabled={!valid} onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
        {!isNew && <button className="btn-ghost" disabled={!valid} onClick={copyNextWeek}>Повторить через неделю</button>}
        {!isNew && <DangerButton label={isAdded ? 'Удалить' : 'Скрыть'} confirm={isAdded ? 'Да, удалить' : 'Да, скрыть'} onConfirm={remove} />}
      </div>
    </div>
  );

  const day = weekInfo().day(draft.dayOffset);
  const preview = (
    <Preview
      tabs={<Chips options={[{ key: 'row', label: 'В списке' }, { key: 'pick', label: 'Выбор' }, { key: 'sheet', label: 'Шторка' }]} value={tab} onChange={setTab} />}
    >
      {tab === 'row' && (
        <div style={{ padding: '18px 20px 22px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, padding: '0 10px' }}>{day.short}</div>
          <EventRow e={draft} />
        </div>
      )}
      {tab === 'pick' && (
        <div style={{ padding: '18px 20px 22px' }}>
          <h2 className="h2" style={{ margin: '0 0 14px 10px' }}>Выбор To Date</h2>
          <EventPick e={draft} />
          {!pick && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 12, padding: '0 10px' }}>Сейчас переключатель «Выбор To Date» выключен: в этом блоке события не будет.</div>}
        </div>
      )}
      {tab === 'sheet' && (
        <div style={{ background: 'var(--surface)', borderRadius: '40px 40px 0 0', padding: '14px 30px 28px', marginTop: 40 }}>
          <div className="sheet-handle" style={{ position: 'static', margin: '0 auto 14px' }} />
          <EventDetailBody e={draft} />
          <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
            <span className="btn-primary">Позвать на свидание</span>
            <span className="btn-ghost">Открыть в Яндекс Картах</span>
            <span className="btn-ghost">Подробнее</span>
          </div>
        </div>
      )}
    </Preview>
  );

  return (
    <Shell ctx={ctx} title={isNew ? 'Новое событие' : 'Событие'} back sub={BASE_EVENT_IDS.has(base?.id ?? '') ? 'Встроенное событие: правки сохраняются поверх исходного.' : undefined}>
      <EditLayout form={form} preview={preview} />
    </Shell>
  );
}
