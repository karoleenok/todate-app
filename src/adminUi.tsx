/* Общие кирпичики админки: оболочка, поля, загрузка картинок, предпросмотр в рамке телефона. */
import React, { createContext, useContext, useRef, useState } from 'react';
import type { AppCtx } from './App';

/** true, когда админка открыта на ПК (широкий экран): боковое меню и просторные формы */
export const DeskCtx = createContext(false);
export const useDesk = () => useContext(DeskCtx);

const px: React.CSSProperties = { padding: '0 30px' };

export function Shell({ ctx, title, sub, children, back, narrow, actions }: {
  ctx: AppCtx; title: string; sub?: string; children: React.ReactNode; back?: boolean; narrow?: number; actions?: React.ReactNode;
}) {
  const desk = useDesk();
  if (desk) {
    return (
      <div>
        {back && <button className="link-btn" style={{ padding: '4px 0 12px', fontSize: 13 }} onClick={() => ctx.back()}>← Назад</button>}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="h1" style={{ margin: 0 }}>{title}</h1>
            {sub && <p style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-2)', margin: '10px 0 0', maxWidth: 620 }}>{sub}</p>}
          </div>
          {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
        </div>
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
          {back && <button className="link-btn" style={{ padding: '4px 0 10px', fontSize: 12 }} onClick={() => ctx.back()}>← Назад</button>}
          <h1 className="h1" style={{ margin: 0 }}>{title}</h1>
          {sub && <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '8px 0 0', maxWidth: 330 }}>{sub}</p>}
          {actions && <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>{actions}</div>}
        </div>
        <div style={{ ...px, marginTop: 18 }}>{children}</div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

export function Field({ label, hint, children, id, wide }: { label: string; hint?: string; children: React.ReactNode; id: string; wide?: boolean }) {
  return (
    <div className={wide ? 'wide' : undefined} style={{ marginBottom: 14 }}>
      <label htmlFor={id} style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 5 }}>{hint}</div>}
    </div>
  );
}

export const area: React.CSSProperties = {
  width: '100%', minHeight: 92, borderRadius: 20, border: '1px solid #B4B5B6', background: 'var(--surface)',
  padding: '12px 16px', fontSize: 13, lineHeight: '18px', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box',
};

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      style={{ width: 52, height: 30, borderRadius: 999, border: 'none', cursor: 'pointer', flex: 'none', position: 'relative', background: on ? 'var(--primary)' : '#C9CCD3', transition: 'background .15s ease' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 25 : 3, width: 24, height: 24, borderRadius: '50%', background: '#fff', transition: 'left .15s ease' }} />
    </button>
  );
}

export function ToggleRow({ title, text, on, onChange }: { title: string; text?: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="plate wide" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13, fontWeight: 600, lineHeight: '17px' }}>{title}</span>
        {text && <span style={{ display: 'block', fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 2 }}>{text}</span>}
      </span>
      <Switch on={on} onChange={onChange} label={title} />
    </div>
  );
}

