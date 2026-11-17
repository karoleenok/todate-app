import React, { Suspense, lazy, useMemo, useRef, useState } from 'react';
import { CATEGORIES, COVERS, DISTRICTS, EVENTS, EVENT_CATEGORIES, IDEAS, LOCKED_SLOTS, NOTES, PLANS, ROUTES, cardSrc, eventSrc, placeSrc, inviteLine, type Category, type CityEvent, type Idea } from './data';
import { botLink, openExternal, telegramShare, weekInfo, yandexPoint, yandexRoute, yandexSearch } from './links';
import {
  Logo, Silhouette, IdeaTile, PhotoStub, MapStub, IconHeart, IconShare, IconChevron,
  IconCheck, IconSend, IconPin, IconChat, IconUser, IconTheme, IconLang, IconSliders, LockedTile, catClass, cardShapeColor,
} from './ui';
import type { AppCtx } from './App';
import { ROUTE_GEO } from './routeGeo';
import { getFreeHints, numWord, plural } from './store';

// Карта подгружается отдельным куском, пока грузится — показываем заглушку
const StreetMap = lazy(() => import('./StreetMap'));

const px = { padding: '0 30px' } as const;
const pxList = { padding: '0 20px' } as const;

/* ================= КОЛОДА =================
   Передняя карта 275×395, радиус 24, поворот −3°.
   За ней две бледные карты, выглядывающие влево и вправо.
   Свайп: карта следует за пальцем с наклоном, при броске улетает,
   задние карты плавно подъезжают на её место.
   Вариант анимации: ?anim=fly (по умолч.) | deal | flip */
type DeckAnim = 'fly' | 'deal' | 'flip';
const deckAnim: DeckAnim = (() => {
  try {
    const a = new URLSearchParams(window.location.search).get('anim');
    return a === 'deal' || a === 'flip' ? a : 'fly';
  } catch {
    return 'fly';
  }
})();

/* Карта из макета: 297×395, радиус 21, передняя повернута на −3,4° */
const CARD_RATIO = 297 / 395;
/* Карточка-картинка из макета: 795×1365 */
export const IMG_RATIO = 795 / 1365;
const cardCls = (i: Idea) => `deck-card ${catClass(i.category)}${i.image ? ' img' : ''}`;

/* Картинка карточки целиком. Размеры заданы, чтобы вёрстка не прыгала при загрузке */
export function CardImage({ idea, eager = false, cover = false }: { idea: Idea; eager?: boolean; cover?: boolean }) {
  return (
    <img
      className="card-img"
      src={cardSrc(cover ? COVERS[idea.category] : idea.image!)}
      alt="" width={795} height={1365} draggable={false} decoding="async"
      loading={eager ? 'eager' : 'lazy'}
    />
  );
}

