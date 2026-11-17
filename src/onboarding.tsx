/* Интерактивное обучение для новичков. Каждый шаг ждёт настоящего действия: свайп, нажатие, сердечко, переход во вкладку. */
import { useEffect, useRef, useState } from 'react';
import type { AppCtx, Route } from './App';
import { getFreeHints, numWord, plural } from './store';

type StepKey = 'swipe' | 'open' | 'heart' | 'hints' | 'done';
const STEPS: { key: StepKey; target?: string; title: string; text: string }[] = [
  { key: 'swipe', target: 'deck', title: 'Листайте карточки', text: 'Смахните карточку влево или вправо. Направление не важно.' },
  { key: 'open', target: 'deck', title: 'Откройте идею', text: 'Нажмите на карточку: внутри время, цена, метро и кнопка «Намекнуть».' },
  { key: 'heart', target: 'heart', title: 'Сохраните понравившееся', text: 'Нажмите на сердечко. Карточка попадёт в избранное.' },
  { key: 'hints', target: 'nav-hints', title: 'Здесь живут намёки', text: 'Нажмите на конверт. Тут и те, что вы отправили, и те, что пришли вам.' },
  { key: 'done', title: 'Готово', text: '' },
];

interface Box { x: number; y: number; w: number; h: number }

export default function Onboarding({ ctx, route, onClose }: { ctx: AppCtx; route: Route; onClose: () => void }) {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const [box, setBox] = useState<Box | null>(null);
  const favs0 = useRef(ctx.favorites.join(','));
  const next = () => setI((n) => Math.min(n + 1, STEPS.length - 1));

  // шаг 1: свайп по колоде
  useEffect(() => {
    if (step.key !== 'swipe') return;
    const h = () => window.setTimeout(next, 450);
    window.addEventListener('td-swipe', h);
    return () => window.removeEventListener('td-swipe', h);
  }, [step.key]);
  // шаг 2: открыли карточку
  useEffect(() => { if (step.key === 'open' && route.name === 'idea') window.setTimeout(next, 250); }, [step.key, route.name]);
  // шаг 3: сердечко
  useEffect(() => {
    if (step.key === 'heart' && ctx.favorites.join(',') !== favs0.current) window.setTimeout(next, 350);
  }, [step.key, ctx.favorites]);
  // шаг 4: вкладка намёков
  useEffect(() => { if (step.key === 'hints' && route.name === 'hints') window.setTimeout(next, 250); }, [step.key, route.name]);
  // если новичок ушёл с нужного экрана, возвращаем его на шаг назад по смыслу
  useEffect(() => {
    if (step.key === 'swipe' && route.name !== 'home') ctx.go({ name: 'home' });
    if (step.key === 'open' && route.name !== 'home' && route.name !== 'idea') ctx.go({ name: 'home' });
    if (step.key === 'heart' && route.name === 'home') setI(1);
  }, [step.key, route.name]);

  // следим за положением подсвеченного элемента: канвас масштабируется через CSS zoom, поэтому считаем от рамки телефона
  useEffect(() => {
    if (!step.target) { setBox(null); return; }
    let raf = 0, scrolled = false;
    const tick = () => {
      const el = document.querySelector(`[data-onb="${step.target}"]`) as HTMLElement | null;
      const phone = document.querySelector('.phone') as HTMLElement | null;
      if (el && phone) {
        if (!scrolled) { scrolled = true; if (step.target === 'heart') el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        // CSS zoom масштабирует и fixed-элементы внутри телефона: переводим координаты окна в единицы канваса
        const z = parseFloat(phone.style.zoom) || 1;
        const r = el.getBoundingClientRect();
        const b = { x: r.left / z, y: r.top / z, w: r.width / z, h: r.height / z };
        setBox((o) => (o && Math.abs(o.x - b.x) < 0.5 && Math.abs(o.y - b.y) < 0.5 && Math.abs(o.w - b.w) < 0.5 && Math.abs(o.h - b.h) < 0.5 ? o : b));
      } else setBox(null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target, route.name]);

  const pad = 8;
  const zoom = parseFloat((document.querySelector('.phone') as HTMLElement | null)?.style.zoom || '1') || 1;
  const canvasH = window.innerHeight / zoom;
  const below = box ? box.y + box.h / 2 < canvasH / 2 : false;
  const free = getFreeHints();

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, pointerEvents: 'none' }} role="dialog" aria-label="Обучение">
      {step.key === 'done' ? (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,40,.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'auto' }}>
          <div className="modal-sheet" style={{ animation: 'sheetUp .25s ease-out' }}>
            <div className="h3" style={{ margin: '14px 0 8px' }}>Всё, вы умеете</div>
            <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>
              {free > 0
                ? `Первые ${numWord(free)} ${plural(free, 'намёк', 'намёка', 'намёков')} бесплатные. Откройте любую карточку и нажмите «Намекнуть о свидании».`
                : 'Откройте любую карточку и нажмите «Намекнуть о свидании».'}
            </p>
            <button className="btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => { onClose(); ctx.go({ name: 'home' }); }}>Начать</button>
          </div>
        </div>
      ) : (
        <>
          {box ? (
            <div
              aria-hidden="true"
              style={{
                position: 'fixed', left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2,
                borderRadius: step.target === 'nav-hints' ? 999 : 28, boxShadow: '0 0 0 9999px rgba(20,24,40,.5), 0 0 0 3px var(--primary) inset',
                transition: 'left .25s ease, top .25s ease, width .25s ease, height .25s ease', pointerEvents: 'none',
              }}
            />
          ) : (
            <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(20,24,40,.5)', pointerEvents: 'none' }} />
          )}
          <div
            style={{
              position: 'fixed', left: 20, right: 20, pointerEvents: 'auto',
              ...(box ? (below ? { top: Math.max(12, Math.min(box.y + box.h + pad + 16, canvasH - 230)) } : { bottom: Math.max(canvasH - box.y + pad + 16, 100) }) : { bottom: 120 }),
              background: 'var(--surface)', borderRadius: 28, padding: '16px 20px 14px', boxShadow: '0 10px 30px rgba(20,24,40,.25)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Шаг {i + 1} из {STEPS.length - 1}</div>
            <div className="h3" style={{ margin: '4px 0 6px' }}>{step.title}</div>
            <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>{step.text}</p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <button className="link-btn" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }} onClick={onClose}>Пропустить обучение</button>
              {step.key === 'hints' && <button className="link-btn" style={{ fontSize: 12 }} onClick={next}>Дальше</button>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