export function Chips<T extends string>({ options, value, onChange }: { options: { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="row-scroll adm-chips" role="radiogroup">
      {options.map((c) => (
        <button key={c.key} role="radio" aria-checked={value === c.key} className={`chip ${value === c.key ? 'active' : ''}`} onClick={() => onChange(c.key)}>{c.label}</button>
      ))}
    </div>
  );
}

export function Tag({ tone = 'gray', children }: { tone?: 'gray' | 'blue' | 'pink' | 'green' | 'amber'; children: React.ReactNode }) {
  return <span className={`adm-tag ${tone}`}>{children}</span>;
}

/** Кнопка с подтверждением в два нажатия: без всплывающих окон браузера */
export function DangerButton({ label, confirm, onConfirm, style }: { label: string; confirm: string; onConfirm: () => void; style?: React.CSSProperties }) {
  const [ask, setAsk] = useState(false);
  return ask ? (
    <span style={{ display: 'inline-flex', gap: 8, ...style }}>
      <button className="btn-ghost" style={{ color: '#C23B3B', borderColor: '#E9B3B3' }} onClick={onConfirm}>{confirm}</button>
      <button className="btn-ghost" onClick={() => setAsk(false)}>Отмена</button>
    </span>
  ) : (
    <button className="btn-ghost" style={style} onClick={() => setAsk(true)}>{label}</button>
  );
}

/* ---------- картинки ---------- */
export interface ImgOpts { w: number; h: number; q?: number; radius?: number; strict?: boolean; maxMb?: number }

/** Проверяет файл, обрезает по центру до нужных пропорций, ужимает и кодирует в WebP (если браузер не умеет, в JPEG).
    На сервере то же самое делается ещё раз: тип по содержимому, лимит размера, SVG не принимаем. */
export async function prepareImage(file: File, o: ImgOpts): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Нужен PNG, JPG или WebP. SVG не принимаем.');
  const maxMb = o.maxMb ?? 12;
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Файл больше ${maxMb} МБ.`);
  let bmp: ImageBitmap;
  try { bmp = await createImageBitmap(file); } catch { throw new Error('Не получилось открыть картинку. Файл повреждён или это не картинка.'); }
  const target = o.w / o.h;
  const ratio = bmp.width / bmp.height;
  if (o.strict && Math.abs(ratio - target) > 0.025) throw new Error(`Пропорции ${bmp.width}×${bmp.height} не подходят. Нужно ${o.w}×${o.h}.`);
  const c = document.createElement('canvas');
  c.width = o.w; c.height = o.h;
  const g = c.getContext('2d');
  if (!g) throw new Error('Браузер не смог обработать картинку.');
  if (o.radius) { g.beginPath(); g.roundRect(0, 0, o.w, o.h, o.radius); g.clip(); }
  const k = Math.max(o.w / bmp.width, o.h / bmp.height);
  const sw = o.w / k, sh = o.h / k;
  g.drawImage(bmp, (bmp.width - sw) / 2, (bmp.height - sh) / 2, sw, sh, 0, 0, o.w, o.h);
  bmp.close?.();
  const q = o.q ?? 0.84;
  let url = c.toDataURL('image/webp', q);
  if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', q);
  return url;
}

export function ImageField({ id, label, hint, value, onChange, opts, src, previewW = 66, previewH, wide = true }: {
  id: string; label: string; hint?: string; value?: string; onChange: (v: string | undefined) => void; opts: ImgOpts;
  /** как превратить значение в адрес картинки (для встроенных файлов из папки проекта) */
  src: (v: string) => string; previewW?: number; previewH?: number; wide?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const h = previewH ?? Math.round((previewW * opts.h) / opts.w);
  const pick = async (f?: File) => {
    if (!f) return;
    setErr(''); setBusy(true);
    try { onChange(await prepareImage(f, opts)); } catch (e) { setErr(e instanceof Error ? e.message : 'Не получилось открыть файл.'); }
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };
  return (
    <Field id={id} label={label} hint={hint} wide={wide}>
      <input ref={ref} id={id} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <span style={{ width: previewW, height: h, borderRadius: Math.min(18, previewW / 4), background: '#E9ECF1', overflow: 'hidden', flex: 'none', display: 'block' }}>
          {value && <img src={src(value)} alt="Предпросмотр" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
        </span>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-ghost" style={{ height: 44 }} disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Обрабатываю…' : value ? 'Заменить' : 'Выбрать файл'}</button>
          {value && <button className="btn-ghost" style={{ height: 44 }} onClick={() => onChange(undefined)}>Убрать</button>}
        </div>
      </div>
      {err && <div role="alert" style={{ fontSize: 12, lineHeight: '16px', color: '#C23B3B', marginTop: 8 }}>{err}</div>}
    </Field>
  );
}

/** Несколько фото (точка маршрута): загрузка пачкой, удаление, порядок */
export function MultiImageField({ label, values, onChange, opts, src, max = 5 }: {
  label: string; values: string[]; onChange: (v: string[]) => void; opts: ImgOpts; src: (v: string) => string; max?: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(''); setBusy(true);
    const out = [...values];
    for (const f of Array.from(files)) {
      if (out.length >= max) { setErr(`Не больше ${max} фото на точку.`); break; }
      try { out.push(await prepareImage(f, opts)); } catch (e) { setErr(e instanceof Error ? e.message : 'Не получилось открыть файл.'); }
    }
    onChange(out);
    setBusy(false);
    if (ref.current) ref.current.value = '';
  };
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {values.map((v, i) => (
          <span key={`${i}-${v.slice(-12)}`} style={{ position: 'relative', width: 72, height: 54, borderRadius: 12, overflow: 'hidden', background: '#E9ECF1', display: 'block' }}>
            <img src={src(v)} alt={`Фото ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            <button aria-label={`Убрать фото ${i + 1}`} onClick={() => onChange(values.filter((_, k) => k !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(20,24,40,.7)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: '20px', padding: 0 }}>×</button>
            {i > 0 && <button aria-label="Сдвинуть влево" onClick={() => { const n = [...values]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange(n); }} style={{ position: 'absolute', bottom: 2, left: 2, width: 20, height: 20, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,.85)', cursor: 'pointer', fontSize: 11, padding: 0 }}>←</button>}
          </span>
        ))}
        {values.length < max && (
          <>
            <input ref={ref} type="file" multiple accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => add(e.target.files)} />
            <button className="btn-ghost" style={{ height: 40, padding: '0 16px' }} disabled={busy} onClick={() => ref.current?.click()}>{busy ? 'Обрабатываю…' : '+ Фото'}</button>
          </>
        )}
      </div>
      {err && <div role="alert" style={{ fontSize: 12, lineHeight: '16px', color: '#C23B3B', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

/* ---------- предпросмотр ---------- */
export function Preview({ title = 'Так увидят в приложении', children, tabs }: { title?: string; children: React.ReactNode; tabs?: React.ReactNode }) {
  return (
    <div className="adm-prev">
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{title}</div>
      {tabs && <div style={{ marginBottom: 10 }}>{tabs}</div>}
      <div className="adm-phone" aria-label="Предпросмотр" role="img">
        <div className="adm-phone-in">{children}</div>
      </div>
    </div>
  );
}

/** Форма слева, предпросмотр справа (на ПК) или под формой (на телефоне) */
export function EditLayout({ form, preview }: { form: React.ReactNode; preview: React.ReactNode }) {
  return (
    <div className="adm-edit">
      <div className="adm-edit-form">{form}</div>
      <div className="adm-edit-prev">{preview}</div>
    </div>
  );
}

export function Empty({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  return (
    <div className="plate" style={{ padding: '26px 24px', textAlign: 'center' }}>
      <div className="font-head" style={{ fontSize: 22 }}>{title}</div>
      <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '6px auto 16px', maxWidth: 360 }}>{text}</p>
      {action}
    </div>
  );
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, margin: '28px 0 12px' }}>
      <h2 className="h3" style={{ margin: 0 }}>{children}</h2>
      {right}
    </div>
  );
}
