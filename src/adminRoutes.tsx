/* Админка: маршруты. Список по районам, редактор с точками, фото и расстановкой точек кликом по карте. */
import { Suspense, lazy, useState } from 'react';
import type { AppCtx } from './App';
import { DISTRICTS, ROUTES, placeSrc, type CityRoute } from './data';
import { BASE, baseGeo, buildGeo, hasCoords, newId, type AdminState } from './store';
import { PlacePhotos, RoutePhotoCard } from './screens';
import { Chips, DangerButton, EditLayout, Empty, Field, ImageField, MultiImageField, Preview, SectionTitle, Shell, Tag, ToggleRow, area, useDesk } from './adminUi';
import type { PickPoint } from './StreetMap';

const StreetMap = lazy(() => import('./StreetMap'));

const COVER_IMG = { w: 900, h: 900, q: 0.82 } as const;
const PLACE_IMG = { w: 1000, h: 750, q: 0.8 } as const;
const PRESET_TAGS = ['Пешком', 'Плохая погода', 'Бесплатно', 'Вечером', 'Днём', 'Романтика'];

const noop = () => {};
const hueOf = (t: string) => Array.from(t).reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

interface PtDraft { title: string; text: string; photos: string[]; lat?: number; lng?: number; raw: string }
const fmt = (lat?: number, lng?: number) => (typeof lat === 'number' && typeof lng === 'number' ? `${lat.toFixed(6)}, ${lng.toFixed(6)}` : '');
/** Понимает «59.934300, 30.335100» (так копирует Яндекс Карты) и просто два числа через пробел */
function parseCoords(raw: string): { lat: number; lng: number } | null {
  const m = /(-?\d{1,3}(?:[.,]\d+)?)[\s,;]+(-?\d{1,3}(?:[.,]\d+)?)/.exec(raw.trim());
  if (!m) return null;
  const lat = Number(m[1].replace(',', '.')), lng = Number(m[2].replace(',', '.'));
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}
const inSpb = (lat: number, lng: number) => lat > 59.6 && lat < 60.2 && lng > 29.6 && lng < 30.8;