export function Deck({ ideas, onOpen, height = 395 }: { ideas: Idea[]; onOpen?: (id: string) => void; height?: number }) {
  const [idx, setIdx] = useState(0);
  const [drag, setDrag] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<0 | 1 | -1>(0);
  const startX = React.useRef<number | null>(null);
  const lastX = React.useRef(0);
  const lastT = React.useRef(0);
  const vel = React.useRef(0);
  const swiped = React.useRef(false);
  const downEl = React.useRef<HTMLElement | null>(null);
  const n = ideas.length;
  const done = idx >= n;
  const cur = done ? null : ideas[idx];
  const allImg = ideas.length > 0 && ideas.every((i) => i.image);
  const w = Math.round(height * (allImg ? IMG_RATIO : 275 / 395));
  const p = Math.min(Math.abs(drag) / 120, 1);

  const finishLeave = (dir: 1 | -1) => {
    window.dispatchEvent(new Event('td-swipe'));
    setLeaving(dir);
    setDragging(false);
    window.setTimeout(() => {
      setIdx((i) => Math.min(i + 1, n));
      setLeaving(0);
      setDrag(0);
    }, 320);
  };

  /* Позы задних карт из макета: правая +6,9° чуть выше, левая −7,4° ниже */
  const BACK_POSES = [
    { rot: 6.9, x: 27, y: 0, scale: 0.927 },
    { rot: -7.4, x: -25, y: 20, scale: 0.927 },
  ];

  const frontTransform = (): React.CSSProperties => {
    if (leaving !== 0) {
      if (deckAnim === 'flip')
        return { transform: `perspective(900px) rotateY(${leaving * -80}deg)`, opacity: 0, transition: 'transform .34s cubic-bezier(.3,.7,.4,1), opacity .34s ease' };
      if (deckAnim === 'deal')
        return { transform: `translateY(${height * 0.6}px) rotate(${leaving * -10}deg)`, opacity: 0, transition: 'transform .34s cubic-bezier(.3,.7,.4,1), opacity .34s ease' };
      return { transform: `translateX(${leaving * (w + 320)}px) rotate(${leaving * 26}deg)`, transition: 'transform .32s cubic-bezier(.2,.7,.3,1)' };
    }
    return {
      transform: `translateX(${drag}px) rotate(${-3 + drag * 0.08}deg)`,
      transition: dragging ? 'none' : 'transform .42s cubic-bezier(.2,.8,.3,1.08)',
    };
  };

  return (
    <div
      style={{ position: 'relative', height, display: 'flex', justifyContent: 'center', touchAction: 'pan-y' }}
      onPointerDown={(e) => {
        if (leaving !== 0 || done) return;
        startX.current = e.clientX;
        lastX.current = e.clientX;
        lastT.current = e.timeStamp;
        vel.current = 0;
        swiped.current = false;
        downEl.current = e.target as HTMLElement;
        setDragging(true);
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (startX.current == null) return;
        const dt = e.timeStamp - lastT.current;
        if (dt > 0) {
          vel.current = vel.current * 0.6 + ((e.clientX - lastX.current) / dt) * 0.4;
          lastX.current = e.clientX;
          lastT.current = e.timeStamp;
        }
        const dx = e.clientX - startX.current;
        if (Math.abs(dx) > 8) swiped.current = true;
        setDrag(dx);
      }}
      onPointerUp={(e) => {
        if (startX.current == null) return;
        const dx = e.clientX - startX.current;
        const v = vel.current;
        startX.current = null;
        setDragging(false);
        // Летит, если тянули достаточно далеко ИЛИ бросили быстро — туда, куда тянул палец
        if (Math.abs(dx) > 60 || Math.abs(v) > 0.45) {
          const dir = dx + v * 120 > 0 ? 1 : -1;
          finishLeave(dir);
        } else {
          setDrag(0);
          // Короткое касание без сдвига — это тап: по передней карте переворачиваем, по следующей — листаем
          if (Math.abs(dx) < 8 && !done) {
            const hit = downEl.current?.closest('[data-card]')?.getAttribute('data-card');
            if (hit === 'front') { if (cur) onOpen?.(cur.id); }
            else if (hit === 'next') finishLeave(1);
          }
        }
      }}
      onPointerCancel={() => { startX.current = null; setDragging(false); setDrag(0); }}
    >
      <div key={done ? 'stub' : 'deck'} style={{ position: 'relative', width: w, height, animation: 'deckIn .35s cubic-bezier(.25,.8,.3,1)' }}>
        {/* Задние карты — следующие из колоды; ближняя растёт при свайпе */}
        {!done &&
          [ideas[idx + 2], ideas[idx + 1]].map((back, k) => {
            if (!back) return null;
            const near = k === 1;
            const pose = BACK_POSES[near ? 0 : 1];
            const grow = near ? p : p * 0.4;
            const rot = pose.rot + (-3 - pose.rot) * grow;
            const scale = pose.scale + (1 - pose.scale) * grow;
            return (
              <button
                key={back.id}
                className={cardCls(back)}
                data-card={near ? 'next' : undefined}
                onClick={(e) => { if (e.detail === 0 && leaving === 0 && near) finishLeave(1); }}
                aria-label={near ? 'Следующая карта' : undefined}
                tabIndex={near ? 0 : -1}
                style={{
                  position: 'absolute', inset: 0, border: 'none', padding: 0,
                  transform: `rotate(${rot}deg) translate(${pose.x * (1 - grow)}px, ${pose.y * (1 - grow)}px) scale(${scale})`,
                  transition: dragging ? 'none' : 'transform .38s cubic-bezier(.25,.8,.3,1)',
                  boxShadow: 'none', zIndex: near ? 2 : 1, cursor: near ? 'pointer' : 'default',
                }}
              >
                {back.image ? <CardImage idea={back} eager /> : (<>
                <Silhouette shape={back.shape} color={cardShapeColor[back.category]} />
                <div style={{ position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center' }}><Logo dark small /></div>
                <div
                  className="font-head"
                  style={{
                    position: 'absolute', left: 22, right: 22, top: '50%', transform: 'translateY(-46%)',
                    fontSize: Math.round(w / 10.2), lineHeight: 1.04, color: 'var(--card-ink)', textAlign: 'center',
                  }}
                >
                  {back.title}
                </div>
                </>)}
              </button>
            );
          })}
        {/* Передняя карта */}
        {!done && cur && (
          <button
            key={cur.id}
            className={cardCls(cur)}
            data-card="front"
            data-onb="deck"
            // Клавиатура (Enter/Space): у такого клика detail === 0; тапы пальцем и мышью обрабатывает onPointerUp
            onClick={(e) => { if (e.detail !== 0) return; onOpen?.(cur.id); }}
            style={{
              position: 'absolute', inset: 0, border: 'none', padding: 0, zIndex: 3,
              cursor: onOpen ? (dragging ? 'grabbing' : 'grab') : 'default', display: 'block',
              ...frontTransform(),
            }}
            aria-label={cur.title}
          >
            {cur.image ? (
              <CardImage idea={cur} eager />
            ) : (<>
            <Silhouette shape={cur.shape} color={cardShapeColor[cur.category]} />
            <div style={{ position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center' }}><Logo dark small /></div>
            <div
              className="font-head"
              style={{
                position: 'absolute', left: 22, right: 22, top: '50%', transform: 'translateY(-46%)',
                fontSize: Math.round(w / 10.2), lineHeight: 1.04, color: 'var(--card-ink)', textAlign: 'center',
              }}
            >
              {cur.title}
            </div>
            </>)}
          </button>
        )}
        {/* Колода кончилась: заглушка с кнопкой «Смотреть заново» */}
        {done && (
          <div
            className="deck-card"
            style={{
              position: 'absolute', inset: 0, zIndex: 3, background: 'var(--surface)',
              transform: 'rotate(-3deg)', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 30, textAlign: 'center',
            }}
          >
            <div className="font-head" style={{ fontSize: 26, lineHeight: '26px' }}>Карточки недели закончились</div>
            <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '10px 0 18px' }}>
              Новые откроем в понедельник.
            </p>
            <button className="btn-primary" style={{ height: 46 }} onClick={() => setIdx(0)}>
              Смотреть заново
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* Одиночная карта (деталь идеи) — без задних карт, как в макете */
export function SingleCard({ idea, height = 300 }: { idea: Idea; height?: number }) {
  const w = Math.round(height * (idea.image ? IMG_RATIO : CARD_RATIO));
  return (
    <div style={{ display: 'flex', justifyContent: 'center' }}>
      <div className={cardCls(idea)} style={{ width: w, height, transform: 'rotate(-3deg)', flex: 'none' }}>
        {idea.image ? <CardImage idea={idea} eager /> : (<>
        <Silhouette shape={idea.shape} color={cardShapeColor[idea.category]} />
        <div style={{ position: 'absolute', top: 22, left: 0, right: 0, textAlign: 'center' }}><Logo dark small /></div>
        <div
          className="font-head"
          style={{
            position: 'absolute', left: 20, right: 20, top: '50%', transform: 'translateY(-46%)',
            fontSize: Math.round(w / 10.2), lineHeight: 1.04, color: 'var(--card-ink)', textAlign: 'center',
          }}
        >
          {idea.title}
        </div>
        </>)}
      </div>
    </div>
  );
}

/* Крошечный логотип для мини-карт */
export const TinyLogo = () => (
  <span style={{ color: 'var(--card-ink)', display: 'inline-flex', lineHeight: 0 }}>
    <Logo dark h={9} />
  </span>
);

/* Мини-карта колоды для писем и плашек */
export function MiniCard({ idea, w = 150, h = 190 }: { idea: Idea; w?: number; h?: number }) {
  if (idea.image) {
    // Картинка выше нарисованной карты, поэтому берём высоту побольше, а ширину — по пропорции
    const ih = Math.round(h * 1.2);
    return (
      <div className={cardCls(idea)} style={{ width: Math.round(ih * IMG_RATIO), height: ih, margin: '0 auto', transform: 'rotate(-3deg)' }}>
        <CardImage idea={idea} />
      </div>
    );
  }
  return (
    <div className={cardCls(idea)} style={{ width: w, height: h, margin: '0 auto', transform: 'rotate(-3deg)' }}>
      <Silhouette shape={idea.shape} color={cardShapeColor[idea.category]} />
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center' }}><TinyLogo /></div>
      <div className="font-head" style={{ position: 'absolute', left: 12, right: 12, top: '50%', transform: 'translateY(-44%)', fontSize: Math.round(w / 9.4), lineHeight: 1.05, color: 'var(--card-ink)', textAlign: 'center' }}>
        {idea.title}
      </div>
    </div>
  );
}

/* Круглая кнопка-иконка фильтров в ряду чипов */
export function FiltersButton({ onClick, active = false }: { onClick: () => void; active?: boolean }) {
  return (
    <button className="chip-icon" onClick={onClick} aria-label="Фильтры" title="Фильтры">
      <IconSliders />
      {active && <span className="dot" />}
    </button>
  );
}

/* ================= РЕГИСТРАЦИЯ ================= */
export function Auth({ ctx }: { ctx: AppCtx }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const valid = name.trim().length >= 2 && /.+@.+\..+/.test(email);
  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ height: 30 }} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}><Logo /></div>
      <div className="sheet" style={{ minHeight: '65dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>Регистрация</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            Картотека — для двоих. Сначала расскажите, как вас зовут, потом пригласите половинку.
          </p>
          <div className="plate" style={{ display: 'grid', gap: 12, padding: 16, marginTop: 16 }}>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Ваше имя</label>
              <input className="input" placeholder="Например, Алина" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>E-mail</label>
              <input className="input" placeholder="you@example.com" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <button
            className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={!valid}
            onClick={() => { ctx.register(name.trim(), email.trim()); ctx.go({ name: 'invite' }); }}
          >
            Продолжить
          </button>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 12, textAlign: 'center', lineHeight: '15px' }}>
            В MVP аккаунт хранится только в этом браузере. Пароль и письма с кодом появятся в боевой версии.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= ПРИГЛАШЕНИЕ ПОЛОВИНКИ ================= */
export function Invite({ ctx }: { ctx: AppCtx }) {
  const [email, setEmail] = useState(ctx.profile.partner ?? '');
  const [sent, setSent] = useState(false);
  const valid = /.+@.+\..+/.test(email);
  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ height: 30 }} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}><Logo /></div>
      <div className="sheet" style={{ minHeight: '65dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>Пригласите половинку</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            На почту партнёра придёт приглашение. Как только оно принято, вы увидите друг друга в профиле и сможете слать намёки.
          </p>
          <div className="plate" style={{ marginTop: 16, padding: 16, background: 'linear-gradient(140deg, var(--pink-back), #EFF4FD)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>Так выглядит приглашение:</div>
            <div className="font-head" style={{ fontSize: 20, lineHeight: '21px' }}>
              {ctx.profile.name || 'Ваша половинка'} приглашает вас в TO DATE
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 6, lineHeight: '16px' }}>
              «Я завёл(а) нам картотеку свиданий по Петербургу. Присоединяйся — будет о чём мечтать по будням».
            </div>
          </div>
          <div className="plate" style={{ display: 'grid', gap: 12, padding: 16, marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>E-mail партнёра</label>
              <input className="input" placeholder="partner@example.com" inputMode="email" value={email} onChange={(e) => { setEmail(e.target.value); setSent(false); }} />
            </div>
          </div>
          <button
            className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={!valid || sent}
            onClick={() => { ctx.invitePartner(email.trim()); setSent(true); ctx.toast('Приглашение отправлено (демо)'); }}
          >
            {sent ? 'Приглашение отправлено ✓' : 'Отправить приглашение'}
          </button>
          <button className="btn-ghost" style={{ width: '100%', marginTop: 10 }} onClick={() => ctx.go({ name: 'home' })}>
            {sent ? 'Перейти в картотеку' : 'Приглашу позже'}
          </button>
          <button style={{ background: 'none', border: 'none', width: '100%', marginTop: 8, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'underline', padding: 4 }} onClick={() => ctx.go({ name: 'accept' })}>
            Посмотреть, что получит партнёр
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= ПРИЁМ ПРИГЛАШЕНИЯ (сторона партнёра) ================= */
export function Accept({ ctx }: { ctx: AppCtx }) {
  const inviter = ctx.profile.name || 'Ваша половинка';
  const [step, setStep] = useState<'letter' | 'form' | 'done'>('letter');
  const [name, setName] = useState('');
  const [email, setEmail] = useState(ctx.profile.partner ?? '');
  const valid = name.trim().length >= 2 && /.+@.+\..+/.test(email);
  return (
    <div style={{ paddingBottom: 60 }}>
      <div style={{ height: 30 }} />
      <div style={{ textAlign: 'center', marginBottom: 24 }}><Logo /></div>
      <div className="sheet" style={{ minHeight: '65dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          {step === 'letter' && (
            <>
              <div style={{ padding: '6px 0 18px' }}>
                <div className="deck-card" style={{ height: 170 }}>
                  <Silhouette shape="sun" color="var(--pink-shape)" />
                  <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center' }}><Logo dark small /></div>
                  <div className="font-head" style={{ position: 'absolute', left: 16, right: 16, top: '50%', transform: 'translateY(-38%)', fontSize: 20, lineHeight: '21px', color: 'var(--card-ink)', textAlign: 'center' }}>
                    {inviter} приглашает вас в TO DATE
                  </div>
                </div>
              </div>
              <h1 className="h1" style={{ margin: '0 0 8px' }}>Вас позвали на свидания</h1>
              <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
                {inviter} завёл(а) для вас двоих картотеку свиданий по Петербургу: идеи, маршруты и события недели — плюс намёки, которые можно слать друг другу на почту.
              </p>
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {['70+ идей в 4 категориях, обновление каждую неделю', 'Маршруты по районам и афиша событий', 'Намёки с секретным бонусом-сюрпризом'].map((t) => (
                  <div key={t} className="plate" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px' }}>
                    <span style={{ color: 'var(--primary)', flex: 'none' }}><IconCheck /></span>
                    <span style={{ fontSize: 13, lineHeight: '16px' }}>{t}</span>
                  </div>
                ))}
              </div>
              <button className="btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => setStep('form')}>
                Принять приглашение
              </button>
              <button style={{ background: 'none', border: 'none', width: '100%', marginTop: 10, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'underline', padding: 4 }} onClick={() => ctx.go({ name: 'home' })}>
                Вернуться на главную
              </button>
            </>
          )}
          {step === 'form' && (
            <>
              <h1 className="h1" style={{ margin: '0 0 8px' }}>Пара слов о вас</h1>
              <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
                Так {inviter} увидит вас в картотеке. Намёки будут приходить на этот e-mail.
              </p>
              <div className="plate" style={{ display: 'grid', gap: 12, padding: 16, marginTop: 16 }}>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Ваше имя</label>
                  <input className="input" placeholder="Например, Матвей" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
                </div>
                <div>
                  <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>E-mail</label>
                  <input className="input" placeholder="you@example.com" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} disabled={!valid} onClick={() => setStep('done')}>
                Присоединиться к {inviter}
              </button>
            </>
          )}
          {step === 'done' && (
            <>
              <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
                <div className="avatar-fab" style={{ width: 96, height: 96, margin: '0 auto' }}>
                  <span style={{ width: 88, height: 88, fontSize: 34 }}>{name.charAt(0).toUpperCase()}</span>
                </div>
              </div>
              <h1 className="h1" style={{ margin: '12px 0 8px', textAlign: 'center' }}>Вы в паре!</h1>
              <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, textAlign: 'center' }}>
                {name.trim()}, теперь вы с {inviter} — пара в TO DATE. Загляните в картотеку и отправьте первый намёк.
              </p>
              <div className="plate" style={{ marginTop: 16, padding: 16, background: 'linear-gradient(140deg, var(--pink-back), #EFF4FD)', fontSize: 13, lineHeight: '17px' }}>
                Совет: самый быстрый способ удивить половинку — открыть карточку и нажать «Намекнуть о свидании». Секретный бонус не узнаете даже вы.
              </div>
              <button className="btn-primary" style={{ width: '100%', marginTop: 18 }} onClick={() => { ctx.toast(`Добро пожаловать, ${name.trim()}! (демо)`); ctx.go({ name: 'home' }); }}>
                Смотреть картотеку
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ================= ФИЛЬТРЫ ================= */
type PriceFilter = 'free' | 'to500' | 'to1000' | '1000plus';
type DurFilter = 'to1' | '1to2' | '2plus';

const priceOf = (s: string) => Number(s.replace(/[^\d]/g, '')) || 0;
const hoursOf = (s: string) => {
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(',', '.'));
  return /мин/.test(s) ? v / 60 : v;
};
const matchPrice = (idea: Idea, f: PriceFilter | null) => {
  if (!f) return true;
  const p = priceOf(idea.price);
  if (f === 'free') return p === 0;
  if (f === 'to500') return p > 0 && p <= 500;
  if (f === 'to1000') return p <= 1000;
  return p > 1000;
};
const matchDur = (idea: Idea, f: DurFilter | null) => {
  if (!f) return true;
  const h = hoursOf(idea.duration);
  if (f === 'to1') return h <= 1;
  if (f === '1to2') return h > 1 && h <= 2;
  return h > 2;
};

const PRICE_OPTS: { key: PriceFilter; label: string }[] = [
  { key: 'free', label: 'Бесплатно' },
  { key: 'to500', label: 'до 500 ₽' },
  { key: 'to1000', label: 'до 1 000 ₽' },
  { key: '1000plus', label: 'Дороже 1 000 ₽' },
];
const DUR_OPTS: { key: DurFilter; label: string }[] = [
  { key: 'to1', label: 'до 1 часа' },
  { key: '1to2', label: '1–2 часа' },
  { key: '2plus', label: 'Больше 2 часов' },
];

export function IdeaFiltersSheet({
  price, dur, count, onPrice, onDur, onReset, onClose,
}: {
  price: PriceFilter | null; dur: DurFilter | null; count: number;
  onPrice: (v: PriceFilter | null) => void; onDur: (v: DurFilter | null) => void;
  onReset: () => void; onClose: () => void;
}) {
  const group = <T extends string>(title: string, opts: { key: T; label: string }[], value: T | null, set: (v: T | null) => void) => (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>{title}</div>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
        {opts.map((o) => (
          <button key={o.key} className={`chip ${value === o.key ? 'active' : ''}`} onClick={() => set(value === o.key ? null : o.key)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" style={{ top: 0 }} />
        <h2 className="h2" style={{ margin: 0 }}>Фильтры</h2>
        {group('Цена на двоих', PRICE_OPTS, price, onPrice)}
        {group('Длительность', DUR_OPTS, dur, onDur)}
        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button className="btn-ghost" style={{ flex: 1 }} onClick={onReset}>Сбросить</button>
          <button className="btn-primary" style={{ flex: 2 }} onClick={onClose}>Показать: {count}</button>
        </div>
      </div>
    </div>
  );
}

/* ================= ГЛАВНАЯ / КАТАЛОГ ================= */
export function Home({ ctx }: { ctx: AppCtx }) {
  const wk = weekInfo();
  const [cat, setCat] = useState<Category | 'все'>('все');
  const [priceF, setPriceF] = useState<PriceFilter | null>(null);
  const [durF, setDurF] = useState<DurFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const list = useMemo(
    () => IDEAS.filter((i) => (cat === 'все' || i.category === cat) && matchPrice(i, priceF) && matchDur(i, durF)),
    [cat, priceF, durF],
  );
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div className="deck-stick">
        <div style={{ height: 'calc(100px + var(--safe-top, 0px))' }} />
        <Deck ideas={IDEAS.slice(0, 4)} onOpen={(id) => ctx.go({ name: 'idea', id })} height={395} />
      </div>
      <div className="sheet" style={{ marginTop: 8, minHeight: '55dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: 0 }}>Все карточки</h1>
          <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 6 }}>{wk.label} · новые откроем {wk.nextLabel}</div>
        </div>
        <div className="row-scroll" style={{ ...px, marginTop: 12 }}>
          <FiltersButton onClick={() => setFiltersOpen(true)} active={!!(priceF || durF)} />
          <button className={`chip ${cat === 'все' ? 'active' : ''}`} onClick={() => setCat('все')}>Все</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
          ))}
        </div>
        <div style={{ ...px, marginTop: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 6px' }}>
          {list.map((i) => (
            <IdeaTile key={i.id} idea={i} onClick={() => ctx.go({ name: 'idea', id: i.id })} />
          ))}
          {cat === 'все' && !priceF && !durF && Array.from({ length: LOCKED_SLOTS }, (_, k) => <LockedTile key={`lock${k}`} />)}
        </div>
        {list.length === 0 && (
          <div style={{ ...px, marginTop: 20 }}>
            <div className="plate" style={{ padding: 22, textAlign: 'center' }}>
              <div className="font-head" style={{ fontSize: 22 }}>Ничего не нашлось</div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: '17px' }}>Попробуйте ослабить фильтры — или сбросьте их совсем.</p>
              <button className="btn-ghost" onClick={() => { setPriceF(null); setDurF(null); setCat('все'); }}>Сбросить фильтры</button>
            </div>
          </div>
        )}
        <div style={{ height: 30 }} />
      </div>
      {filtersOpen && (
        <IdeaFiltersSheet
          price={priceF} dur={durF} count={list.length}
          onPrice={setPriceF} onDur={setDurF}
          onReset={() => { setPriceF(null); setDurF(null); }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}

/* ================= КАРТОЧКА ИДЕИ ================= */
export function IdeaDetail({ ctx, id }: { ctx: AppCtx; id: string }) {
  const idea = IDEAS.find((i) => i.id === id) ?? IDEAS[0];
  const liked = ctx.favorites.includes(idea.id);
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div className="deck-stick">
        <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
        <SingleCard idea={idea} height={360} />
      </div>
      {/* У картинки внизу плашки «время» и «цена», шторка их не закрывает */}
      <div className="sheet" style={{ marginTop: idea.image ? -8 : -94 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h2" style={{ margin: 0 }}>{idea.title}</h1>
          <div className="row-scroll" style={{ marginTop: 10 }}>
            <span className="param">{idea.duration}</span>
            <span className="param">{idea.price}</span>
            {idea.metro && <span className="param">{idea.metro}</span>}
          </div>
          {idea.description && <p style={{ fontSize: 13, lineHeight: '17px', maxWidth: 330, margin: '10px 0 0' }}>{idea.description}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 22, alignItems: 'center' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '0 16px' }} onClick={() => ctx.startHint(idea.id)}>
              Намекнуть о свидании
            </button>
            <button
              data-onb="heart"
              className={`round-icon-btn ${liked ? 'liked' : ''}`}
              onClick={() => ctx.toggleFavorite(idea.id)}
              aria-label={liked ? 'Убрать из избранного' : 'В избранное'}
            >
              <IconHeart filled={liked} />
            </button>
            <button className="round-icon-btn" onClick={() => ctx.toast('Ссылка скопирована')} aria-label="Поделиться"><IconShare /></button>
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= НАМЁК: ФОРМА ================= */
const RECENT_CONTACTS = ['matvey@example.com', 'anton@example.com'];

/* ================= ПРИГЛАШЕНИЕ ПАРТНЁРА ================= */
// Показываем, когда пара ещё не связана: аккаунты синхронизируются после «Старт» партнёра у бота
export function InviteSheet({ ctx, onClose, onSkip }: { ctx: AppCtx; onClose: () => void; onSkip?: () => void }) {
  const [phase, setPhase] = useState<'ask' | 'wait'>(ctx.profile.partnerStatus === 'invited' ? 'wait' : 'ask');
  const share = () => {
    // В прототипе код случайный. В боевой версии его выдаёт сервер: длинный, одноразовый, с сроком жизни
    const code = `invite_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const url = botLink(code);
    const text = 'Привет! Я собираю идеи для свиданий в To Date. Давай подключим наши аккаунты: открой бота и нажми «Старт». Так мы будем видеть общие идеи и сюрпризы друг для друга.';
    try { sessionStorage.setItem('td_last_invite', JSON.stringify({ url, text })); } catch { /* ignore */ }
    openExternal(telegramShare(url, text));
  };
  const again = () => {
    try {
      const { url, text } = JSON.parse(sessionStorage.getItem('td_last_invite') ?? '{}');
      if (url) { openExternal(telegramShare(url, text)); return; }
    } catch { /* ignore */ }
    share();
  };
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Пригласить партнёра">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {phase === 'ask' ? (
          <>
            <div style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '14px 0 6px' }}>«Тёплый ужин делить с тобой…»</div>
            <div className="h3" style={{ margin: '0 0 8px' }}>Похоже, ваш партнёр ещё не знает о To Date</div>
            <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>
              Давайте пригласим его, чтобы ваши аккаунты синхронизировались. Он будет видеть дополнительную часть с сюрпризами: она добавит вашим свиданиям эффект приятной неожиданности.
            </p>
            <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
              <button className="btn-primary" style={{ gap: 8 }} onClick={() => { share(); ctx.setProfile({ ...ctx.profile, partnerStatus: 'invited' }); setPhase('wait'); }}>
                <IconSend /> Пригласить
              </button>
              <button className="btn-ghost" onClick={onSkip ?? onClose}>Не сейчас</button>
            </div>
          </>
        ) : (
          <>
            <div className="h3" style={{ margin: '14px 0 8px' }}>Приглашение отправлено</div>
            <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>
              Когда партнёр откроет бота и нажмёт «Старт», аккаунты синхронизируются. Вы увидите это в профиле.
            </p>
            <div style={{ display: 'grid', gap: 4, marginTop: 18 }}>
              <button className="btn-primary" onClick={onClose}>Понятно</button>
              <button className="link-btn" style={{ justifyContent: 'center' }} onClick={again}><IconSend /> Не отправилось? Открыть Telegram ещё раз</button>
              <button
                className="link-btn" style={{ justifyContent: 'center', color: 'var(--text-2)', fontWeight: 500, fontSize: 12 }}
                onClick={() => { ctx.setProfile({ ...ctx.profile, partnerStatus: 'linked', partnerName: 'Матвей' }); onClose(); ctx.toast('Демо: партнёр нажал «Старт»'); }}
              >
                Только в прототипе: показать, как выглядит после «Старт»
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function HintForm({ ctx, id }: { ctx: AppCtx; id: string }) {
  const idea = IDEAS.find((i) => i.id === id) ?? IDEAS[0];
  const [from, setFrom] = useState(ctx.profile.name);
  const [to, setTo] = useState('');
  const [agree, setAgree] = useState(false);
  const [mail, setMail] = useState(false);
  const linked = ctx.profile.partnerStatus === 'linked';
  const [inviteOpen, setInviteOpen] = useState(() => {
    if (linked) return false;
    try { return sessionStorage.getItem('td_invite_skip') !== '1'; } catch { return true; }
  });
  const skipInvite = () => { try { sessionStorage.setItem('td_invite_skip', '1'); } catch { /* ignore */ } setInviteOpen(false); };
  const nameOk = from.trim().length > 0;
  const validMail = /.+@.+\..+/.test(to) && agree && nameOk;

  const sendTelegram = () => {
    // В прототипе код случайный. В боевой версии его выдаёт сервер: длинный, одноразовый, с сроком жизни
    const code = `h_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    const url = botLink(code);
    const text = `${from.trim()} намекает на свидание: ${inviteLine(idea)}\n\nОткрой бота и нажми «Старт»: там подробности и сюрприз.`;
    try { sessionStorage.setItem('td_last_share', JSON.stringify({ url, text })); } catch { /* ignore */ }
    if (linked) {
      // Пара связана: бот сам отправит намёк партнёру, делиться ссылкой не нужно
      ctx.sendHint(idea.id, from, ctx.profile.partnerName ?? 'партнёру');
      ctx.go({ name: 'hint-sent', id: idea.id });
      return;
    }
    openExternal(telegramShare(url, text));
    ctx.sendHint(idea.id, from, 'Telegram');
    ctx.go({ name: 'hint-sent', id: idea.id });
  };

  const steps = [
    'Выбираете партнёра в Telegram, и ему уходит сообщение с идеей.',
    'Партнёр открывает бота и нажимает «Старт».',
    'Бот коротко расскажет про To Date и свяжет вас в пару. Секретный бонус увидит только он.',
  ];

  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>Намекнуть о свидании</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            Партнёру придёт идея с локацией, длительностью, метро и примерной стоимостью. А ещё секретный бонус, который не узнаете даже вы.
          </p>
          {ctx.freeLeft !== null && getFreeHints() > 0 && (
            <div className="param" style={{ marginTop: 12 }}>Бесплатных намёков: осталось {ctx.freeLeft} из {getFreeHints()}</div>
          )}

          <div className="plate" style={{ marginTop: 16, padding: '16px 16px 0', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)' }}>Что отправляем:</div>
            <div className="h3" style={{ margin: '6px 0 0' }}>
              {inviteLine(idea)}
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 12 }}>
              <span className="param">{idea.duration}</span>
              <span className="param">{idea.price}</span>
              {idea.metro && <span className="param">{idea.metro}</span>}
            </div>
            <div style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 10 }}>
              Плюс секретный бонус — сюрприз, который делает свидание праздником.
            </div>
            <div style={{ marginTop: 16, marginBottom: -90 }}>
              <MiniCard idea={idea} w={190} h={220} />
            </div>
          </div>

          <div className="plate" style={{ marginTop: 10, padding: 16 }}>
            <label htmlFor="hint-from" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>От кого отправляем:</label>
            <div style={{ position: 'relative' }}>
              <input id="hint-from" className="input" style={{ paddingRight: 118 }} value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Ваше имя" />
              <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text-2)', pointerEvents: 'none' }}>
                Взято из профиля
              </span>
            </div>
          </div>

          {!linked && <div className="plate" style={{ marginTop: 10, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Как это работает</div>
            <div style={{ display: 'grid', gap: 12 }}>
              {steps.map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span className="step-dot">{i + 1}</span>
                  <span style={{ fontSize: 13, lineHeight: '17px', paddingTop: 2 }}>{t}</span>
                </div>
              ))}
            </div>
          </div>}

          <button className="btn-primary" style={{ width: '100%', marginTop: 16, gap: 8 }} disabled={!nameOk} onClick={sendTelegram}>
            <IconSend /> {linked ? 'Отправить намёк' : 'Отправить в Telegram'}
          </button>

          {!linked && <div style={{ textAlign: 'center', marginTop: 6 }}>
            <button className="link-btn" onClick={() => setMail((m) => !m)} aria-expanded={mail}>
              {mail ? 'Скрыть письмо' : 'У партнёра нет Telegram? Отправить письмом'}
            </button>
          </div>}

          {mail && !linked && (
            <div className="plate" style={{ marginTop: 6, display: 'grid', gap: 14, padding: 16 }}>
              <div>
                <label htmlFor="hint-to" style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>E-mail партнёра:</label>
                <input id="hint-to" className="input" placeholder="name@example.com" inputMode="email" autoComplete="email" value={to} onChange={(e) => setTo(e.target.value)} />
                <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                  {RECENT_CONTACTS.map((c) => (
                    <button
                      key={c}
                      style={{ background: 'none', border: 'none', padding: 0, fontSize: 11, color: 'var(--text-2)', textDecoration: 'underline', cursor: 'pointer' }}
                      onClick={() => setTo(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <label className="check-round" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                <span className="box"><IconCheck /></span>
                Партнёр не против письма
              </label>
              <button className="btn-ghost" style={{ width: '100%' }} disabled={!validMail} onClick={() => { ctx.sendHint(idea.id, from, to); ctx.go({ name: 'hint-sent', id: idea.id }); }}>
                Отправить письмом
              </button>
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
      {inviteOpen && <InviteSheet ctx={ctx} onClose={() => setInviteOpen(false)} onSkip={skipInvite} />}
    </div>
  );
}

/* ================= НАМЁК ОТПРАВЛЕН ================= */
export function HintSent({ ctx, id }: { ctx: AppCtx; id: string }) {
  const idea = IDEAS.find((i) => i.id === id) ?? IDEAS[0];
  const to = ctx.hints[0]?.to ?? '';
  const viaTg = to === 'Telegram';
  const viaMail = to.includes('@');
  const again = () => {
    try {
      const { url, text } = JSON.parse(sessionStorage.getItem('td_last_share') ?? '{}');
      if (url) openExternal(telegramShare(url, text));
    } catch { /* ignore */ }
  };
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>{viaTg ? 'Намёк готов' : 'Отправили намёк!'}</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            {viaTg
              ? 'Если вы выбрали партнёра и отправили сообщение, осталось дождаться, пока он нажмёт «Старт» у бота. Тогда статус в «Моих намёках» станет «Услышан», а у вас появится общая картотека на двоих.'
              : viaMail
                ? 'Письмо уже летит партнёру. Как только намёк услышат, статус в «Моих намёках» изменится на «Услышан».'
                : 'Бот уже отправил намёк партнёру. Когда он откроет идею, статус в «Моих намёках» изменится на «Услышан».'}
          </p>
          <div className="plate" style={{ marginTop: 16, padding: '16px 16px 0', overflow: 'hidden' }}>
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 8 }}>Что отправляем:</div>
            <div className="h3">
              {inviteLine(idea)}
            </div>
            <div style={{ marginTop: 16, marginBottom: -90 }}>
              <MiniCard idea={idea} w={190} h={220} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
            <button className="btn-primary" style={{ height: 46, padding: '0 10px' }} onClick={() => ctx.go({ name: 'hints', id: 'out' })}>Мои намёки</button>
            <button className="btn-ghost" onClick={() => ctx.go({ name: 'home' })}>В каталог</button>
          </div>
          {viaTg && (
            <div style={{ textAlign: 'center', marginTop: 6 }}>
              <button className="link-btn" onClick={again}><IconSend /> Не отправилось? Открыть Telegram ещё раз</button>
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= НАМЁК У ПОЛУЧАТЕЛЯ ================= */
// Открывается из уведомления. Секрет приходит только получателю и хранится на сервере; отправитель его не видит
export function HintView({ ctx, id }: { ctx: AppCtx; id: string }) {
  const hint = ctx.hints.find((h) => h.id === id);
  const idea = IDEAS.find((i) => i.id === hint?.ideaId) ?? IDEAS[0];
  if (!hint) {
    return (
      <div className="screen" style={{ paddingBottom: 130 }}>
        <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
        <div className="sheet" style={{ marginTop: 10, minHeight: '50dvh' }}>
          <div className="sheet-handle" />
          <div style={px}>
            <h1 className="h1" style={{ margin: '0 0 8px' }}>Намёк не найден</h1>
            <button className="btn-primary" onClick={() => ctx.go({ name: 'hints' })}>Мои намёки</button>
          </div>
        </div>
      </div>
    );
  }
  const heard = hint.status === 'услышан';
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h2" style={{ margin: '0 0 6px', textAlign: 'center' }}>{hint.from} намекает на&nbsp;свидание</h1>
        </div>
        <div style={{ marginTop: 10 }}><SingleCard idea={idea} height={250} /></div>
        <div style={{ ...px, marginTop: 18 }}>
          <div className="row-scroll" style={{ justifyContent: 'center' }}>
            <span className="param">{idea.duration}</span>
            <span className="param">{idea.price}</span>
            {idea.metro && <span className="param">{idea.metro}</span>}
          </div>
          <div className="plate" style={{ padding: '14px 16px', marginTop: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
              {idea.place ?? 'Название места'}{idea.metro ? ` · ${idea.metro}` : ''}
            </div>
            <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 4 }}>{idea.address ?? 'Санкт-Петербург, адрес уточняется'}</div>
            <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 6 }}>Время: {idea.duration} · Цена: {idea.price}</div>
          </div>
          {(idea.secret || hint.secret) && (
            <div style={{ marginTop: 12, padding: '14px 16px', borderRadius: 20, border: '2px solid var(--text)', background: '#fff' }}>
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: '18px' }}>Секрет только для тебя</div>
              <div style={{ fontSize: 13, lineHeight: '18px', marginTop: 6 }}>{idea.secret ?? hint.secret}</div>
            </div>
          )}
          {heard ? (
            <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => ctx.go({ name: 'hints' })}>Мои намёки</button>
          ) : (
            <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => { ctx.markHeard(hint.id); ctx.toast(`${hint.from} узнает, что вы услышали намёк`); ctx.go({ name: 'hints' }); }}>
              Намёк услышан
            </button>
          )}
          <div style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 10, textAlign: 'center' }}>
            Секрет видите только вы. {hint.from} его не увидит.
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= МОИ НАМЁКИ ================= */
export function MyHints({ ctx, id }: { ctx: AppCtx; id?: string }) {
  const valid = ctx.hints.filter((h) => IDEAS.some((i) => i.id === h.ideaId));
  const incoming = valid.filter((h) => h.dir === 'in');
  const outgoing = valid.filter((h) => h.dir !== 'in');
  // «Мне» идёт первой. После отправки своего намёка открываем «От меня»
  const [tab, setTab] = useState<'in' | 'out'>(id === 'out' || incoming.length === 0 ? 'out' : 'in');
  const list = tab === 'in' ? incoming : outgoing;
  const newCount = incoming.filter((h) => h.status === 'отправлен').length;
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10, minHeight: '60dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: 0 }}>Мои намёки</h1>
          <div className="row-scroll" style={{ marginTop: 14 }} role="tablist">
            <button role="tab" aria-selected={tab === 'in'} className={`chip ${tab === 'in' ? 'active' : ''}`} onClick={() => setTab('in')}>
              Мне{newCount > 0 ? ` · ${newCount}` : ''}
            </button>
            <button role="tab" aria-selected={tab === 'out'} className={`chip ${tab === 'out' ? 'active' : ''}`} onClick={() => setTab('out')}>От меня</button>
          </div>
        </div>
        <div style={{ ...pxList, marginTop: 16 }}>
          {list.length === 0 ? (
            <div className="plate" style={{ padding: 22, textAlign: 'center' }}>
              <div className="font-head" style={{ fontSize: 22 }}>Пока пусто</div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: '17px' }}>
                {tab === 'in'
                  ? 'Когда партнёр намекнёт на свидание, намёк и секрет от него появятся здесь.'
                  : 'Откройте карточку идеи и нажмите «Намекнуть о свидании» — первый намёк появится здесь.'}
              </p>
              {tab === 'out' && <button className="btn-primary" onClick={() => ctx.go({ name: 'home' })}>Выбрать идею</button>}
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {list.map((h) => {
                const idea = IDEAS.find((i) => i.id === h.ideaId)!;
                const isIn = h.dir === 'in';
                const heard = h.status === 'услышан';
                return (
                  <div
                    key={h.id} className="plate"
                    role={isIn ? 'button' : undefined} tabIndex={isIn ? 0 : undefined}
                    onClick={isIn ? () => ctx.go({ name: 'hint-view', id: h.id }) : undefined}
                    onKeyDown={isIn ? (e) => { if (e.key === 'Enter' || e.key === ' ') ctx.go({ name: 'hint-view', id: h.id }); } : undefined}
                    style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minHeight: 119, cursor: isIn ? 'pointer' : 'default' }}
                  >
                    <div style={{ width: 100, height: 100, flex: 'none', background: '#fff', borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idea.image ? (
                        <div className={cardCls(idea)} style={{ width: 48, height: 82, transform: 'rotate(-6deg)' }}><CardImage idea={idea} /></div>
                      ) : (
                      <div className="deck-card" style={{ width: 58, height: 82, transform: 'rotate(-6deg)' }}>
                        <Silhouette shape={idea.shape} color="var(--pink-shape)" />
                        <div style={{ position: 'absolute', top: 8, left: 0, right: 0, textAlign: 'center' }}><TinyLogo /></div>
                      </div>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, padding: '4px 0', display: 'flex', flexDirection: 'column', minHeight: 100 }}>
                      <div style={{ fontSize: 13, lineHeight: '16px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {idea.title}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 4 }}>{isIn ? `от ${h.from}` : h.to} · {h.date}</div>
                      <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`status ${heard ? 'status-ok' : 'status-neutral'}`}>
                          {heard ? (
                            <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="5" /><path d="M4.2 6.15 5.4 7.35 7.9 4.7" /></svg>
                          ) : (
                            <svg viewBox="0 0 12 12" fill="none" stroke="#fff" strokeWidth="0.9" strokeLinecap="round"><circle cx="6" cy="6" r="5" /><path d="M6 3.6v3.4" /><circle cx="6" cy="8.6" r="0.6" fill="#fff" stroke="none" /></svg>
                          )}
                          {heard ? 'Услышан' : isIn ? 'Новый' : 'Отправлен'}
                        </span>
                        {isIn && h.secret && <span className="status status-neutral">Есть секрет</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= ИЗБРАННОЕ ================= */
/* Каскад мини-карт из макета: x/y/поворот в координатах канваса 390px */
const FAN_POSES = [
  { x: 55, y: 0, rot: -16 },    // лавандовая, верх-лево
  { x: 194, y: 30, rot: 12.6 }, // голубая, верх-право
  { x: 134, y: 46, rot: -10.9 },// розовая, центр
  { x: 26, y: 100, rot: 4.6 },  // голубая, лево
  { x: 216, y: 138, rot: -9.2 },// жёлтая, право
  { x: 114, y: 164, rot: 9.2 }, // розовая, низ
];

export function Favorites({ ctx }: { ctx: AppCtx }) {
  const [cat, setCat] = useState<Category | 'все'>('все');
  const [priceF, setPriceF] = useState<PriceFilter | null>(null);
  const [durF, setDurF] = useState<DurFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const favs = IDEAS.filter((i) => ctx.favorites.includes(i.id));
  const list = favs.filter((i) => (cat === 'все' || i.category === cat) && matchPrice(i, priceF) && matchDur(i, durF));
  const fan = favs.slice(0, 6);
  const fanPoses = FAN_POSES.slice(0, fan.length);
  const fanHeight = fan.length ? Math.max(...fanPoses.map((p) => p.y)) + 190 : 0;
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 92 }} />
      {fan.length > 0 && (
        <div style={{ height: fanHeight, position: 'relative', width: '100%', maxWidth: 390, margin: '0 auto' }}>
          {fan.map((idea, k) => {
            const pose = fanPoses[k];
            return (
              <button
                key={idea.id}
                className={cardCls(idea)}
                onClick={() => ctx.go({ name: 'idea', id: idea.id })}
                style={{
                  position: 'absolute', width: idea.image ? 111 : 150, height: 190, borderRadius: idea.image ? 0 : 10,
                  left: pose.x + (idea.image ? 19 : 0), top: pose.y,
                  transform: `rotate(${pose.rot}deg)`, border: 'none', cursor: 'pointer',
                  zIndex: k + 1,
                  boxShadow: '0 6px 18px rgba(48,8,9,0.10)',
                }}
                aria-label={idea.title}
              >
                {idea.image ? <CardImage idea={idea} /> : (<>
                <Silhouette shape={idea.shape} color={cardShapeColor[idea.category]} />
                <div style={{ position: 'absolute', top: 10, left: 0, right: 0, textAlign: 'center' }}><TinyLogo /></div>
                <span className="font-head" style={{ position: 'absolute', inset: '38px 10px 8px', fontSize: 12, lineHeight: '13px', color: 'var(--card-ink)', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {idea.title}
                </span>
                </>)}
              </button>
            );
          })}
        </div>
      )}
      <div className="sheet" style={{ marginTop: fan.length ? 42 : 0, minHeight: '50dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: 0 }}>Всё избранное</h1>
        </div>
        <div className="row-scroll" style={{ ...px, marginTop: 10 }}>
          <FiltersButton onClick={() => setFiltersOpen(true)} active={!!(priceF || durF)} />
          <button className={`chip ${cat === 'все' ? 'active' : ''}`} onClick={() => setCat('все')}>Все</button>
          {CATEGORIES.map((c) => (
            <button key={c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
          ))}
        </div>
        <div style={{ ...px, marginTop: 15 }}>
          {list.length === 0 ? (
            <div className="plate" style={{ padding: 22, textAlign: 'center' }}>
              <div className="font-head" style={{ fontSize: 22 }}>Пока пусто</div>
              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: '17px', margin: '10px 0 0' }}>
                {favs.length === 0
                  ? 'Нажимайте на сердечко в карточке идеи — она появится здесь.'
                  : 'Под такие фильтры ничего не подходит — попробуйте их ослабить.'}
              </p>
              <div style={{ marginTop: 28, marginBottom: 6 }}>
                {favs.length === 0 ? (
                  <button className="btn-primary" onClick={() => ctx.go({ name: 'home' })}>В каталог</button>
                ) : (
                  <button className="btn-ghost" onClick={() => { setPriceF(null); setDurF(null); setCat('все'); }}>Сбросить фильтры</button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 6px' }}>
              {list.map((i) => <IdeaTile key={i.id} idea={i} onClick={() => ctx.go({ name: 'idea', id: i.id })} />)}
            </div>
          )}
        </div>
        <div style={{ height: 40 }} />
      </div>
      {filtersOpen && (
        <IdeaFiltersSheet
          price={priceF} dur={durF} count={list.length}
          onPrice={setPriceF} onDur={setDurF}
          onReset={() => { setPriceF(null); setDurF(null); }}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </div>
  );
}

/* ================= МАРШРУТЫ ================= */
export function RoutePhotoCard({ r, onClick }: { r: (typeof ROUTES)[number]; onClick: () => void }) {
  return (
    <button style={{ flex: '0 0 196px', width: 196, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column' }} onClick={onClick}>
      <div style={{ position: 'relative' }}>
        <PhotoStub hue={r.hue} src={r.cover ? placeSrc(r.cover) : undefined} style={{ width: 196, height: 200, borderRadius: 24 }} />
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {[...r.tags, r.price].map((t) => (
            <span key={t} className="photo-pill">{t}</span>
          ))}
        </div>
      </div>
      {/* Сверху строка параметров, ниже название на две строки: при разной длине заголовков ряд не «плывёт», пустое место остаётся снизу */}
      <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.district} · {r.duration}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.short ?? r.title}</div>
    </button>
  );
}

export function Routes({ ctx }: { ctx: AppCtx }) {
  const [district, setDistrict] = useState<string>('Все');
  const favs = ROUTES.filter((r) => r.favorite);
  const list = district === 'Все' ? ROUTES : ROUTES.filter((r) => r.district === district);
  const grouped = DISTRICTS.map((d) => ({ d, items: list.filter((r) => r.district === d) })).filter((g) => g.items.length > 0);
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <Suspense fallback={<MapStub markers={7} height={350} />}>
        <StreetMap mode="overview" height={350} onSelectRoute={(id) => ctx.go({ name: 'route', id })} />
      </Suspense>
      <div className="sheet" style={{ marginTop: -40 }}>
        <div className="sheet-handle" />
        <div style={px}><h1 className="h1" style={{ margin: 0 }}>Избранные маршруты</h1></div>
        <div className="row-scroll" style={{ ...px, marginTop: 19, gap: 10, alignItems: 'flex-start' }}>
          {favs.map((r) => (
            <RoutePhotoCard key={r.id} r={r} onClick={() => ctx.go({ name: 'route', id: r.id })} />
          ))}
        </div>

        <div style={{ ...px, marginTop: 30 }}>
          <h1 className="h1" style={{ margin: 0 }}>Все маршруты</h1>
        </div>
        <div className="row-scroll" style={{ ...px, marginTop: 10 }}>
          <FiltersButton onClick={() => ctx.toast('Тонкие фильтры появятся в боевой версии')} />
          <button className={`chip ${district === 'Все' ? 'active' : ''}`} onClick={() => setDistrict('Все')}>Все</button>
          {DISTRICTS.map((d) => (
            <button key={d} className={`chip ${district === d ? 'active' : ''}`} onClick={() => setDistrict(d)}>{d}</button>
          ))}
        </div>
        <div style={pxList}>
          {grouped.map((g) => (
            <div key={g.d} style={{ marginTop: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, padding: '0 10px' }}>{g.d}</div>
              <div style={{ display: 'grid', gap: 10 }}>
                {g.items.map((r) => (
                  <button key={r.id} className="plate" style={{ display: 'flex', gap: 14, alignItems: 'center', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 10 }} onClick={() => ctx.go({ name: 'route', id: r.id })}>
                    <div style={{ position: 'relative', flex: 'none' }}>
                      <PhotoStub hue={r.hue} src={r.cover ? placeSrc(r.cover) : undefined} style={{ width: 100, height: 100, borderRadius: 20 }} />
                      <span className="photo-pill small" style={{ position: 'absolute', top: 8, left: 8 }}>{r.district}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, lineHeight: '16px', fontWeight: 600 }}>{r.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, lineHeight: '14px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= МАРШРУТ: ДЕТАЛЬ ================= */
/* Фото места: одно — целиком, несколько — стопкой с наклоном; тап открывает все */
export function PlacePhotos({ names, hue, onOpen }: { names: string[]; hue: number; onOpen: () => void }) {
  const src = (n: string) => placeSrc(n);
  if (names.length === 0) return <PhotoStub hue={hue} style={{ height: 130, borderRadius: 20 }} />;
  if (names.length === 1) {
    return <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label="Открыть фото" style={{ border: 'none', padding: 0, background: 'none', display: 'block', width: '100%', cursor: 'zoom-in' }}>
      <img src={src(names[0])} alt="" loading="lazy" style={{ width: '100%', height: 130, objectFit: 'cover', borderRadius: 20, display: 'block' }} />
    </button>;
  }
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} aria-label={`Открыть фото, всего ${names.length}`} style={{ border: 'none', padding: 0, background: 'none', display: 'block', width: '100%', height: 150, position: 'relative', cursor: 'zoom-in', overflow: 'hidden' }}>
      <img src={src(names[0])} alt="" loading="lazy" style={{ position: 'absolute', left: 2, top: 14, width: '58%', height: 128, objectFit: 'cover', borderRadius: 18, transform: 'rotate(-5deg)', boxShadow: '0 4px 12px rgba(20,30,60,.18)' }} />
      <img src={src(names[1])} alt="" loading="lazy" style={{ position: 'absolute', right: 2, top: 4, width: '58%', height: 128, objectFit: 'cover', borderRadius: 18, transform: 'rotate(3deg)', border: '3px solid #fff', boxShadow: '0 4px 12px rgba(20,30,60,.22)' }} />
      {names.length > 2 && <span className="photo-pill small" style={{ position: 'absolute', right: 8, bottom: 6 }}>+{names.length - 2}</span>}
    </button>
  );
}

function PhotoViewer({ names, start, onClose }: { names: string[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  React.useEffect(() => { const el = ref.current; if (el) el.scrollLeft = el.clientWidth * start; }, [start]);
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label="Фото места" style={{ alignItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%' }}>
        <div ref={ref} style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none' }}>
          {names.map((n) => (
            <div key={n} style={{ flex: '0 0 100%', scrollSnapAlign: 'center', padding: '0 16px', boxSizing: 'border-box' }}>
              <img src={placeSrc(n)} alt="" style={{ width: '100%', maxHeight: '70dvh', objectFit: 'cover', borderRadius: 24, display: 'block' }} />
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          {names.length > 1 && <div style={{ fontSize: 12, color: '#fff', marginBottom: 10 }}>Листайте вбок · {names.length} фото</div>}
          <button className="btn-ghost" style={{ background: '#fff' }} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  );
}

export function RouteDetail({ ctx, id }: { ctx: AppCtx; id: string }) {
  const route = ROUTES.find((r) => r.id === id) ?? ROUTES[0];
  const geo = ROUTE_GEO[route.id];
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<{ names: string[]; start: number } | null>(null);
  const cards = useRef<(HTMLDivElement | null)[]>([]);
  const select = (i: number, scroll = true) => {
    setActive(i);
    if (scroll) cards.current[i]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <Suspense fallback={<MapStub markers={route.points.length + 2} route height={330} />}>
        <StreetMap mode="route" routeId={route.id} active={active} height={330} onSelectPoint={(i) => select(i)} />
      </Suspense>
      <div className="sheet" style={{ marginTop: -40 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h2" style={{ margin: 0 }}>{route.title}</h1>
          <div className="row-scroll" style={{ marginTop: 14 }}>
            <span className="param">{route.district}</span>
            <span className="param">{route.duration}</span>
            {geo && <span className="param">{geo.km.toString().replace('.', ',')} км пешком</span>}
            <span className="param">{route.price}</span>
          </div>
          <p style={{ fontSize: 13, lineHeight: '17px', margin: '14px 0 0', maxWidth: 330 }}>{route.description}</p>
          {geo && (
            <>
              <button className="btn-ghost" style={{ width: '100%', marginTop: 16, gap: 8 }} onClick={() => openExternal(yandexRoute(geo.points))}>
                <IconPin /> Посмотреть маршрут в Яндекс Картах
              </button>
              {geo.points.some((q) => q.approx) && (
                <div style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 8 }}>Часть точек поставлена примерно, сверяйтесь с названиями мест.</div>
              )}
            </>
          )}
        </div>
        <div style={{ ...px, marginTop: 20 }}>
          <h2 className="h3" style={{ margin: 0 }}>Точки маршрута</h2>
        </div>
        <div className="row-scroll" style={{ ...px, scrollPaddingLeft: 30, marginTop: 12, gap: 10, alignItems: 'stretch', scrollSnapType: 'x mandatory' }}>
          {route.points.map((p, i) => {
            const approx = geo?.points[i]?.approx;
            return (
              <div
                key={i}
                ref={(el) => { cards.current[i] = el; }}
                className="plate"
                role="button" tabIndex={0}
                onClick={() => select(i, false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') select(i, false); }}
                style={{
                  flex: '0 0 232px', width: 232, padding: 10, scrollSnapAlign: 'start', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: active === i ? 'inset 0 0 0 2px var(--primary)' : 'none',
                  transition: 'box-shadow .2s ease',
                }}
              >
                <div style={{ position: 'relative' }}>
                  <PlacePhotos names={p.photos ?? (p.photo ? [p.photo] : [])} hue={route.hue + i * 40} onOpen={() => { select(i, false); setViewer({ names: p.photos ?? (p.photo ? [p.photo] : []), start: 0 }); }} />
                  <span className={`map-pin ${approx ? 'approx' : ''}`} style={{ position: 'absolute', top: 8, left: 8 }}>{i + 1}</span>
                </div>
                <div className="h3" style={{ margin: '12px 6px 6px', fontSize: 20, lineHeight: '21px' }}>{p.title}</div>
                <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', margin: '0 6px 6px' }}>{p.text}</div>
                <div style={{ marginTop: 'auto', paddingTop: 6 }}>
                  {approx && <div style={{ fontSize: 10, lineHeight: '13px', color: 'var(--text-2)', margin: '0 6px' }}>Место на карте примерное</div>}
                  {geo?.points[i] && (
                    <button className="link-btn" style={{ padding: '6px' }} onClick={(ev) => { ev.stopPropagation(); openExternal(yandexPoint(geo.points[i])); }}>
                      <IconPin /> Открыть на карте
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div style={px}>
          <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '0 16px' }} onClick={() => ctx.startHint(IDEAS[0].id)}>Намекнуть о свидании</button>
            <button className={`round-icon-btn ${ctx.favorites.includes(route.id) ? 'liked' : ''}`} onClick={() => ctx.toggleFavorite(route.id)} aria-label="В избранное"><IconHeart filled={ctx.favorites.includes(route.id)} /></button>
            <button className="round-icon-btn" onClick={() => ctx.toast('Ссылка скопирована')} aria-label="Поделиться"><IconShare /></button>
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
      {viewer && <PhotoViewer names={viewer.names} start={viewer.start} onClose={() => setViewer(null)} />}
    </div>
  );
}

/* ================= АФИША НЕДЕЛИ ================= */
type DayF = 'week' | 'today' | 'weekend';

/** Содержимое шторки события: фото, параметры, название, описание. Используется и в приложении, и в предпросмотре админки */
export function EventDetailBody({ e }: { e: CityEvent }) {
  const d = weekInfo().day(e.dayOffset);
  return (
    <>
      <PhotoStub hue={e.hue} src={e.photo ? eventSrc(e.photo) : undefined} style={{ height: 170, borderRadius: 28 }} />
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 14 }}>
        <span className="param">{d.short}, {e.time}</span>
        <span className="param">{e.price}</span>
        {e.sponsored && <span className="param">Реклама</span>}
      </div>
      <h2 className="h3" style={{ margin: '12px 0 4px' }}>{e.title}</h2>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>{e.place}</div>
      <p style={{ fontSize: 13, lineHeight: '17px', margin: '12px 0 0' }}>{e.description}</p>
      {e.sponsored && (
        <p style={{ fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', margin: '10px 0 0' }}>
          Реклама.{e.advertiser ? ` ${e.advertiser}.` : ''}{e.erid ? ` erid: ${e.erid}` : ' Рекламодатель и erid указываются здесь по закону о рекламе.'}
        </p>
      )}
    </>
  );
}

const evPill = (e: CityEvent) => `${weekInfo().day(e.dayOffset).short.slice(0, 2)} ${e.time}`;

/** Большая карточка «Выбор To Date» */
export function EventPick({ e, onClick }: { e: CityEvent; onClick?: () => void }) {
  return (
    <button style={{ flex: '0 0 252px', width: 252, border: 'none', background: 'none', padding: 0, textAlign: 'left', cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      <div style={{ position: 'relative' }}>
        <PhotoStub hue={e.hue} src={e.photo ? eventSrc(e.photo) : undefined} style={{ width: 252, height: 230, borderRadius: 30 }} />
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          <span className="photo-pill">{evPill(e)}</span>
          <span className="photo-pill">{e.price}</span>
          {e.sponsored && <span className="photo-pill">Реклама</span>}
        </div>
      </div>
      <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.place}</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2, lineHeight: '18px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.title}</div>
    </button>
  );
}

/** Строка афиши в списке */
export function EventRow({ e, onClick }: { e: CityEvent; onClick?: () => void }) {
  return (
    <button className="plate" style={{ display: 'flex', gap: 14, alignItems: 'center', border: 'none', cursor: onClick ? 'pointer' : 'default', textAlign: 'left', padding: 10, width: '100%' }} onClick={onClick}>
      <div style={{ position: 'relative', flex: 'none' }}>
        <PhotoStub hue={e.hue} src={e.photo ? eventSrc(e.photo) : undefined} style={{ width: 100, height: 100, borderRadius: 20 }} />
        <span className="photo-pill small" style={{ position: 'absolute', top: 8, left: 8 }}>{e.time}</span>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, lineHeight: '16px', fontWeight: 600, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{e.title}</div>
        <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 4, lineHeight: '14px' }}>{e.place} · {e.price}</div>
        {e.sponsored && <div style={{ fontSize: 10, lineHeight: '12px', color: 'var(--text-2)', marginTop: 4 }}>Реклама</div>}
      </div>
    </button>
  );
}

function EventSheet({ e, onClose, ctx }: { e: CityEvent; onClose: () => void; ctx: AppCtx }) {
  const [invite, setInvite] = useState(false);
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-label={e.title}>
      <div className="modal-sheet" onClick={(ev) => ev.stopPropagation()}>
        <div className="sheet-handle" style={{ position: 'static', margin: '6px auto 14px' }} />
        <EventDetailBody e={e} />
        <div style={{ display: 'grid', gap: 8, marginTop: 18 }}>
          <button className="btn-primary" style={{ gap: 8 }} onClick={() => {
            if (ctx.profile.partnerStatus === 'linked') { onClose(); ctx.toast('Бот отправил приглашение партнёру (демо)'); }
            else setInvite(true);
          }}>
            <IconSend /> Позвать на свидание
          </button>
          <button className="btn-ghost" style={{ gap: 8 }} onClick={() => openExternal(yandexSearch(e.place))}>
            <IconPin /> Открыть в Яндекс Картах
          </button>
          <button className="btn-ghost" onClick={() => { if (e.link) openExternal(e.link); else ctx.toast('Здесь будет ссылка на страницу партнёра'); }}>Подробнее</button>
        </div>
      </div>
      {invite && <InviteSheet ctx={ctx} onClose={() => setInvite(false)} />}
    </div>
  );
}

export function Events({ ctx }: { ctx: AppCtx }) {
  const wk = weekInfo();
  const [day, setDay] = useState<DayF>('week');
  const [cat, setCat] = useState<string>('все');
  const [open, setOpen] = useState<CityEvent | null>(null);

  const list = useMemo(
    () =>
      EVENTS.filter((e) => e.dayOffset >= wk.todayOffset && e.dayOffset <= 6)
        .filter((e) => (day === 'week' ? true : day === 'today' ? e.dayOffset === wk.todayOffset : e.dayOffset >= 5))
        .filter((e) => cat === 'все' || e.category === cat)
        .sort((a, b) => a.dayOffset - b.dayOffset || a.time.localeCompare(b.time)),
    [day, cat, wk.todayOffset],
  );
  const days = [...new Set(list.map((e) => e.dayOffset))];
  const picks = EVENTS.filter((e) => e.pick && e.dayOffset >= wk.todayOffset && e.dayOffset <= 6);
  const noFilters = day === 'week' && cat === 'все';
  const reset = () => { setDay('week'); setCat('все'); };

  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10, minHeight: '70dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: 0 }}>Афиша недели</h1>
          <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 6 }}>{wk.label} · от наших партнёров</div>
        </div>

        <div className="row-scroll" style={{ ...px, marginTop: 14 }}>
          {([['week', 'Вся неделя'], ['today', 'Сегодня'], ['weekend', 'Выходные']] as [DayF, string][]).map(([k, l]) => (
            <button key={k} className={`chip ${day === k ? 'active' : ''}`} onClick={() => setDay(k)}>{l}</button>
          ))}
        </div>
        <div className="row-scroll" style={{ ...px, marginTop: 8 }}>
          <button className={`chip ${cat === 'все' ? 'active' : ''}`} onClick={() => setCat('все')}>Все</button>
          {EVENT_CATEGORIES.map((c) => (
            <button key={c.key} className={`chip ${cat === c.key ? 'active' : ''}`} onClick={() => setCat(c.key)}>{c.label}</button>
          ))}
        </div>

        {noFilters && picks.length > 0 && (
          <>
            <div style={{ ...px, marginTop: 26 }}><h2 className="h2" style={{ margin: 0 }}>Выбор To Date</h2></div>
            <div className="row-scroll" style={{ ...px, marginTop: 14, gap: 10, alignItems: 'flex-start' }}>
              {picks.map((e) => <EventPick key={e.id} e={e} onClick={() => setOpen(e)} />)}
            </div>
          </>
        )}

        <div style={{ ...px, marginTop: 28 }}><h2 className="h2" style={{ margin: 0 }}>{noFilters ? 'Вся афиша' : 'Найдено'}</h2></div>
        <div style={pxList}>
          {list.length === 0 && (
            <div className="plate" style={{ marginTop: 14, padding: '22px 22px 26px', textAlign: 'center' }}>
              <div className="font-head" style={{ fontSize: 22 }}>Пока пусто</div>
              <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', margin: '6px 0 18px' }}>На этот день или в этой категории событий нет. Попробуйте другой день или категорию.</p>
              <button className="btn-ghost" onClick={reset}>Сбросить фильтры</button>
            </div>
          )}
          {days.map((dn) => (
            <div key={dn} style={{ marginTop: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, padding: '0 10px' }}>
                {wk.day(dn).short}{dn === wk.todayOffset ? ' · сегодня' : ''}
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {list.filter((e) => e.dayOffset === dn).map((e) => <EventRow key={e.id} e={e} onClick={() => setOpen(e)} />)}
              </div>
            </div>
          ))}
        </div>
        {list.some((e) => e.sponsored) && (
          <p style={{ ...px, fontSize: 11, lineHeight: '14px', color: 'var(--text-2)', marginTop: 20 }}>
            Пометка «Реклама» означает размещение партнёра.
          </p>
        )}
        <div style={{ height: 40 }} />
      </div>
      {open && <EventSheet e={open} onClose={() => setOpen(null)} ctx={ctx} />}
    </div>
  );
}

/* ================= ПРОФИЛЬ ================= */
export function Profile({ ctx }: { ctx: AppCtx }) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const row = (icon: React.ReactNode, label: string, onClick: () => void) => (
    <button key={label} onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', height: 54, background: 'none', border: 'none', cursor: 'pointer', padding: '0 16px', fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
      <span style={{ color: 'var(--primary)' }}>{icon}</span>
      <span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
      <span style={{ color: 'var(--stroke)' }}><IconChevron /></span>
    </button>
  );
  const ps = ctx.profile.partnerStatus;
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 130, background: 'radial-gradient(60% 100% at 50% 0%, #C5D6EF 0%, var(--bg) 75%)' }} />
      <div className="sheet" style={{ marginTop: 0, minHeight: '55dvh', paddingTop: 32 }}>
        <div style={{ textAlign: 'center', marginTop: 0 }}>
          {/* Аватарка целиком внутри плашки; фото профиля берётся из ctx.profile.avatar, пока его нет — первая буква имени */}
          <div className="avatar-fab" style={{ width: 96, height: 96, margin: '0 auto', cursor: 'default' }}>
            <span style={{ width: 88, height: 88, fontSize: 34 }}>
              {ctx.profile.avatar ? <img src={ctx.profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ctx.profile.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="h1" style={{ marginTop: 12 }}>{ctx.profile.name}</div>
        </div>
        <div style={{ ...pxList, marginTop: 24, display: 'grid', gap: 18 }}>
          <div className="plate" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: 'var(--primary)', flex: 'none' }}><IconHeart filled={ps === 'linked'} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>
                {ps === 'linked' ? 'Аккаунты синхронизированы' : ps === 'invited' ? 'Ждём партнёра' : 'Партнёр не подключён'}
              </div>
              <div style={{ fontSize: 12, lineHeight: '16px', color: 'var(--text-2)', marginTop: 2 }}>
                {ps === 'linked' ? `Вы в паре: ${ctx.profile.partnerName ?? 'партнёр'}. Сюрпризы работают в обе стороны.` : ps === 'invited' ? 'Он нажмёт «Старт» у бота, и аккаунты свяжутся.' : 'Пригласите его, чтобы открылись сюрпризы.'}
              </div>
            </div>
            {ps !== 'linked' && (
              <button className="btn-ghost" style={{ height: 38, padding: '0 14px', flex: 'none' }} onClick={() => setInviteOpen(true)}>
                {ps === 'invited' ? 'Ещё раз' : 'Пригласить'}
              </button>
            )}
          </div>
          <div className="plate" style={{ padding: 0, overflow: 'hidden' }}>
            {row(<IconHeart />, 'Избранное', () => ctx.go({ name: 'favorites' }))}
            <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px 0 60px' }} />
            {row(<IconChat />, 'Мои намёки', () => ctx.go({ name: 'hints' }))}
          </div>
          <div className="plate" style={{ padding: 0, overflow: 'hidden' }}>
            {row(<IconUser />, 'Аккаунт', () => ctx.go({ name: 'account' }))}
            <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px 0 60px' }} />
            {row(<IconTheme />, 'Тема', () => ctx.toast('Светлая тема. Тёмная — в планах'))}
            <div style={{ height: 1, background: 'var(--divider)', margin: '0 16px 0 60px' }} />
            {row(<IconLang />, 'Язык', () => ctx.toast('Пока только русский'))}
          </div>
          <div className="plate" style={{ padding: 0, overflow: 'hidden' }}>
            {ctx.profile.isAdmin
              ? row(<IconSliders />, 'Админка', () => ctx.go({ name: 'admin' }))
              : row(<IconSliders />, 'Только в прототипе: войти как админ', () => { ctx.setProfile({ ...ctx.profile, isAdmin: true }); ctx.go({ name: 'admin' }); })}
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
      {inviteOpen && <InviteSheet ctx={ctx} onClose={() => setInviteOpen(false)} />}
    </div>
  );
}

/* ================= АККАУНТ ================= */
export function Account({ ctx }: { ctx: AppCtx }) {
  const [name, setName] = useState(ctx.profile.name);
  const [email, setEmail] = useState(ctx.profile.email);
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10, minHeight: '60dvh' }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 16px' }}>Аккаунт</h1>
          <div className="plate" style={{ display: 'grid', gap: 12, padding: 16 }}>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Имя</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>E-mail</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" />
            </div>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Половинка</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 13, color: ctx.profile.partner ? 'var(--text)' : 'var(--text-2)', minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {ctx.profile.partner ? `Приглашение отправлено: ${ctx.profile.partner}` : 'Партнёр ещё не приглашён'}
                </div>
                <button className="btn-ghost" style={{ height: 40, flex: 'none' }} onClick={() => ctx.go({ name: 'invite' })}>
                  {ctx.profile.partner ? 'Изменить' : 'Пригласить'}
                </button>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, display: 'block', marginBottom: 6 }}>Подписка</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, fontSize: 13, color: ctx.subscribed ? 'var(--text)' : 'var(--text-2)', minHeight: 40, display: 'flex', alignItems: 'center' }}>
                  {ctx.subscribed ? `Активна · осталось ${ctx.subscribed} дн.` : 'Не оформлена'}
                </div>
                <button className="btn-ghost" style={{ height: 40, flex: 'none' }} onClick={() => ctx.go({ name: 'paywall' })}>
                  {ctx.subscribed ? 'Продлить' : 'Оформить'}
                </button>
              </div>
            </div>
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => { ctx.setProfile({ ...ctx.profile, name: name.trim() || 'Гость', email }); ctx.toast('Сохранено'); ctx.back(); }}>
            Сохранить
          </button>
          <div style={{ marginTop: 14 }}>
            <button style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'underline', padding: 4 }} onClick={() => ctx.back()}>
              ← Назад к профилю
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 12, lineHeight: '15px' }}>
            В MVP данные хранятся только в этом браузере (localStorage). Регистрация по почте и синхронизация пары появятся в боевой версии.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= ПОДПИСКА ================= */
export function Paywall({ ctx }: { ctx: AppCtx }) {
  const [plan, setPlan] = useState('month');
  const chosen = PLANS.find((p) => p.id === plan)!;
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>Подписка</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            Полный доступ к картотеке, маршрутам, афише и неограниченным намёкам. Оплата рублями — Продамус или ЮKassa (подключим в боевой версии).
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {PLANS.map((p) => (
              <button
                key={p.id}
                className="plate"
                onClick={() => setPlan(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '16px',
                  border: plan === p.id ? '2px solid var(--primary)' : '2px solid transparent', background: 'var(--bg)', position: 'relative',
                }}
              >
                {p.best && <span style={{ position: 'absolute', top: -10, right: 14, background: 'var(--primary)', color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '3px 10px' }}>выгодно</span>}
                <span style={{ textAlign: 'left' }}>
                  <span style={{ display: 'block', fontWeight: 600, fontSize: 15 }}>{p.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{p.per}</span>
                </span>
                <span className="font-head" style={{ fontSize: 26 }}>{p.price}</span>
              </button>
            ))}
          </div>
          <button className="btn-primary" style={{ width: '100%', marginTop: 16 }} onClick={() => { ctx.subscribe(chosen.days); ctx.toast('Подписка активна (демо)'); ctx.go({ name: 'home' }); }}>
            Оформить за {chosen.price} — демо
          </button>
          <div style={{ marginTop: 14 }}>
            <button style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'underline', padding: 4 }} onClick={() => ctx.back()}>
              ← Назад
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 12, textAlign: 'center', lineHeight: '15px' }}>
            В прототипе оплата не списывается: подписка включается локально для демонстрации.
          </p>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}

/* ================= БЕСПЛАТНЫЕ НАМЁКИ ЗАКОНЧИЛИСЬ ================= */
// Два бонусных намёка даём без подписки. На третьем нажатии «Намекнуть» открывается эта шторка

export function LimitSheet({ ctx, onClose, onReset }: { ctx: AppCtx; onClose: () => void; onReset: () => void }) {
  const [plan, setPlan] = useState('month');
  const chosen = PLANS.find((p) => p.id === plan)!;
  const perks = ['Намёки партнёру без ограничений', 'Все 70 карточек и новые каждую неделю', 'Маршруты и афиша недели'];
  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="limit-title">
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-handle" style={{ position: 'static', margin: '6px auto 14px' }} />
        <div id="limit-title" className="h3" style={{ margin: '0 0 8px' }}>Бесплатные намёки закончились</div>
        <p style={{ fontSize: 13, lineHeight: '17px', margin: 0 }}>
          Вы использовали {numWord(getFreeHints())} {plural(getFreeHints(), 'бонусный намёк', 'бонусных намёка', 'бонусных намёков')}. Чтобы свиданий в вашей жизни становилось больше, оформите подписку.
        </p>
        <div style={{ display: 'grid', gap: 8, margin: '14px 0 0', padding: 0 }}>
          {perks.map((t) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 13, lineHeight: '17px' }}>
              <span style={{ color: 'var(--primary)', display: 'inline-flex', flex: 'none' }}><IconCheck /></span>{t}
            </div>
          ))}
        </div>
        <div role="radiogroup" aria-label="Срок подписки" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
          {PLANS.map((p) => {
            const on = plan === p.id;
            return (
              <button
                key={p.id} role="radio" aria-checked={on} onClick={() => setPlan(p.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                  minHeight: 72, padding: '10px 4px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                  border: `2px solid ${on ? 'var(--primary)' : 'var(--line, #D9DDE5)'}`,
                  background: on ? 'var(--primary)' : '#fff', color: on ? '#fff' : 'var(--text)',
                }}
              >
                <span style={{ fontSize: 12, lineHeight: '14px' }}>{p.title}</span>
                <span className="font-head" style={{ fontSize: 22, lineHeight: '22px', whiteSpace: 'nowrap' }}>{p.price}</span>
              </button>
            );
          })}
        </div>
        <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
          <button className="btn-primary" onClick={() => { ctx.subscribe(chosen.days); onClose(); ctx.toast('Подписка активна (демо)'); }}>
            Оформить за {chosen.price}
          </button>
          <button className="btn-ghost" onClick={onClose}>Не сейчас</button>
          <button className="link-btn" style={{ justifyContent: 'center', color: 'var(--text-2)', fontWeight: 500, fontSize: 12 }} onClick={onReset}>
            Только в прототипе: вернуть бесплатные намёки
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= ЗАМЕТКИ НА ПОЛЯХ ================= */
export function NoteCard({ n }: { n: { author: string; text: string; contact: string } }) {
  return (
    <div className="plate" style={{ padding: '14px 16px' }}>
      <div style={{ fontWeight: 600, fontSize: 13 }}>{n.author}</div>
      <div style={{ fontSize: 13, lineHeight: '17px', margin: '4px 0' }}>{n.text}</div>
      <div style={{ fontSize: 11, color: 'var(--primary-dark)' }}>{n.contact}</div>
    </div>
  );
}

export function Notes({ ctx }: { ctx: AppCtx }) {
  const [text, setText] = useState('');
  const [contact, setContact] = useState('');
  const valid = text.trim().length >= 10 && contact.trim().length >= 2;
  return (
    <div className="screen" style={{ paddingBottom: 130 }}>
      <div style={{ height: 'calc(84px + var(--safe-top, 0px))' }} />
      <div className="sheet" style={{ marginTop: 10 }}>
        <div className="sheet-handle" />
        <div style={px}>
          <h1 className="h1" style={{ margin: '0 0 8px' }}>Заметки на полях</h1>
          <p style={{ fontSize: 13, lineHeight: '17px', color: 'var(--text-2)', marginTop: 0, maxWidth: 330 }}>
            Расскажите о себе, своём бизнесе или найдите друзей. Размещение — за символические 99 ₽ на неделю.
          </p>
          <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
            {NOTES.map((n) => <NoteCard key={n.id} n={n} />)}
          </div>
          <div className="plate" style={{ marginTop: 16, padding: 16, display: 'grid', gap: 10 }}>
            <div className="h3">Оставить заметку</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Текст заметки — о себе, бизнесе или поиске друзей"
              style={{ minHeight: 76, borderRadius: 16, border: '1px solid #B4B5B6', padding: '10px 14px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', outline: 'none', background: '#fff' }}
            />
            <input className="input" placeholder="Контакт: @telegram или e-mail" value={contact} onChange={(e) => setContact(e.target.value)} />
            <button className="btn-primary" disabled={!valid} onClick={() => {
              // в демо заметка попадает в очередь админки на этом же устройстве; в боевой версии — на сервер после оплаты
              ctx.saveAdmin({ ...ctx.admin, notesPending: [...ctx.admin.notesPending, { id: `p${Date.now()}`, author: ctx.profile.name || 'Гость', text: text.trim().slice(0, 400), contact: contact.trim().slice(0, 80) }] });
              setText(''); setContact(''); ctx.toast('Заметка отправлена на модерацию (демо)');
            }}>
              Разместить за 99 ₽ — демо
            </button>
          </div>
          <div style={{ marginTop: 14 }}>
            <button style={{ background: 'none', border: 'none', fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', textDecoration: 'underline', padding: 4 }} onClick={() => ctx.back()}>
              ← Назад
            </button>
          </div>
        </div>
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
