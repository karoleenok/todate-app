/* Админка: карточки идей. Колода недели (первые четыре) и остальная картотека, редактор с предпросмотром. */
import { useState } from 'react';
import type { AppCtx } from './App';
import { CATEGORIES, IDEAS, cardSrc, categoryLabel, type Category, type Idea } from './data';
import { BASE, newId, type AdminState, type IdeaPatch } from './store';
import { SingleCard } from './screens';
import { Chips, DangerButton, EditLayout, Empty, Field, ImageField, Preview, SectionTitle, Shell, Tag, area, useDesk } from './adminUi';

const CARD_IMG = { w: 795, h: 1365, q: 0.86, radius: 64, strict: true } as const;

function Tile({ idea, n, onOpen, onMove, last }: { idea: Idea; n?: number; onOpen: () => void; onMove: (d: -1 | 1) => void; last: boolean }) {
  return (
    <div className="adm-tilebox">
      <button className="adm-card" onClick={onOpen} aria-label={`Открыть: ${idea.title}`}>
        <span style={{ position: 'relative', display: 'block', aspectRatio: '795 / 1365', borderRadius: 18, background: 'var(--bg)', overflow: 'hidden' }}>
          {idea.image
            ? <img src={cardSrc(idea.image)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            : <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 12, fontSize: 12, textAlign: 'center', background: '#F6B3E3' }}>{idea.title}</span>}
          {n !== undefined && <span className="adm-badge">{n}</span>}
        </span>
        <span style={{ fontSize: 12, lineHeight: '16px', marginTop: 8, textAlign: 'left', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as React.CSSProperties}>{idea.title}</span>
        <span style={{ display: 'block', marginTop: 6 }}><Tag tone="blue">{categoryLabel(idea.category)}</Tag></span>
      </button>
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button className="adm-mini" aria-label="Сдвинуть раньше" onClick={() => onMove(-1)}>←</button>
        <button className="adm-mini" aria-label="Сдвинуть позже" disabled={last} onClick={() => onMove(1)}>→</button>
      </div>
    </div>
  );
}

