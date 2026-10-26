// Личные сообщения и приглашения в проекты.
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { conversations, dmChatId } from '../data/community';
import { getProject, getTask } from '../data/ops';
import { useAppState } from '../data/store';
import { ChatView } from '../components/Chat';
import { InviteModal } from '../components/InviteModal';
import { Country } from '../components/social';
import { TimeAgo } from '../components/Timeline';
import { Avatar, Empty, getUser, openLogin, useMe } from '../components/ui';
import { Select } from '../components/pop';
import { IconMail } from '../components/icons';
import { plain } from '../lib/markdown';
import { tr } from '../i18n';

export default function Messages() {
  const { handle } = useParams();
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const [inviting, setInviting] = useState(false);

  if (!me) {
    return (
      <div className="page narrow">
        <Empty title={tr('Сообщения')} icon={<IconMail />} action={<button type="button" className="btn btn-primary" onClick={openLogin}>{tr('Войти')}</button>}>
          {tr('Войдите, чтобы переписываться с участниками и получать приглашения в проекты.')}
        </Empty>
      </div>
    );
  }

  const peer = handle ? s.users.find((u) => u.handle === handle) : undefined;
  const list = conversations(s, me.id);
  const invites = s.invites.filter((i) => i.toId === me.id && i.status === 'pending');
  const people = s.users.filter((u) => u.id !== me.id && !u.team);

  return (
    <div className="page messages">
      <aside className="dm-side">
        <div className="dm-side-head">
          <h1 className="h3">{tr('Сообщения')}</h1>
          {people.length > 0 && (
            <Select<string> small label={tr('Написать участнику')} value={null} placeholder={tr('Новое сообщение')} title={tr('Кому написать')}
              options={people.map((u) => ({ value: u.handle, label: u.name, icon: <Avatar user={u} size={18} /> }))} onChange={(h) => navigate(`/messages/${h}`)} />
          )}
        </div>
        {invites.length > 0 && (
          <section className="dm-invites">
            <h2 className="dm-sub">{tr('Приглашения')}</h2>
            {invites.map((i) => {
              const p = getProject(s, i.projectId);
              const from = getUser(s, i.fromId);
              const task = getTask(s, i.taskId);
              return (
                <Link key={i.id} to={`/messages/${from?.handle}`} className="dm-invite">
                  <strong>{p?.title}</strong>
                  <span className="muted small">{tr('от {name}', { name: from?.name ?? '' })}{task ? ` · #${task.number}` : ''}</span>
                </Link>
              );
            })}
          </section>
        )}
        <ul className="dm-list">
          {list.map((c) => {
            const u = getUser(s, c.peerId);
            const active = u && u.handle === handle;
            return (
              <li key={c.chatId}>
                <Link to={`/messages/${u?.handle}`} className={`dm-item${active ? ' is-on' : ''}`}>
                  <Avatar user={u} size={34} />
                  <span className="dm-item-main">
                    <span className="dm-item-top"><strong>{u?.name}</strong><span className="muted small"><TimeAgo at={c.last.createdAt} /></span></span>
                    <span className="dm-item-last muted small">{c.last.inviteId && !c.last.body ? tr('Приглашение в проект') : plain(c.last.body).slice(0, 80)}</span>
                  </span>
                  {c.unread > 0 && <span className="badge">{c.unread}</span>}
                </Link>
              </li>
            );
          })}
          {!list.length && <li className="muted small dm-empty">{tr('Переписок пока нет. Откройте профиль участника и нажмите «Написать».')}</li>}
        </ul>
      </aside>

      <section className="dm-main">
        {peer && peer.id !== me.id && !peer.team ? (
          <>
            <header className="dm-head">
              <Avatar user={peer} size={32} />
              <div>
                <Link to={`/u/${peer.handle}`} className="dm-peer">{peer.name}</Link>
                <span className="muted small dm-peer-meta"><Country code={peer.country} /></span>
              </div>
              <button type="button" className="btn btn-sm dm-invite-btn" onClick={() => setInviting(true)}>{tr('Пригласить в проект')}</button>
            </header>
            <ChatView chatId={dmChatId(me.id, peer.id)} empty={tr('Начните разговор: расскажите о себе или о проекте, в который хотите позвать.')} />
            <InviteModal to={peer} open={inviting} onClose={() => setInviting(false)} />
          </>
        ) : (
          <Empty title={handle ? tr('Участник не найден') : tr('Выберите переписку')} icon={<IconMail />}>
            {tr('Пишите участникам на любом языке — сообщения можно перевести одной кнопкой.')}
          </Empty>
        )}
      </section>
    </div>
  );
}
