// Лента в духе GitHub: комментарии в рамках и события на вертикальной линии между ними.
import { useState, type ReactNode } from 'react';
import { getUser, isMaintainer } from '../data/ops';
import { useAppState } from '../data/store';
import type { Project } from '../data/types';
import { dateLabel, timeAgo, timeLabel } from '../lib/format';
import { Markdown } from '../lib/markdown';
import { Avatar, UserLink, useMe } from './ui';
import { tr } from '../i18n';

export function TimeAgo({ at }: { at: number }) {
  return <time dateTime={new Date(at).toISOString()} data-tip={`${dateLabel(at)}, ${timeLabel(at)}`}>{timeAgo(at)}</time>;
}

export function CommentBox({ p, authorId, at, body, badge, tone, children, isAuthor }: {
  p: Project;
  authorId: string;
  at: number;
  body?: string;
  badge?: ReactNode;
  tone?: 'approve' | 'changes';
  children?: ReactNode;
  isAuthor?: boolean;
}) {
  const s = useAppState();
  return (
    <div className="tl-item tl-comment">
      <span className="tl-avatar"><Avatar user={getUser(s, authorId)} size={36} /></span>
      <div className={`cbox${tone ? ` cbox-${tone}` : ''}`}>
        <div className="cbox-head">
          <UserLink id={authorId} />
          <span className="muted"><TimeAgo at={at} /></span>
          {badge}
          <span className="cbox-roles">
            {isAuthor && <span className="role">{tr('Автор')}</span>}
            {isMaintainer(p, authorId) && <span className="role">{p.ownerId === authorId ? tr('Владелец') : tr('Сопровождающий')}</span>}
          </span>
        </div>
        <div className="cbox-body">
          {body ? <Markdown text={body} /> : !children && <p className="muted">{tr('Описания нет.')}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}

export function EventRow({ icon, tone, actorId, children, at }: { icon: ReactNode; tone?: string; actorId?: string; children: ReactNode; at: number }) {
  const s = useAppState();
  return (
    <div className="tl-item tl-event">
      <span className={`tl-badge${tone ? ` tl-${tone}` : ''}`}>{icon}</span>
      <p>
        {actorId && <><Avatar user={getUser(s, actorId)} size={18} /> <UserLink id={actorId} /> </>}
        {children} <span className="muted"><TimeAgo at={at} /></span>
      </p>
    </div>
  );
}

/** Поле комментария с вкладками «Текст / Просмотр». */
export function Composer({ placeholder, onSubmit, actions, submitLabel = tr('Комментировать'), disabled }: {
  placeholder?: string;
  onSubmit?: (text: string) => boolean | void;
  actions?: (text: string, clear: () => void) => ReactNode;
  submitLabel?: string;
  disabled?: boolean;
}) {
  const me = useMe();
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const clear = () => { setText(''); setTab('write'); };
  return (
    <div className="tl-item tl-comment composer">
      <span className="tl-avatar"><Avatar user={me} size={36} /></span>
      <div className="cbox">
        <div className="composer-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-on' : ''} onClick={() => setTab('write')}>{tr('Текст')}</button>
          <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-on' : ''} onClick={() => setTab('preview')}>{tr('Просмотр')}</button>
        </div>
        <div className="composer-body">
          {tab === 'write' ? (
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={me ? placeholder ?? tr('Оставьте комментарий') : tr('Войдите, чтобы участвовать')} disabled={!me || disabled} aria-label={tr('Комментарий')} />
          ) : (
            <div className="composer-preview">{text.trim() ? <Markdown text={text} /> : <p className="muted">{tr('Нечего показать.')}</p>}</div>
          )}
          <div className="composer-foot">
            <span className="muted small">{tr('Поддерживается Markdown')}</span>
            <div className="row-end">
              {actions?.(text, clear)}
              {onSubmit && <button type="button" className="btn btn-primary btn-sm" disabled={!me || !text.trim() || disabled} onClick={() => { if (onSubmit(text) !== false) clear(); }}>{submitLabel}</button>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