export function CardsList({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const hiddenBuiltIn = BASE.ideas.filter((i) => a.hidden.includes(i.id));
  const move = (index: number, d: -1 | 1) => {
    const ids = IDEAS.map((i) => i.id);
    const to = index + d;
    if (to < 0 || to >= ids.length) return;
    [ids[index], ids[to]] = [ids[to], ids[index]];
    save({ ...a, order: ids }, 'Порядок сохранён');
  };
  const deck = IDEAS.slice(0, 4), rest = IDEAS.slice(4);
  return (
    <Shell
      ctx={ctx} title="Карточки" back={!desk}
      sub="Первые четыре карточки стоят в колоде на главной. Остальные видны только в сетке «Все карточки». Стрелками меняйте порядок."
      actions={<button className="btn-primary" onClick={() => ctx.go({ name: 'admin', id: 'new-card' })}>+ Добавить карточку</button>}
    >
      <SectionTitle right={<Tag tone={deck.length === 4 ? 'green' : 'amber'}>{deck.length} из 4</Tag>}>Колода недели</SectionTitle>
      {deck.length === 0 && <Empty title="Колода пуста" text="Добавьте карточку: она встанет в колоду на главной." />}
      <div className="adm-tiles">
        {deck.map((i, k) => <Tile key={i.id} idea={i} n={k + 1} last={k === IDEAS.length - 1} onOpen={() => ctx.go({ name: 'admin', id: `c:${i.id}` })} onMove={(d) => move(k, d)} />)}
      </div>
      <SectionTitle right={<Tag>{rest.length}</Tag>}>Картотека</SectionTitle>
      {rest.length === 0
        ? <Empty title="Больше карточек нет" text="Новые карточки появятся здесь. Стрелками можно поставить любую из них в колоду." />
        : (
          <div className="adm-tiles">
            {rest.map((i, k) => <Tile key={i.id} idea={i} last={k + 4 === IDEAS.length - 1} onOpen={() => ctx.go({ name: 'admin', id: `c:${i.id}` })} onMove={(d) => move(k + 4, d)} />)}
          </div>
        )}
      {hiddenBuiltIn.length > 0 && (
        <>
          <SectionTitle>Скрытые</SectionTitle>
          <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
            {hiddenBuiltIn.map((i) => (
              <div key={i.id} className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                <span style={{ flex: 1, fontSize: 13, lineHeight: '17px' }}>{i.title}</span>
                <button className="btn-ghost" onClick={() => save({ ...a, hidden: a.hidden.filter((x) => x !== i.id) }, 'Карточка снова в приложении')}>Вернуть</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

export function CardEditor({ ctx, id, save }: { ctx: AppCtx; id: string; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const isNew = id === 'new-card';
  const realId = id.slice(2);
  const base = isNew ? undefined : IDEAS.find((i) => i.id === realId);
  const [f, setF] = useState({
    title: base?.title ?? '', duration: base?.duration ?? 'от 30 мин', price: base?.price ?? 'от 600 ₽', metro: base?.metro ?? '',
    place: base?.place ?? '', address: base?.address ?? '', description: base?.description ?? '', secret: base?.secret ?? '',
  });
  const [cat, setCat] = useState<Category>(base?.category ?? 'еда');
  const [img, setImg] = useState<string | undefined>(base?.image);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));

  if (!isNew && !base) return <Shell ctx={ctx} title="Не найдено" back><p style={{ fontSize: 13 }}>Карточки нет или она скрыта.</p></Shell>;

  const valid = f.title.trim().length >= 3 && (!isNew || !!img);
  const clean = (): IdeaPatch => ({
    title: f.title.trim(), duration: f.duration.trim(), price: f.price.trim(), metro: f.metro.trim() || undefined,
    place: f.place.trim() || undefined, address: f.address.trim() || undefined, description: f.description.trim() || undefined,
    secret: f.secret.trim() || undefined, category: cat, image: img,
  });
  const isAdded = !!base && a.added.some((i) => i.id === base.id);
  const submit = () => {
    if (isNew) {
      const idea: Idea = { id: newId('c'), shape: 'sun', ...clean() } as Idea;
      save({ ...a, added: [...a.added, idea], order: [...IDEAS.map((i) => i.id), idea.id] }, 'Карточка добавлена в картотеку');
    } else if (isAdded) {
      save({ ...a, added: a.added.map((i) => (i.id === base!.id ? ({ ...i, ...clean() } as Idea) : i)) });
    } else {
      save({ ...a, ideas: { ...a.ideas, [base!.id]: clean() } });
    }
    ctx.back();
  };
  const remove = () => {
    if (!base) return;
    if (isAdded) save({ ...a, added: a.added.filter((i) => i.id !== base.id), order: a.order.filter((x) => x !== base.id) }, 'Карточка удалена');
    else save({ ...a, hidden: [...a.hidden, base.id] }, 'Карточка скрыта. Вернуть можно на странице «Карточки»');
    ctx.back();
  };

  const draft: Idea = { id: 'draft', shape: base?.shape ?? 'sun', ...clean() } as Idea;
  const form = (
    <div className={desk ? 'adm-form' : undefined}>
      <ImageField id="c-img" label="Картинка карточки" opts={CARD_IMG} value={img} onChange={setImg} src={cardSrc} previewW={66}
        hint="PNG, JPG или WebP, пропорции 795×1365 (как в Figma). Скруглённые углы добавим сами. Без картинки карточка рисуется из заголовка." />
      <Field id="c-cat" wide label="Категория"><Chips options={CATEGORIES} value={cat} onChange={setCat} /></Field>
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
        <button className="btn-primary" disabled={!valid} onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
        {!isNew && (
          <DangerButton label={isAdded ? 'Удалить карточку' : 'Скрыть карточку'} confirm={isAdded ? 'Да, удалить' : 'Да, скрыть'} onConfirm={remove} />
        )}
        {isNew && !img && <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>Для новой карточки нужна картинка.</span>}
      </div>
    </div>
  );

  const preview = (
    <Preview>
      <div style={{ padding: '6px 0 10px' }}>
        <SingleCard idea={draft} height={380} />
        <div style={{ padding: '0 24px' }}>
          <div className="h2" style={{ margin: '14px 0 0' }}>{f.title || 'Заголовок карточки'}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 10 }}>
            <span className="param">{f.duration || '—'}</span>
            <span className="param">{f.price || '—'}</span>
            {f.metro && <span className="param">{f.metro}</span>}
          </div>
          {(f.place || f.address) && <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 8 }}>{[f.place, f.address].filter(Boolean).join(', ')}</div>}
          {f.description && <p style={{ fontSize: 13, lineHeight: '17px', margin: '10px 0 0' }}>{f.description}</p>}
          <div className="plate" style={{ marginTop: 14, padding: '12px 16px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)' }}>Что увидит получатель намёка</div>
            <div style={{ fontSize: 13, lineHeight: '17px', marginTop: 4 }}>{f.secret || 'Сюрприз пока не написан.'}</div>
          </div>
        </div>
      </div>
    </Preview>
  );

  return (
    <Shell ctx={ctx} title={isNew ? 'Новая карточка' : 'Карточка'} back sub={categoryLabel(cat)}>
      <EditLayout form={form} preview={preview} />
    </Shell>
  );
}
