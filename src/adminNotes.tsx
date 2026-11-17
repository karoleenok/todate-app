/* Админка: «заметки на полях». Очередь на проверку, опубликованные, добавление вручную. */
import { useState } from 'react';
import type { AppCtx } from './App';
import { NOTES, type Note } from './data';
import { BASE, newId, type AdminState } from './store';
import { NoteCard } from './screens';
import { DangerButton, Empty, Field, SectionTitle, Shell, Tag, area, useDesk } from './adminUi';

function NoteForm({ initial, submitLabel, onSubmit, onCancel }: { initial?: Note; submitLabel: string; onSubmit: (n: Omit<Note, 'id'>) => void; onCancel?: () => void }) {
  const [f, setF] = useState({ author: initial?.author ?? '', text: initial?.text ?? '', contact: initial?.contact ?? '' });
  const valid = f.author.trim().length >= 2 && f.text.trim().length >= 10 && f.contact.trim().length >= 2;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((v) => ({ ...v, [k]: e.target.value }));
  return (
    <div className="adm-notebox">
      <div>
        <Field id="n-author" label="Кто"><input id="n-author" className="input" value={f.author} onChange={set('author')} maxLength={60} placeholder="Имя или название" /></Field>
        <Field id="n-text" label="Текст"><textarea id="n-text" style={{ ...area, minHeight: 84 }} value={f.text} onChange={set('text')} maxLength={400} /></Field>
        <Field id="n-contact" label="Контакт" hint="@telegram, сайт или e-mail"><input id="n-contact" className="input" value={f.contact} onChange={set('contact')} maxLength={80} /></Field>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn-primary" disabled={!valid} onClick={() => onSubmit({ author: f.author.trim(), text: f.text.trim(), contact: f.contact.trim() })}>{submitLabel}</button>
          {onCancel && <button className="btn-ghost" onClick={onCancel}>Отмена</button>}
        </div>
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>Так увидят в приложении</div>
        <NoteCard n={{ author: f.author || 'Имя', text: f.text || 'Текст заметки', contact: f.contact || '@контакт' }} />
      </div>
    </div>
  );
}

export function NotesPage({ ctx, save }: { ctx: AppCtx; save: (a: AdminState, m?: string) => void }) {
  const a = ctx.admin;
  const desk = useDesk();
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const hidden = BASE.notes.filter((n) => a.notesHidden.includes(n.id));

  const publish = (n: Note) => save({ ...a, notesPending: a.notesPending.filter((x) => x.id !== n.id), notesAdded: [...a.notesAdded, { ...n, id: newId('n') }] }, 'Заметка опубликована');
  const reject = (n: Note) => save({ ...a, notesPending: a.notesPending.filter((x) => x.id !== n.id) }, 'Заметка отклонена');
  const isAdded = (id: string) => a.notesAdded.some((n) => n.id === id);
  const edit = (id: string, v: Omit<Note, 'id'>) => {
    if (isAdded(id)) save({ ...a, notesAdded: a.notesAdded.map((n) => (n.id === id ? { ...n, ...v } : n)) });
    else save({ ...a, noteEdits: { ...a.noteEdits, [id]: v } });
    setEditing(null);
  };
  const remove = (id: string) => {
    if (isAdded(id)) save({ ...a, notesAdded: a.notesAdded.filter((n) => n.id !== id) }, 'Заметка удалена');
    else save({ ...a, notesHidden: [...a.notesHidden, id] }, 'Заметка скрыта');
  };

  return (
    <Shell
      ctx={ctx} title="Заметки на полях" back={!desk} narrow={860}
      sub="Объявления пользователей и партнёров. Новые заявки сначала попадают на проверку, в приложении появляется только то, что вы опубликовали."
      actions={<button className="btn-primary" onClick={() => setAdding(true)}>+ Добавить заметку</button>}
    >
      {adding && (
        <div className="plate" style={{ padding: 16, marginBottom: 18 }}>
          <div className="h3" style={{ marginBottom: 12 }}>Новая заметка</div>
          <NoteForm submitLabel="Опубликовать" onCancel={() => setAdding(false)} onSubmit={(v) => { save({ ...a, notesAdded: [...a.notesAdded, { ...v, id: newId('n') }] }, 'Заметка опубликована'); setAdding(false); }} />
        </div>
      )}

      <SectionTitle right={<Tag tone={a.notesPending.length ? 'pink' : 'gray'}>{a.notesPending.length}</Tag>}>На проверке</SectionTitle>
      {a.notesPending.length === 0
        ? <Empty title="Заявок нет" text="Когда кто-то оставит заметку в приложении, она появится здесь." />
        : (
          <div style={{ display: 'grid', gap: 10 }}>
            {a.notesPending.map((n) => (
              <div key={n.id} className="plate" style={{ padding: 12 }}>
                <NoteCard n={n} />
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn-primary" style={{ height: 42 }} onClick={() => publish(n)}>Опубликовать</button>
                  <button className="btn-ghost" onClick={() => reject(n)}>Отклонить</button>
                </div>
              </div>
            ))}
          </div>
        )}

      <SectionTitle right={<Tag>{NOTES.length}</Tag>}>В приложении</SectionTitle>
      {NOTES.length === 0 && <Empty title="Пока ни одной заметки" text="Добавьте заметку вручную или опубликуйте заявку из очереди." />}
      <div style={{ display: 'grid', gap: 10 }}>
        {NOTES.map((n) => (
          <div key={n.id}>
            {editing === n.id ? (
              <div className="plate" style={{ padding: 16 }}>
                <NoteForm initial={n} submitLabel="Сохранить" onCancel={() => setEditing(null)} onSubmit={(v) => edit(n.id, v)} />
              </div>
            ) : (
              <div className="adm-noterow">
                <div style={{ flex: 1, minWidth: 0 }}><NoteCard n={n} /></div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn-ghost" onClick={() => setEditing(n.id)}>Править</button>
                  <DangerButton label={isAdded(n.id) ? 'Удалить' : 'Скрыть'} confirm={isAdded(n.id) ? 'Да, удалить' : 'Да, скрыть'} onConfirm={() => remove(n.id)} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {hidden.length > 0 && (
        <>
          <SectionTitle>Скрытые</SectionTitle>
          <div style={{ display: 'grid', gap: 8 }}>
            {hidden.map((n) => (
              <div key={n.id} className="plate" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px' }}>
                <span style={{ flex: 1, fontSize: 13 }}>{n.author}: {n.text.slice(0, 70)}…</span>
                <button className="btn-ghost" onClick={() => save({ ...a, notesHidden: a.notesHidden.filter((x) => x !== n.id) }, 'Заметка снова в приложении')}>Вернуть</button>
              </div>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
