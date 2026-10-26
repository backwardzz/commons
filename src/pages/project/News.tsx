// Объявления проекта: планы, новости и «ищем людей». Пишут сопровождающие, читают все.
import { useState } from 'react';
import { deleteAnnouncement, postAnnouncement, projectAnnouncements, togglePin } from '../../data/community';
import { isMaintainer } from '../../data/ops';
import { act, useAppState } from '../../data/store';
import { ANNOUNCEMENT_KINDS, type Announcement, type AnnouncementKind, type Project } from '../../data/types';
import { confirmDialog } from '../../components/pop';
import { TimeAgo } from '../../components/Timeline';
import { Avatar, Empty, Field, UserLink, getUser, report, useMe } from '../../components/ui';
import { IconFlag } from '../../components/icons';
import { Markdown } from '../../lib/markdown';
import { tr } from '../../i18n';

const kindName = (k: AnnouncementKind) => ANNOUNCEMENT_KINDS.find((x) => x.id === k)?.name ?? k;

export function AnnouncementCard({ a, p, compact }: { a: Announcement; p: Project; compact?: boolean }) {
  const s = useAppState();
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  return (
    <article className={`news${a.pinned ? ' is-pinned' : ''}${compact ? ' news-compact' : ''}`}>
      <header className="news-head">
        <span className={`news-kind news-${a.kind}`}>{kindName(a.kind)}</span>
        {a.pinned && <span className="news-pin">{tr('Закреплено')}</span>}
        <h3 className="news-title">{a.title}</h3>
      </header>
      <p className="news-meta"><Avatar user={getUser(s, a.authorId)} size={18} /><UserLink id={a.authorId} /><span className="muted"><TimeAgo at={a.createdAt} /></span></p>
      <Markdown text={compact && a.body.length > 420 ? `${a.body.slice(0, 420).trimEnd()}…` : a.body} />
      {maint && !compact && me && (
        <div className="row-start news-actions">
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => report(act<ReturnType<typeof togglePin>>('togglePin', [a.id, me.id]))}>{a.pinned ? tr('Открепить') : tr('Закрепить')}</button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={async () => { if (await confirmDialog({ title: tr('Удалить объявление?'), confirm: tr('Удалить'), danger: true })) report(act<ReturnType<typeof deleteAnnouncement>>('deleteAnnouncement', [a.id, me.id]), tr('Объявление удалено')); }}>{tr('Удалить')}</button>
        </div>
      )}
    </article>
  );
}

function Composer({ p, onDone }: { p: Project; onDone: () => void }) {
  const me = useMe()!;
  const [kind, setKind] = useState<AnnouncementKind>('plan');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const submit = () => {
    if (report(act<ReturnType<typeof postAnnouncement>>('postAnnouncement', [p.id, { kind, title, body, pinned }, me.id]), tr('Объявление опубликовано'))) onDone();
  };
  return (
    <form className="box stack news-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="seg" role="radiogroup" aria-label={tr('Тип объявления')}>
        {ANNOUNCEMENT_KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} className={kind === k.id ? 'is-on' : ''} onClick={() => setKind(k.id)} data-tip={k.hint}>{k.name}</button>
        ))}
      </div>
      <Field label={tr('Заголовок')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Например, «Что делаем в мае»')} /></Field>
      <Field label={tr('Текст')} hint={tr('Markdown. Ссылку на видео YouTube, макет Figma или модель Sketchfab отдельной строкой покажем плеером.')}>
        <textarea rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      </Field>
      <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /><span>{tr('Закрепить сверху')}</span></label>
      <div className="row-end">
        <button type="button" className="btn btn-ghost" onClick={onDone}>{tr('Отмена')}</button>
        <button type="submit" className="btn btn-primary">{tr('Опубликовать')}</button>
      </div>
    </form>
  );
}

export function News({ p }: { p: Project }) {
  const s = useAppState();
  const me = useMe();
  const maint = isMaintainer(p, me?.id);
  const [writing, setWriting] = useState(false);
  const [kind, setKind] = useState<AnnouncementKind | 'all'>('all');
  const all = projectAnnouncements(s, p.id);
  const list = kind === 'all' ? all : all.filter((a) => a.kind === kind);
  return (
    <div className="news-page">
      <div className="list-bar">
        <div className="seg seg-sm" role="tablist">
          <button type="button" role="tab" aria-selected={kind === 'all'} className={kind === 'all' ? 'is-on' : ''} onClick={() => setKind('all')}>{tr('Все')}</button>
          {ANNOUNCEMENT_KINDS.map((k) => (
            <button key={k.id} type="button" role="tab" aria-selected={kind === k.id} className={kind === k.id ? 'is-on' : ''} onClick={() => setKind(k.id)}>{k.name}</button>
          ))}
        </div>
        {maint && !writing && <button type="button" className="btn btn-primary btn-sm" onClick={() => setWriting(true)}>{tr('Новое объявление')}</button>}
      </div>
      {writing && <Composer p={p} onDone={() => setWriting(false)} />}
      {list.map((a) => <AnnouncementCard key={a.id} a={a} p={p} />)}
      {!list.length && !writing && (
        <Empty title={tr('Объявлений пока нет')} icon={<IconFlag />}>
          {maint ? tr('Расскажите участникам о планах, новостях и о том, кого вы ищете.') : tr('Здесь авторы пишут о планах и новостях проекта.')}
        </Empty>
      )}
    </div>
  );
}