export function RoutesList({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const hidden = BASE.routes.filter((r) => a.routesHidden.includes(r.id));
  const groups = [...DISTRICTS, ...Array.from(new Set(ROUTES.map((r) => r.district).filter((d) => !DISTRICTS.includes(d))))]
    .map((d) => ({ d, items: ROUTES.filter((r) => r.district === d) })).filter((g) => g.items.length > 0);
  return (
    <Shell
      ctx={ctx} title="Маршруты" back={!desk}
      sub="Маршруты по районам. Точки ставятся кликом по карте, фото и описание у каждой точки свои."
      actions={<button className="btn-primary" onClick={() => ctx.go({ name: 'admin', id: 'new-route' })}>+ Добавить маршрут</button>}
    >
      {ROUTES.length === 0 && <Empty title="Маршрутов пока нет" text="Добавьте первый: название, район, точки с фото и координатами." />}
      {groups.map((g) => (
        <div key={g.d}>
          <SectionTitle right={<Tag>{g.items.length}</Tag>}>{g.d}</SectionTitle>
          <div className="adm-routes">
            {g.items.map((r) => {
              const mapReady = !!buildGeo(r.points) || !!baseGeo(r.id);
              return (
                <div key={r.id} className="adm-tilebox" style={{ width: 196 }}>
                  <RoutePhotoCard r={r} onClick={() => ctx.go({ name: 'admin', id: `r:${r.id}` })} />
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 8 }}>
                    <Tag tone="blue">{r.points.length} точек</Tag>
                    <Tag tone={mapReady ? 'green' : 'amber'}>{mapReady ? 'Карта есть' : 'Нет карты'}</Tag>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {hidden.length > 0 && (
        <>
          <SectionTitle>Скрытые</SectionTitle>
          <div style={{ display: 'grid', gap: 8, maxWidth: 560 }}>
            {hidden.map((r) => (
              <div key={r.id} className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                <span style={{ flex: 1, fontSize: 13, lineHeight: '17px' }}>{r.title}</span>
                <button className="btn-ghost" onClick={() => save({ ...a, routesHidden: a.routesHidden.filter((x) => x !== r.id) }, 'Маршрут снова в приложении')}>Вернуть</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

export function RouteEditor({ ctx, id, save }: { ctx: AppCtx; id: string; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const isNew = id === 'new-route';
  const base = isNew ? undefined : ROUTES.find((r) => r.id === id.slice(2));
  const bg = base ? baseGeo(base.id) : undefined;

  const [f, setF] = useState({
    title: base?.title ?? '', short: base?.short ?? '', district: base?.district ?? DISTRICTS[0] ?? '', duration: base?.duration ?? '2 часа',
    price: base?.price ?? 'от 0 ₽', description: base?.description ?? '',
  });
  const [tags, setTags] = useState<string[]>(base?.tags ?? ['Пешком']);
  const [tagInput, setTagInput] = useState('');
  const [fav, setFav] = useState(!!base?.favorite);
  const [cover, setCover] = useState<string | undefined>(base?.cover);
  const [pts, setPts] = useState<PtDraft[]>(() =>
    (base?.points ?? [{ title: '', text: '' }]).map((p, i) => {
      const lat = p.lat ?? bg?.points[i]?.lat, lng = p.lng ?? bg?.points[i]?.lng;
      return { title: p.title, text: p.text, photos: p.photos ?? (p.photo ? [p.photo] : []), lat, lng, raw: fmt(lat, lng) };
    }),
  );
  const [active, setActive] = useState(0);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  const patchPt = (i: number, p: Partial<PtDraft>) => setPts((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)));

  if (!isNew && !base) return <Shell ctx={ctx} title="Не найдено" back><p style={{ fontSize: 13 }}>Маршрута нет или он скрыт.</p></Shell>;

  const onPick = (lat: number, lng: number) => {
    const la = Math.round(lat * 1e6) / 1e6, ln = Math.round(lng * 1e6) / 1e6;
    patchPt(active, { lat: la, lng: ln, raw: fmt(la, ln) });
    // после установки переходим к следующей точке без координат
    const nxt = pts.findIndex((p, k) => k > active && !hasCoords(p));
    if (nxt >= 0) setActive(nxt);
  };
  const onRaw = (i: number, raw: string) => {
    const c = parseCoords(raw);
    patchPt(i, c ? { raw, lat: c.lat, lng: c.lng } : { raw, lat: undefined, lng: undefined });
  };
  const move = (i: number, d: -1 | 1) => {
    const to = i + d;
    if (to < 0 || to >= pts.length) return;
    setPts((l) => { const n = [...l]; [n[i], n[to]] = [n[to], n[i]]; return n; });
    setActive(to);
  };
  const removePt = (i: number) => { setPts((l) => l.filter((_, k) => k !== i)); setActive(Math.max(0, Math.min(active, pts.length - 2))); };
  const addPt = () => { setPts((l) => [...l, { title: '', text: '', photos: [], raw: '' }]); setActive(pts.length); };
  const addTag = (t: string) => { const v = t.trim().slice(0, 24); if (v && !tags.includes(v)) setTags([...tags, v]); setTagInput(''); };

  const route = (rid: string): CityRoute => ({
    id: rid, title: f.title.trim(), short: f.short.trim() || undefined, district: f.district.trim(), duration: f.duration.trim(), price: f.price.trim(),
    tags, description: f.description.trim(), favorite: fav, hue: base?.hue ?? hueOf(f.title), cover,
    points: pts.map((p) => ({ title: p.title.trim(), text: p.text.trim(), photos: p.photos.length ? p.photos : undefined, lat: p.lat, lng: p.lng })),
  });
  const draft = route('draft');
  const geo = buildGeo(draft.points);
  const missing = pts.filter((p) => !hasCoords(p)).length;
  const valid = f.title.trim().length >= 3 && f.district.trim().length >= 2 && pts.length >= 1 && pts.every((p) => p.title.trim().length >= 2);
  const isAdded = !!base && a.routesAdded.some((r) => r.id === base.id);
  const patchOf = (r: CityRoute) => { const { id: _id, ...rest } = r; void _id; return rest; };

  const submit = () => {
    if (isNew) save({ ...a, routesAdded: [...a.routesAdded, route(newId('r'))] }, 'Маршрут добавлен');
    else if (isAdded) save({ ...a, routesAdded: a.routesAdded.map((r) => (r.id === base!.id ? route(r.id) : r)) });
    else save({ ...a, routeEdits: { ...a.routeEdits, [base!.id]: patchOf(route(base!.id)) } });
    ctx.back();
  };
  const remove = () => {
    if (!base) return;
    if (isAdded) save({ ...a, routesAdded: a.routesAdded.filter((r) => r.id !== base.id) }, 'Маршрут удалён');
    else save({ ...a, routesHidden: [...a.routesHidden, base.id] }, 'Маршрут скрыт. Вернуть можно на странице «Маршруты»');
    ctx.back();
  };

  const pickPoints: PickPoint[] = pts.map((p) => (hasCoords(p) ? { lat: p.lat as number, lng: p.lng as number } : null));
  const [tab, setTab] = useState<'card' | 'route'>('card');

  const form = (
    <div className={desk ? 'adm-form' : undefined}>
      <Field id="r-title" wide label="Название"><input id="r-title" className="input" value={f.title} onChange={set('title')} maxLength={140} /></Field>
      <Field id="r-short" label="Короткое название" hint="Для карточек, если полное не помещается. Можно пустым."><input id="r-short" className="input" value={f.short} onChange={set('short')} maxLength={60} /></Field>
      <Field id="r-dist" label="Район" hint="Выберите из списка или впишите новый.">
        <input id="r-dist" className="input" list="r-dists" value={f.district} onChange={set('district')} maxLength={40} />
        <datalist id="r-dists">{DISTRICTS.map((d) => <option key={d} value={d} />)}</datalist>
      </Field>
      <Field id="r-dur" label="Длительность"><input id="r-dur" className="input" value={f.duration} onChange={set('duration')} maxLength={30} /></Field>
      <Field id="r-price" label="Цена"><input id="r-price" className="input" value={f.price} onChange={set('price')} maxLength={30} /></Field>
      <Field id="r-tags" wide label="Теги">
        <div className="row-scroll adm-chips" style={{ flexWrap: 'wrap' }}>
          {[...PRESET_TAGS, ...tags.filter((t) => !PRESET_TAGS.includes(t))].map((t) => (
            <button key={t} role="checkbox" aria-checked={tags.includes(t)} className={`chip ${tags.includes(t) ? 'active' : ''}`} onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}>{t}</button>
          ))}
          <input id="r-tags" className="input" style={{ width: 150, height: 34 }} placeholder="+ свой тег" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); } }} onBlur={() => addTag(tagInput)} />
        </div>
      </Field>
      <ImageField id="r-cover" label="Обложка маршрута" opts={COVER_IMG} value={cover} onChange={setCover} src={placeSrc} previewW={72} previewH={72} hint="Квадрат: обрежем по центру. Видна на карточке маршрута." />
      <Field id="r-desc" wide label="Описание"><textarea id="r-desc" style={area} value={f.description} onChange={set('description')} maxLength={500} /></Field>
      <ToggleRow title="В избранных маршрутах" text="Покажем в верхнем ряду «Выбор To Date» на странице маршрутов." on={fav} onChange={setFav} />

      <div className="wide">
        <SectionTitle right={geo ? <Tag tone="green">Карта готова · {geo.km.toString().replace('.', ',')} км</Tag> : <Tag tone="amber">{missing > 0 ? `Нет координат у точек: ${missing}` : 'Нужно хотя бы две точки'}</Tag>}>Точки маршрута</SectionTitle>
        <p style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', margin: '-4px 0 10px' }}>
          Выберите точку в списке и кликните по карте: координаты встанут сами. Можно вставить и готовые: в Яндекс Картах правый клик по месту, затем «Что здесь?» и скопировать координаты.
        </p>
        <Suspense fallback={<div style={{ height: 340, borderRadius: 24, background: '#E9ECF1' }} />}>
          <div style={{ borderRadius: 24, overflow: 'hidden', border: '1px solid var(--divider)' }}>
            <StreetMap mode="pick" height={340} pickPoints={pickPoints} pickActive={active} onPick={onPick} />
          </div>
        </Suspense>
        <p style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', margin: '8px 0 14px' }}>
          {bg && !pts.some((p, i) => !bg.points[i] || p.lat !== bg.points[i].lat || p.lng !== bg.points[i].lng) && pts.length === bg.points.length
            ? 'У этого маршрута линия построена по улицам. Если сдвинете точки, линия станет прямой.'
            : 'Линия между точками на карте приложения прямая: по улицам такие маршруты пока не строятся.'}
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {pts.map((p, i) => {
            const on = i === active;
            const c = parseCoords(p.raw);
            return (
              <div key={i} className="plate" style={{ padding: 12, boxShadow: on ? 'inset 0 0 0 2px var(--primary)' : 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="map-pin" style={{ flex: 'none', cursor: 'pointer' }} aria-label={`Выбрать точку ${i + 1}`} onClick={() => setActive(i)}>{i + 1}</button>
                  <button style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, padding: 0 }} onClick={() => setActive(i)}>
                    {p.title || 'Новая точка'}
                    <span style={{ display: 'block', fontSize: 11, fontWeight: 400, color: hasCoords(p) ? 'var(--text-2)' : '#B7791F', marginTop: 2 }}>{hasCoords(p) ? 'Координаты есть' : 'Нет координат'}</span>
                  </button>
                  <button className="adm-mini" aria-label="Выше" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                  <button className="adm-mini" aria-label="Ниже" disabled={i === pts.length - 1} onClick={() => move(i, 1)}>↓</button>
                  <button className="adm-mini" aria-label="Удалить точку" disabled={pts.length === 1} onClick={() => removePt(i)}>✕</button>
                </div>
                {on && (
                  <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
                    <input className="input" aria-label="Название точки" placeholder="Название точки" value={p.title} onChange={(e) => patchPt(i, { title: e.target.value })} maxLength={120} />
                    <textarea style={{ ...area, minHeight: 70 }} aria-label="Описание точки" placeholder="Что здесь делать" value={p.text} onChange={(e) => patchPt(i, { text: e.target.value })} maxLength={300} />
                    <div>
                      <input className="input" aria-label="Координаты" placeholder="Координаты: 59.934300, 30.335100" value={p.raw} onChange={(e) => onRaw(i, e.target.value)} />
                      {p.raw && !c && <div role="alert" style={{ fontSize: 12, color: '#C23B3B', marginTop: 5 }}>Не разобрал. Нужны два числа: широта и долгота.</div>}
                      {c && !inSpb(c.lat, c.lng) && <div style={{ fontSize: 12, color: '#B7791F', marginTop: 5 }}>Точка вне Петербурга. Проверьте порядок: сначала широта, потом долгота.</div>}
                    </div>
                    <MultiImageField label="Фото точки" values={p.photos} onChange={(v) => patchPt(i, { photos: v })} opts={PLACE_IMG} src={placeSrc} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <button className="btn-ghost" style={{ marginTop: 10 }} onClick={addPt}>+ Добавить точку</button>
      </div>

      <div className="wide adm-actions">
        <button className="btn-primary" disabled={!valid} onClick={submit}>{isNew ? 'Добавить' : 'Сохранить'}</button>
        {!isNew && <DangerButton label={isAdded ? 'Удалить маршрут' : 'Скрыть маршрут'} confirm={isAdded ? 'Да, удалить' : 'Да, скрыть'} onConfirm={remove} />}
        {!valid && <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>Нужны название, район и названия всех точек.</span>}
      </div>
    </div>
  );

  const preview = (
    <Preview tabs={<Chips options={[{ key: 'card', label: 'Карточка' }, { key: 'route', label: 'Страница' }]} value={tab} onChange={setTab} />}>
      {tab === 'card' ? (
        <div style={{ padding: '18px 20px 22px', display: 'flex', justifyContent: 'center' }}>
          <RoutePhotoCard r={draft} onClick={noop} />
        </div>
      ) : (
        <div style={{ background: 'var(--surface)', borderRadius: '40px 40px 0 0', padding: '26px 30px 28px', marginTop: 30 }}>
          <h1 className="h2" style={{ margin: 0 }}>{draft.title || 'Название маршрута'}</h1>
          <div className="row-scroll" style={{ marginTop: 14 }}>
            <span className="param">{draft.district || 'Район'}</span>
            <span className="param">{draft.duration}</span>
            {geo && <span className="param">{geo.km.toString().replace('.', ',')} км пешком</span>}
            <span className="param">{draft.price}</span>
          </div>
          {draft.description && <p style={{ fontSize: 13, lineHeight: '17px', margin: '14px 0 0' }}>{draft.description}</p>}
          <h2 className="h3" style={{ margin: '20px 0 12px' }}>Точки маршрута</h2>
          <div style={{ display: 'flex', gap: 10, overflow: 'hidden' }}>
            {draft.points.map((p, i) => (
              <div key={i} className="plate" style={{ flex: '0 0 232px', padding: 10 }}>
                <div style={{ position: 'relative' }}>
                  <PlacePhotos names={p.photos ?? []} hue={draft.hue + i * 40} onOpen={noop} />
                  <span className="map-pin" style={{ position: 'absolute', top: 8, left: 8 }}>{i + 1}</span>
                </div>
                <div className="h3" style={{ margin: '12px 6px 6px', fontSize: 20, lineHeight: '21px' }}>{p.title || 'Точка'}</div>
                <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', margin: '0 6px 6px' }}>{p.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Preview>
  );

  return (
    <Shell ctx={ctx} title={isNew ? 'Новый маршрут' : 'Маршрут'} back>
      <EditLayout form={form} preview={preview} />
    </Shell>
  );
}
