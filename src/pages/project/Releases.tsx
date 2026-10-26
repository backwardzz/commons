import { useState } from 'react';
import { addTask, isMaintainer, publishRelease } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import type { Project, Release } from '../../data/types';
import { Empty, Field, Modal, UserLink, openLogin, report, useMe } from '../../components/ui';
import { dateLabel } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { tr } from '../../i18n';

function BugForm({ p, r, onDone }: { p: Project; r: Release; onDone: () => void }) {
  const me = useMe()!;
  const [title, setTitle] = useState('');
  const [steps, setSteps] = useState('');
  const submit = () => {
    const res = act<ReturnType<typeof addTask>>('addTask', [p.id, {
      title, description: tr('Версия {version}.\n\n{steps}', { version: r.version, steps }), skills: ['code', 'qa'], priority: 'normal', size: 'S', type: 'bug',
    }, me.id]);
    if (report(res, tr('Спасибо! Ошибка появилась на доске задач'))) onDone();
  };
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <Field label={tr('Что не так')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Например, «Звук пропадает после паузы»')} /></Field>
      <Field label={tr('Как повторить')} hint={tr('Шаги, что ожидали увидеть и что получилось, устройство')}>
        <textarea rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} />
      </Field>
      <div className="row-end"><button type="submit" className="btn btn-primary">{tr('Сообщить об ошибке')}</button></div>
    </form>
  );
}

function ReleaseForm({ p, onDone }: { p: Project; onDone: () => void }) {
  const me = useMe()!;
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [url, setUrl] = useState('');
  const submit = () => { if (report(act<ReturnType<typeof publishRelease>>('publishRelease', [p.id, { version, title, notes, url }, me.id]), tr('Версия {version} опубликована', { version }))) onDone(); };
  return (
    <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="form-grid">
        <Field label={tr('Номер версии')}><input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="0.3" /></Field>
        <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Первый шторм')} /></Field>
      </div>
      <Field label={tr('Что нового')} hint={tr('Список изменений и известные проблемы')}><textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Field label={tr('Где попробовать')} hint={tr('Ссылка на сборку, демо или видео')}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></Field>
      <div className="row-end"><button type="submit" className="btn btn-primary">{tr('Опубликовать версию')}</button></div>
    </form>
  );
}

export function Releases({ p }: { p: Project }) {
  useAppState();
  const me = useMe();
  const [bugFor, setBugFor] = useState<Release | null>(null);
  const [creating, setCreating] = useState(false);
  const maint = isMaintainer(p, me?.id);
  return (
    <div className="releases">
      <div className="row-between">
        <p className="muted small">{tr('Промежуточные версии, которые можно попробовать. Нашли ошибку — сообщите, она попадёт на доску задач.')}</p>
        {maint && <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>{tr('Опубликовать версию')}</button>}
      </div>
      {p.releases.length ? (
        <ol className="rlist">
          {p.releases.map((r) => (
            <li key={r.id}>
              <div className="r-ver">{r.version}</div>
              <div className="r-body">
                <h3 className="h3">{r.title || tr('Версия {version}', { version: r.version })}</h3>
                <p className="muted small">{dateLabel(r.createdAt)}, <UserLink id={r.authorId} /></p>
                {r.notes && <Markdown text={r.notes} />}
                <div className="row-start">
                  {r.url && /^https?:/.test(r.url) && <a className="btn btn-sm" href={r.url} target="_blank" rel="noreferrer noopener">{tr('Попробовать')}</a>}
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => (me ? setBugFor(r) : openLogin())}>{tr('Сообщить об ошибке')}</button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      ) : <Empty title={tr('Версий пока нет')}>{tr('Когда появится что-то, что можно попробовать, сопровождающие опубликуют версию здесь.')}</Empty>}
      <Modal open={!!bugFor} onClose={() => setBugFor(null)} title={tr('Ошибка в версии {x1}', { x1: bugFor?.version ?? '' })}>{bugFor && <BugForm p={p} r={bugFor} onDone={() => setBugFor(null)} />}</Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title={tr('Новая версия')}>{creating && <ReleaseForm p={p} onDone={() => setCreating(false)} />}</Modal>
    </div>
  );
}
