import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isMaintainer, saveDoc } from '../data/ops';
import { act, getState, useAppState } from '../data/store';
import type { Project } from '../data/types';
import { askText, type AiAnswer, type TextTask } from '../lib/ai';
import { Markdown } from '../lib/markdown';
import { report, useMe } from './ui';
import { tr } from '../i18n';

type Kind = TextTask['kind'];

export function EngineBadge({ engine }: { engine?: 'local' | 'claude' }) {
  const s = useAppState();
  const e = engine ?? (s.ai.mode === 'claude' && s.ai.apiKey ? 'claude' : 'local');
  return <span className={`engine engine-${e}`}>{e === 'claude' ? 'Claude' : tr('Встроенный')}</span>;
}

export function AiPanel({ p, bare, onNavigate }: { p: Project; bare?: boolean; onNavigate?: () => void }) {
  const me = useMe();
  const s = useAppState();
  const navigate = useNavigate();
  const [answer, setAnswer] = useState<AiAnswer & { kind: Kind; question?: string } | null>(null);
  const [busy, setBusy] = useState<Kind | null>(null);
  const [stream, setStream] = useState('');
  const [q, setQ] = useState('');
  const run = useRef(0);
  const maint = isMaintainer(p, me?.id);

  useEffect(() => { setAnswer(null); setStream(''); setBusy(null); run.current++; }, [p.id]);

  const ask = async (task: TextTask) => {
    const id = ++run.current;
    setBusy(task.kind);
    setStream('');
    setAnswer(null);
    const res = await askText(getState(), p.id, task, (t) => { if (run.current === id) setStream(t); });
    if (run.current !== id) return;
    setAnswer({ ...res, kind: task.kind, question: task.kind === 'ask' ? task.question : undefined });
    setBusy(null);
    setStream('');
  };

  const saveStatus = () => {
    if (!me || !answer) return;
    const existing = p.docs.find((d) => d.title === tr('Состояние проекта') || d.title === 'Состояние проекта');
    const r = act<ReturnType<typeof saveDoc>>('saveDoc', [p.id, { id: existing?.id, title: tr('Состояние проекта'), body: answer.text }, me.id]);
    if (report(r, tr('Документ «Состояние проекта» сохранён'))) { onNavigate?.(); navigate(`/p/${p.slug}/docs/${r.value.docId}`); }
  };

  const ACTIONS: { kind: Kind; label: string; run: () => void }[] = [
    { kind: 'explain', label: tr('Объясни, что это за проект'), run: () => ask({ kind: 'explain' }) },
    { kind: 'onboard', label: me ? tr('С чего начать мне?') : tr('Как присоединиться?'), run: () => ask({ kind: 'onboard' }) },
    { kind: 'status', label: tr('Сводка: где проект сейчас'), run: () => ask({ kind: 'status' }) },
  ];

  return (
    <div className={`ai-panel${bare ? ' ai-panel-bare' : ''}`}>
      {!bare && (
        <header className="ai-head">
          <h2>{tr('Помощник')}</h2>
          <EngineBadge />
        </header>
      )}
      <div className="ai-actions">
        {ACTIONS.map((a) => (
          <button key={a.kind} type="button" className="ai-action" onClick={a.run} disabled={!!busy}>
            {busy === a.kind ? tr('Думаю…') : a.label}
          </button>
        ))}
        <Link to={`/p/${p.slug}/issues?decompose=1`} className="ai-action" onClick={onNavigate}>{tr('Разбить цель на задачи')}</Link>
      </div>
      <form className="ai-ask" onSubmit={(e) => { e.preventDefault(); if (q.trim()) { ask({ kind: 'ask', question: q.trim() }); setQ(''); } }}>
        <label className="sr-only" htmlFor={`ai-q-${bare ? 'm' : 'a'}`}>{tr('Вопрос о проекте')}</label>
        <input id={`ai-q-${bare ? 'm' : 'a'}`} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr('Спросите о проекте')} disabled={!!busy} />
        <button type="submit" className="btn btn-sm" disabled={!!busy || !q.trim()}>{tr('Спросить')}</button>
      </form>

      {(busy || answer) && (
        <div className="ai-answer" aria-live="polite">
          {answer?.question && <p className="ai-q">{answer.question}</p>}
          {busy && !stream && <p className="muted">{tr('Собираю ответ по материалам проекта…')}</p>}
          {busy && stream && <Markdown text={stream} />}
          {answer && (
            <>
              {answer.warning && <p className="ai-warn">{answer.warning}</p>}
              <Markdown text={answer.text} />
              <div className="ai-foot">
                <EngineBadge engine={answer.engine} />
                {answer.kind === 'status' && maint && <button type="button" className="btn btn-sm" onClick={saveStatus}>{tr('Сохранить в документы')}</button>}
              </div>
            </>
          )}
        </div>
      )}
      <p className="ai-note">
        {tr('Помощник подсказывает, но не решает: принимать вклады и менять направление проекта могут только его сопровождающие.')}
        {s.ai.mode !== 'claude' && <> <Link to="/settings" onClick={onNavigate}>{tr('Подключить Claude')}</Link> {tr('для развёрнутых ответов.')}</>}
      </p>
    </div>
  );
}
