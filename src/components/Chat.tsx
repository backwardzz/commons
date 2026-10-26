// Чат: общий для чата проекта и личной переписки. Сообщения на другом языке переводятся
// кнопкой или автоматически; приглашения в проект приходят карточкой с ответом.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { answerInvite, chatMessages, markRead, sendMessage } from '../data/community';
import { getProject, getTask } from '../data/ops';
import { act, setState, useAppState } from '../data/store';
import type { Invite, Message } from '../data/types';
import { dayKey, dayTitle } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { tr } from '../i18n';
import { TimeAgo } from './Timeline';
import { Avatar, UserLink, getUser, openLogin, report, useMe } from './ui';

function InviteCard({ inv }: { inv: Invite }) {
  const s = useAppState();
  const me = useMe();
  const p = getProject(s, inv.projectId);
  const task = getTask(s, inv.taskId);
  if (!p) return null;
  const mine = me?.id === inv.toId;
  const answer = (accept: boolean) => {
    if (!me) return;
    report(act<ReturnType<typeof answerInvite>>('answerInvite', [inv.id, accept, me.id]), accept ? tr('Вы присоединились к проекту «{title}»', { title: p.title }) : tr('Приглашение отклонено'));
  };
  return (
    <div className={`invite invite-${inv.status}`}>
      <p className="invite-title">{tr('Приглашение в проект')} <Link to={`/p/${p.slug}`}>{p.title}</Link></p>
      {task && <p className="small">{tr('Задача:')} <Link to={`/p/${p.slug}/issues/${task.number}`}>#{task.number} {task.title}</Link></p>}
      {inv.status === 'pending' && mine && (
        <div className="row-start">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => answer(true)}>{task ? tr('Принять и взять задачу') : tr('Принять')}</button>
          <button type="button" className="btn btn-sm" onClick={() => answer(false)}>{tr('Отклонить')}</button>
        </div>
      )}
      {inv.status === 'pending' && !mine && <p className="muted small">{tr('Ждёт ответа')}</p>}
      {inv.status === 'accepted' && <p className="invite-st ok small">{tr('Приглашение принято')}</p>}
      {inv.status === 'declined' && <p className="invite-st small">{tr('Приглашение отклонено')}</p>}
    </div>
  );
}

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  const s = useAppState();
  const inv = m.inviteId ? s.invites.find((i) => i.id === m.inviteId) : undefined;
  const u = getUser(s, m.authorId);
  return (
    <div className={`msg${mine ? ' msg-mine' : ''}`}>
      <Avatar user={u} size={30} />
      <div className="msg-body">
        <div className="msg-head"><UserLink id={m.authorId} /><span className="muted small"><TimeAgo at={m.createdAt} /></span></div>
        {inv && <InviteCard inv={inv} />}
        {m.body && <Markdown text={m.body} className="msg-text" />}
      </div>
    </div>
  );
}

export function ChatView({ chatId, placeholder, empty }: { chatId: string; placeholder?: string; empty?: string }) {
  const s = useAppState();
  const me = useMe();
  const [text, setText] = useState('');
  const list = useMemo(() => chatMessages(s, chatId), [s, chatId]);
  const end = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }); }, [list.length, chatId]);
  useEffect(() => { if (me) act<ReturnType<typeof markRead>>('markRead', [chatId, me.id]); }, [me, chatId, list.length]);

  const send = () => {
    if (!me) return openLogin();
    if (report(act<ReturnType<typeof sendMessage>>('sendMessage', [chatId, text, me.id]))) setText('');
  };

  let lastDay = '';
  return (
    <div className="chat">
      <div className="chat-tools">
        <label className="check small"><input type="checkbox" checked={!!s.autoTranslate} onChange={(e) => setState({ autoTranslate: e.target.checked })} /><span>{tr('Переводить сообщения автоматически')}</span></label>
      </div>
      <div className="chat-list" role="log" aria-live="polite">
        {!list.length && <p className="chat-empty muted">{empty ?? tr('Сообщений пока нет. Напишите первым.')}</p>}
        {list.map((m) => {
          const day = dayKey(m.createdAt);
          const sep = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {sep && <p className="chat-day"><span>{dayTitle(m.createdAt)}</span></p>}
              <Bubble m={m} mine={m.authorId === me?.id} />
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form className="chat-compose" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
          placeholder={me ? placeholder ?? tr('Сообщение… Enter — отправить, Shift+Enter — новая строка') : tr('Войдите, чтобы писать')}
          aria-label={tr('Сообщение')}
          disabled={!me}
        />
        <button type="submit" className="btn btn-primary" disabled={!me || !text.trim()}>{tr('Отправить')}</button>
      </form>
    </div>
  );
}
