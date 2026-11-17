/* Админка. Грузится отдельным куском и только когда включён режим админа.
   В прототипе роль хранится в профиле. В боевой версии роль определяет сервер по подписи Telegram (initData),
   а флаг в браузере ничего не значит. */
import React, { createContext, useContext, useRef, useState } from 'react';
import type { AppCtx } from './App';
import { CATEGORIES, EVENTS, IDEAS, PLANS, cardSrc, type Category, type Idea } from './data';
import { getFreeHints, money, parseMoney, type AdminState, type IdeaPatch } from './store';
import { IconChevron, Logo } from './ui';

const px: React.CSSProperties = { padding: '0 30px' };

/* true, когда админка открыта на ПК (широкий экран): боковое меню и просторные формы */
const DeskCtx = createContext(false);

function Shell({ ctx, title, sub, children, back, narrow }: { ctx: AppCtx; title: string; sub?: string; children: React.ReactNode; back?: boolean; narrow?: number }) {
  const desk = useContext(DeskCtx);
  if (desk) {
    return (
      <div>
        {back && <button className="link-btn" style={{ padding: '4px 0 12px', fontSize: 13 }} onClick={() => ctx.back()}>← Назад</button>}
        <h1 className="h1" style={{ margin: 0 }}>{title}</h1>
        {sub && <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-2)', margin: '10px 0 0', maxWidth: 560 }}>{sub}</p>}
        <div style={{ marginTop: 28, maxWidth: narrow }}>{children}</div>
      </div>
    );
  }
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10, minHeight: '60dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          {back && (
            <button className="link-btn" style={{ padding: '4px 0 10px', fontSize: 12 }} onClick={() => ctx.back()}>← Назад</button>
          )}
          <h1 className="h1" style={{ margin: 0 }}>{title}</h1>
          {sub && <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '8px 0 0', maxWidth: 330 }}>{sub}</p>}
        </div>
        <div style={{ ...px, marginTop: 18 }}>{children}</div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

