import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addComment, addThread, getUser, isMaintainer, recordDecision } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { THREAD_KINDS, type Project, type Thread, type ThreadKind } from '../../data/types';
import { IconArrowLeft, IconCheck, IconComment, IconDiscussion } from '../../components/icons';
import { Select, promptDialog } from '../../components/pop';
import { CommentBox, Composer, TimeAgo } from '../../components/Timeline';
import { Avatar, Empty, openLogin, report, useMe } from '../../components/ui';
import { g } from '../../lib/format';
import { Markdown } from '../../lib/markdown';
import { tn, tr } from '../../i18n';

const kindName = (k: ThreadKind) => THREAD_KINDS.find((x) => x.id === k)!.name;

function ThreadView({ p, th, onBack }: { p: Project; th: Thread; onBack: () => void }) {
  const s = useAppState();
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  const [first, ...rest] = th.comments;
  const decide = async () => {
    const text = await promptDialog({ title: tr('Зафиксировать решение'), text: tr('Решение появится в истории проекта. Сформулируйте его так, чтобы было понятно без чтения обсуждения.'), label: tr('Что решили'), required: true, confirm: tr('Зафиксировать') });
    if (text) report(act<ReturnType<typeof recordDecision>>('recordDecision', [th.id, text, me!.id]), tr('Решение зафиксировано'));
  };
  return (
    <div className="issue thread">
      <button type="button" className="back" onClick={onBack}><IconArrowLeft />{tr('Все обсуждения')}</button>
      <header className="ihead">
        <h1 className="ititle">{th.title}</h1>
        <div className="imeta">
          <span className={`kind kind-${th.kind}`}>{kindName(th.kind)}</span>
          {th.decision && <span className="spill is-open"><IconCheck />{tr('Решено')}</span>}
          <span className="muted">{tn(th.comments.length, '{n} сообщение|{n} сообщения|{n} сообщений')}</span>
        </div>
      </header>
      <div className="timeline timeline-narrow">
        <CommentBox p={p} authorId={first.authorId} at={first.createdAt} body={first.body} isAuthor />
        {th.decision && (
          <div className="tl-item tl-comment">
            <span className="tl-avatar"><Avatar user={getUser(s, th.decision.by)} size={36} /></span>
            <div className="cbox cbox-approve">
              <div className="cbox-head"><span className="vbadge vbadge-ok"><IconCheck />{tr('Решение')}</span><span className="muted"><TimeAgo at={th.decision.at} /></span></div>
              <div className="cbox-body"><Markdown text={th.decision.text} /></div>
            </div>
          </div>
        )}
        {rest.map((c) => <div key={c.id} className="tl-wrap"><CommentBox p={p} authorId={c.authorId} at={c.createdAt} body={c.body} isAuthor={c.authorId === th.authorId} /></div>)}
        <Composer
          onSubmit={(text) => { if (!me) { openLogin(); return false; } return report(act<ReturnType<typeof addComment>>('addComment', [th.id, text, me.id])); }}
          actions={() => (maint && !th.decision ? <button type="button" className="btn btn-sm" onClick={decide}><IconCheck />{tr('Зафиксировать решение')}</button> : null)}
        />
      </div>
    </div>
  );
}

function NewThread({ p, onDone }: { p: Project; onDone: (id?: string) => void }) {
  const me = useMe()!;
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<ThreadKind>('question');
  const [body, setBody] = useState('');
  const submit = () => {
    const r = act<ReturnType<typeof addThread>>('addThread', [p.id, { title, kind, body }, me.id]);
    if (report(r, tr('Обсуждение открыто'))) onDone(r.value.thread.id);
  };
  return (
    <div className="issue-form narrow-col">
      <button type="button" className="back" onClick={() => onDone()}><IconArrowLeft />{tr('Все обсуждения')}</button>
      <h1 className="h2">{tr('Новое обсуждение')}</h1>
      <div className="tl-item tl-comment">
        <span className="tl-avatar"><Avatar user={me} size={36} /></span>
        <div className="cbox">
          <div className="composer-body stack">
            <div className="row-start"><Select label={tr('Тип обсуждения')} value={kind} onChange={setKind} options={THREAD_KINDS.map((k) => ({ value: k.id, label: k.name }))} small /></div>
            <input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Тема, например «Какой формат звука используем?»')} aria-label={tr('Тема')} />
            <textarea rows={6} value={body} onChange={(e) => setBody(e.target.value)} placeholder={tr('С чего начинается обсуждение. Поддерживается Markdown.')} aria-label={tr('Текст')} />
            <div className="row-end"><button type="button" className="btn btn-primary" onClick={submit}>{tr('Открыть обсуждение')}</button></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Discussions({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const [params, setParams] = useSearchParams();
  const creating = params.get('new') === '1';
  const threads = s.threads.filter((t) => t.projectId === p.id).sort((a, b) => (b.comments.at(-1)?.createdAt ?? b.createdAt) - (a.comments.at(-1)?.createdAt ?? a.createdAt));
  const current = threads.find((t) => t.id === params.get('thread'));

  if (creating && me) return <NewThread p={p} onDone={(id) => setParams(id ? { thread: id } : {}, { replace: true })} />;
  if (current) return <ThreadView p={p} th={current} onBack={() => setParams({}, { replace: true })} />;

  return (
    <div className="discussions">
      <div className="list-bar">
        <p className="muted">{tr('Вопросы, идеи и решения сообщества.')}</p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => (me ? setParams({ new: '1' }) : openLogin())}>{tr('Новое обсуждение')}</button>
      </div>
      {threads.length ? (
        <div className="box">
          <ul className="ilist">
            {threads.map((t) => {
              const last = t.comments.at(-1)!;
              return (
                <li key={t.id} className="irow">
                  <span className={`sicon ${t.decision ? 'is-open' : ''}`}>{t.decision ? <IconCheck /> : <IconDiscussion />}</span>
                  <div className="irow-main">
                    <div className="irow-line">
                      <button type="button" className="irow-title link-btn" onClick={() => setParams({ thread: t.id })}>{t.title}</button>
                      <span className={`kind kind-${t.kind}`}>{kindName(t.kind)}</span>
                    </div>
                    <div className="irow-meta"><span>{getUser(s, t.authorId)?.name} {g(getUser(s, t.authorId), tr('начал'), tr('начала'))} <TimeAgo at={t.createdAt} />{tr(', последний ответ —')} {getUser(s, last.authorId)?.name}</span></div>
                  </div>
                  <div className="irow-side"><span className="irow-stat"><IconComment />{t.comments.length - 1}</span></div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : <Empty icon={<IconDiscussion size={24} />} title={tr('Обсуждений пока нет')}>{tr('Спросите, как что-то устроено, или предложите идею.')}</Empty>}
    </div>
  );
}