function Field({ label, hint, children, id, wide }: { label: string; hint?: string; children: React.ReactNode; id: string; wide?: boolean }) {
  return (
    <div className={wide ? 'wide' : undefined} style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

const area: React.CSSProperties = {
  width: '100%', minHeight: 92, borderRadius: 20, border: '1px solid #B4B5B6', background: 'var(--surface)',
  padding: '12px 16px', fontSize: 13, lineHeight: '18px', fontFamily: 'inherit', resize: 'vertical', outline: 'none',
};

function MenuRow({ title, text, onClick }: { title: string; text: string; onClick: () => void }) {
  return (
    <button className="plate" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', textAlign: 'left', cursor: 'pointer', padding: '14px 16px' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>{title}</span>
        <span style={{ display: 'block', fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 2 }}>{text}</span>
      </span>
      <span style={{ color: 'var(--stroke)', flex: 'none' }}><IconChevron /></span>
    </button>
  );
}

/* Картинка карточки: проверяем тип и размер, приводим к 795×1365 и скругляем углы, кодируем в WebP.
   На сервере то же самое делается ещё раз: тип по содержимому, лимит размера, SVG не принимаем. */
async function prepareCard(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Нужен PNG, JPG или WebP. SVG не принимаем.');
  if (file.size > 8 * 1024 * 1024) throw new Error('Файл больше 8 МБ.');
  const bmp = await createImageBitmap(file);
  const ratio = bmp.width / bmp.height;
  if (Math.abs(ratio - 795 / 1365) > 0.025) throw new Error(`Пропорции ${bmp.width}×${bmp.height} не подходят. Нужно 795×1365.`);
  const c = document.createElement('canvas');
  c.width = 795; c.height = 1365;
  const g = c.getContext('2d')!;
  g.beginPath();
  g.roundRect(0, 0, 795, 1365, 64);
  g.clip();
  g.drawImage(bmp, 0, 0, 795, 1365);
  return c.toDataURL('image/webp', 0.86);
}

export default function Admin({ ctx, id, desktop = false }: { ctx: AppCtx; id?: string; desktop?: boolean }) {
  if (!desktop) return <AdminBody ctx={ctx} id={id} />;
  return (
    <DeskCtx.Provider value={true}>
      <DeskFrame ctx={ctx} id={id}><AdminBody ctx={ctx} id={id} /></DeskFrame>
    </DeskCtx.Provider>
  );
}

const NAV: [string, string][] = [['home', 'Обзор'], ['cards', 'Карточки'], ['events', 'Афиша'], ['plans', 'Подписка и лимит'], ['stats', 'Намёки']];

function DeskFrame({ ctx, id, children }: { ctx: AppCtx; id?: string; children: React.ReactNode }) {
  const active = !id ? 'home' : id === 'new' || id.startsWith('c:') ? 'cards' : id;
  return (
    <div className="adm">
      <aside className="adm-side">
        <div style={{ padding: '4px 18px 22px' }}><Logo /></div>
        <nav aria-label="Разделы админки" style={{ display: 'grid', gap: 4 }}>
          {NAV.map(([k, label]) => (
            <button key={k} className="adm-nav" aria-current={active === k ? 'page' : undefined} onClick={() => ctx.go(k === 'home' ? { name: 'admin' } : { name: 'admin', id: k })}>{label}</button>
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
  const desk = useContext(DeskCtx);
  const a = ctx.admin;
  const save = (next: AdminState, msg = 'Сохранено') => { ctx.saveAdmin(next); ctx.toast(msg); };

  /* ---------- главная ---------- */
  if (!id) {
    const inN = ctx.hints.filter((h) => h.dir === 'in').length;
    return (
      <Shell ctx={ctx} title="Админка" narrow={desk ? 900 : undefined} sub="Здесь правим то, что видят пользователи. Сохранённое сразу попадает в приложение.">
        {desk && (
          <div className="adm-tiles" style={{ marginBottom: 20 }}>
            {([['Карточек', IDEAS.length], ['В «Выборе To Date»', EVENTS.filter((e) => e.pick).length], ['Намёков всего', ctx.hints.length], ['Услышано', ctx.hints.filter((h) => h.status === 'услышан').length]] as [string, number][]).map(([k, v]) => (
              <div key={k} className="plate" style={{ padding: '18px 20px' }}>
                <div className="h2" style={{ margin: 0 }}>{v}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6 }}>{k}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: desk ? '1fr 1fr' : '1fr' }}>
          <MenuRow title="Карточки" text={`${IDEAS.length} шт. Описание, метро, цена, длительность, место и сюрприз.`} onClick={() => ctx.go({ name: 'admin', id: 'cards' })} />
          <MenuRow title="Афиша: «Выбор To Date»" text={`${EVENTS.filter((e) => e.pick).length} из ${EVENTS.length} событий отмечено.`} onClick={() => ctx.go({ name: 'admin', id: 'events' })} />
          <MenuRow title="Подписка и лимит" text={`Цены, бесплатных намёков: ${getFreeHints()}.`} onClick={() => ctx.go({ name: 'admin', id: 'plans' })} />
          <MenuRow title="Намёки" text={`Всего ${ctx.hints.length}, входящих ${inN}.`} onClick={() => ctx.go({ name: 'admin', id: 'stats' })} />
        </div>
        <div className="plate" style={{ marginTop: 18, padding: 16, fontSize: 12, lineHeight: '16px', color: 'var(--text-2)' }}>
          <b style={{ color: 'var(--text)' }}>Это прототип.</b> Данные лежат в браузере, а роль админа включается переключателем в профиле. В боевой версии роль проверяет сервер по подписи Telegram, а сюрпризы хранятся только на сервере.
        </div>
        {!desk && <button className="btn-ghost" style={{ width: '100%', marginTop: 16 }} onClick={() => { ctx.setProfile({ ...ctx.profile, isAdmin: false }); ctx.go({ name: 'profile' }); }}>Выйти из админки</button>}
      </Shell>
    );
  }

  /* ---------- список карточек ---------- */
  if (id === 'cards') {
    return (
      <Shell ctx={ctx} title="Карточки" back={!desk}>
        <button className="btn-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => ctx.go({ name: 'admin', id: 'new' })}>Добавить карточку</button>
        {desk ? (
          <div className="adm-tiles">
            {IDEAS.map((i) => (
              <button key={i.id} className="adm-card" onClick={() => ctx.go({ name: 'admin', id: `c:${i.id}` })}>
                <span style={{ display: 'block', aspectRatio: '795 / 1365', borderRadius: 18, background: 'var(--bg)', overflow: 'hidden' }}>
                  {i.image && <img src={cardSrc(i.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </span>
                <span style={{ display: 'block', fontSize: 13, lineHeight: '17px', marginTop: 8, textAlign: 'left' }}>{i.title}</span>
              </button>
            ))}
          </div>
        ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {IDEAS.map((i) => (
            <button key={i.id} className="plate" onClick={() => ctx.go({ name: 'admin', id: `c:${i.id}` })} style={{ display: 'flex', alignItems: 'center', gap: 12, border: 'none', textAlign: 'left', cursor: 'pointer', padding: 10, width: '100%' }}>
              <span style={{ width: 44, height: 76, flex: 'none', borderRadius: 10, background: '#fff', overflow: 'hidden', display: 'block' }}>
                {i.image && <img src={cardSrc(i.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, lineHeight: '17px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{i.title}</span>
              <span style={{ color: 'var(--stroke)', flex: 'none' }}><IconChevron /></span>
            </button>
          ))}
        </div>
        )}
      </Shell>
    );
  }

  /* ---------- карточка: правка и создание ---------- */
  if (id === 'new' || id.startsWith('c:')) {
    return <CardForm key={id} ctx={ctx} id={id} save={save} />;
  }

  /* ---------- афиша ---------- */
  if (id === 'events') {
    return (
      <Shell ctx={ctx} title="Выбор To Date" narrow={720} sub="Отмеченные события появляются в афише в блоке «Выбор To Date».">
        <div style={{ display: 'grid', gap: 10 }}>
          {EVENTS.map((e) => {
            const on = !!e.pick;
            return (
              <div key={e.id} className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>{e.title}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{e.place} · {e.price}</span>
                </span>
                <button
                  role="switch" aria-checked={on} aria-label={`Выбор To Date: ${e.title}`}
                  onClick={() => save({ ...a, picks: { ...a.picks, [e.id]: !on } })}
                  style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', flex: 'none', position: 'relative', background: on ? 'var(--primary)' : '#C9CCD3', transition: 'background .15s ease' }}
                >
                  <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
                </button>
              </div>
            );
          })}
        </div>
      </Shell>
    );
  }

  /* ---------- подписка и лимит ---------- */
  if (id === 'plans') {
    return <PlansForm ctx={ctx} save={save} />;
  }

  /* ---------- намёки ---------- */
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

function PlansForm({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useContext(DeskCtx);
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
      <button
        className="btn-primary" style={{ width: '100%', marginTop: 6 }} disabled={!ok}
        onClick={() => save({ ...a, plans: Object.fromEntries(PLANS.map((p) => [p.id, parseMoney(vals[p.id])])), freeHints: free })}
      >
        Сохранить
      </button>
      <p style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 10 }}>Сейчас: {PLANS.map((p) => `${p.title} ${money(parseMoney(p.price))}`).join(', ')}.</p>
    </Shell>
  );
}

function CardForm({ ctx, id, save }: { ctx: AppCtx; id: string; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useContext(DeskCtx);
  const isNew = id === 'new';
  const base = isNew ? undefined : IDEAS.find((i) => i.id === id.slice(2));
  const [f, setF] = useState({
    title: base?.title ?? '', duration: base?.duration ?? 'от 30 мин', price: base?.price ?? 'от 600 ₽', metro: base?.metro ?? '',
    place: base?.place ?? '', address: base?.address ?? '', description: base?.description ?? '', secret: base?.secret ?? '',
  });
  const [cat, setCat] = useState<Category>(base?.category ?? 'еда');
  const [img, setImg] = useState<string | undefined>(base?.image);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  if (!isNew && !base) return <Shell ctx={ctx} title="Не найдено" back><p style={{ fontSize: 13 }}>Карточки нет или она скрыта.</p></Shell>;

  const valid = f.title.trim().length >= 3 && (!isNew || !!img);
  const clean = (): IdeaPatch => ({
    title: f.title.trim(), duration: f.duration.trim(), price: f.price.trim(), metro: f.metro.trim() || undefined,
    place: f.place.trim() || undefined, address: f.address.trim() || undefined, description: f.description.trim() || undefined, secret: f.secret.trim() || undefined,
  });
  const onFile = async (file?: File) => {
    if (!file) return;
    setErr('');
    try { setImg(await prepareCard(file)); } catch (e) { setErr(e instanceof Error ? e.message : 'Не получилось открыть файл.'); }
  };
  const submit = () => {
    if (isNew) {
      const idea: Idea = { id: `c${Date.now()}`, category: cat, shape: 'sun', image: img, ...clean() } as Idea;
      save({ ...a, added: [...a.added, idea] }, 'Карточка добавлена');
    } else {
      save({ ...a, ideas: { ...a.ideas, [base!.id]: clean() } });
    }
    ctx.back();
  };
  const remove = () => {
    if (!base) return;
    if (a.added.some((i) => i.id === base.id)) save({ ...a, added: a.added.filter((i) => i.id !== base.id) }, 'Карточка удалена');
    else save({ ...a, hidden: [...a.hidden, base.id] }, 'Карточка скрыта');
    ctx.back();
  };

  return (
    <Shell ctx={ctx} title={isNew ? 'Новая карточка' : 'Карточка'} sub={isNew ? undefined : 'Саму картинку не меняем. Правим то, что внутри открытой карточки.'} back>
      <div className={desk ? 'adm-form' : undefined}>
      {isNew && (
        <>
          <Field id="file" wide label="Картинка карточки" hint="PNG, JPG или WebP, пропорции 795×1365. Скруглённые углы добавим сами.">
            <input ref={fileRef} id="file" type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={{ width: 66, height: 113, borderRadius: 14, background: '#E9ECF1', overflow: 'hidden', flex: 'none' }}>
                {img && <img src={img} alt="Предпросмотр карточки" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
              </span>
              <button className="btn-ghost" style={{ height: 44 }} onClick={() => fileRef.current?.click()}>{img ? 'Заменить' : 'Выбрать файл'}</button>
            </div>
            {err && <div role="alert" style={{ fontSize: 12, lineHeight: '16px', color: '#C23B3B', marginTop: 8 }}>{err}</div>}
          </Field>
          <Field id="cat" wide label="Категория">
            <div className="row-scroll" role="radiogroup">
              {CATEGORIES.map((c) => (
                <button key={c.key} role="radio" aria-checked={cat === c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
              ))}
            </div>
          </Field>
        </>
      )}
      <Field id="f-title" wide label="Заголовок"><input id="f-title" className="input" value={f.title} onChange={set('title')} maxLength={160} /></Field>
      <div className="adm-pair" style={{ display: desk ? 'contents' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field id="f-dur" label="Длительность"><input id="f-dur" className="input" value={f.duration} onChange={set('duration')} maxLength={30} /></Field>
        <Field id="f-price" label="Цена"><input id="f-price" className="input" value={f.price} onChange={set('price')} maxLength={30} /></Field>
      </div>
      <Field id="f-metro" label="Метро"><input id="f-metro" className="input" placeholder="м. Площадь Восстания" value={f.metro} onChange={set('metro')} maxLength={50} /></Field>
      <Field id="f-place" label="Название места"><input id="f-place" className="input" value={f.place} onChange={set('place')} maxLength={80} /></Field>
      <Field id="f-addr" wide label="Адрес"><input id="f-addr" className="input" value={f.address} onChange={set('address')} maxLength={120} /></Field>
      <Field id="f-desc" wide label="Описание"><textarea id="f-desc" style={area} value={f.description} onChange={set('description')} maxLength={600} /></Field>
      <Field id="f-secret" wide label="Секрет для второй половинки" hint="Видит только получатель намёка. Отправитель не увидит его нигде. Текст выводим как простой текст.">
        <textarea id="f-secret" style={area} value={f.secret} onChange={set('secret')} maxLength={400} />
      </Field>
      <div className="wide adm-actions">
        <button className="btn-primary" style={{ width: '100%', marginTop: 4 }} disabled={!valid} onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
        {!isNew && <button className="btn-ghost" style={{ width: '100%', marginTop: 8 }} onClick={remove}>{a.added.some((i) => i.id === base!.id) ? 'Удалить карточку' : 'Скрыть карточку'}</button>}
      </div>
      </div>
    </Shell>
  );
}
