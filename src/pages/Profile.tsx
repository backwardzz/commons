import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addWork, removeWork, userProjects } from '../data/community';
import { getProject, isMaintainer, updateUser } from '../data/ops';
import { act, useAppState } from '../data/store';
import { SKILLS, type Project, type Skill, type SocialLink, type User, type Work } from '../data/types';
import { ProjectRow } from '../components/ProjectRow';
import { TimeAgo } from '../components/Timeline';
import { InviteModal } from '../components/InviteModal';
import { Country, CountrySelect, SocialEditor, SocialLinks } from '../components/social';
import { Avatar, ContribIcon, CraftLabel, CraftLabels, Empty, Field, Modal, SkillPicker, openLogin, report, useMe } from '../components/ui';
import { confirmDialog, Select } from '../components/pop';
import { IconMail, IconPlus } from '../components/icons';
import { dateLabel, dayKey } from '../lib/format';
import { embedFor } from '../lib/embeds';
import { EmbedView, Markdown } from '../lib/markdown';
import { getLang, tn, tr } from '../i18n';

const WEEKS = 18;

function Calendar({ days }: { days: Map<string, number> }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // колонки — недели с понедельника, последняя заканчивается сегодня
  const todayIdx = (today.getDay() + 6) % 7;
  const start = new Date(today);
  start.setDate(start.getDate() - ((WEEKS - 1) * 7 + todayIdx));
  const cells: { key: string; n: number; date: Date }[] = [];
  for (let i = 0; i <= (WEEKS - 1) * 7 + todayIdx; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ key: dayKey(d.getTime()), n: days.get(dayKey(d.getTime())) ?? 0, date: d });
  }
  const level = (n: number) => (n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4);
  return (
    <div className="cal" role="img" aria-label={tr('Активность по дням')}>
      {cells.map((c) => <span key={c.key} className={`cal-d l${level(c.n)}`} data-tip={`${c.n ? tn(c.n, '{n} действие|{n} действия|{n} действий') : tr('Нет действий')}, ${dateLabel(c.date.getTime())}`} />)}
    </div>
  );
}

function ProjectGrid({ list, u, s }: { list: Project[]; u: User; s: ReturnType<typeof useAppState> }) {
  return (
    <div className="pin-grid">
      {list.map((p) => (
        <div key={p.id} className="pin">
          <ProjectRow s={s} p={p} />
          <span className="pin-role">{p.ownerId === u.id ? tr('автор') : isMaintainer(p, u.id) ? tr('сопровождающий') : tr('участник')}</span>
        </div>
      ))}
    </div>
  );
}

function WorkCard({ w, own }: { w: Work; own: boolean }) {
  const me = useMe();
  const embed = w.url ? embedFor(w.url) : null;
  return (
    <article className="work">
      {embed && w.url && <EmbedView embed={embed} url={w.url} />}
      <div className="work-body">
        <div className="work-head"><h3>{w.url && !embed ? <a href={w.url} target="_blank" rel="noreferrer noopener">{w.title}</a> : w.title}</h3><CraftLabel skill={w.skill} />{w.year && <span className="muted small">{w.year}</span>}</div>
        {w.description && <Markdown text={w.description} />}
        {w.url && embed && <a href={w.url} target="_blank" rel="noreferrer noopener" className="small">{w.url.replace(/^https:\/\/(www\.)?/, '')}</a>}
        {own && me && <button type="button" className="link-btn small work-del" onClick={async () => { if (await confirmDialog({ title: tr('Убрать работу из профиля?'), confirm: tr('Убрать'), danger: true })) report(act<ReturnType<typeof removeWork>>('removeWork', [w.id, me.id])); }}>{tr('Убрать')}</button>}
      </div>
    </article>
  );
}

function WorkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const [title, setTitle] = useState('');
  const [skill, setSkill] = useState<Skill>(me?.skills[0] ?? 'code');
  const [url, setUrl] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [description, setDescription] = useState('');
  const submit = () => {
    if (!me) return;
    const r = act<ReturnType<typeof addWork>>('addWork', [{ title, skill, url, description, year: Number(year) || undefined }, me.id]);
    if (report(r, tr('Работа добавлена в профиль'))) { setTitle(''); setUrl(''); setDescription(''); onClose(); }
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('Работа вне проектов')}>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <Field label={tr('Название')}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tr('Например, «Иллюстрации к сказке»')} /></Field>
        <div className="form-grid">
          <div className="field"><span className="field-label">{tr('Ремесло')}</span><Select<Skill> label={tr('Ремесло')} block value={skill} onChange={setSkill} options={SKILLS.map((x) => ({ value: x.id, label: x.name }))} /></div>
          <Field label={tr('Год')}><input inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))} /></Field>
        </div>
        <Field label={tr('Ссылка')} hint={tr('YouTube, Figma, Sketchfab, SoundCloud, Spotify и картинки покажем прямо в профиле')}><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" /></Field>
        <Field label={tr('Описание')} hint={tr('Что это, ваша роль, чем гордитесь')}><textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
        <div className="row-end"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('Отмена')}</button><button type="submit" className="btn btn-primary">{tr('Добавить')}</button></div>
      </form>
    </Modal>
  );
}

function EditModal({ u, open, onClose }: { u: User; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(u.name);
  const [bio, setBio] = useState(u.bio);
  const [skills, setSkills] = useState<Skill[]>(u.skills);
  const [gender, setGender] = useState<'m' | 'f'>(u.gender ?? 'm');
  const [country, setCountry] = useState(u.country);
  const [socials, setSocials] = useState<SocialLink[]>(u.socials ?? []);
  const save = () => { if (report(act<ReturnType<typeof updateUser>>('updateUser', [u.id, { name: name.trim(), bio, skills, gender, country, socials }]), tr('Профиль обновлён'))) onClose(); };
  return (
    <Modal open={open} onClose={onClose} title={tr('Профиль')} wide>
      <form className="stack" onSubmit={(e) => { e.preventDefault(); save(); }}>
        <div className="form-grid">
          <Field label={tr('Имя')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <CountrySelect value={country} onChange={setCountry} />
        </div>
        {getLang() === 'ru' && <div className="field"><span className="field-label">{tr('Как писать о вас в ленте')}</span><div className="seg" role="radiogroup" aria-label={tr('Обращение')}><button type="button" role="radio" aria-checked={gender === 'm'} className={gender === 'm' ? 'is-on' : ''} onClick={() => setGender('m')}>{tr('«взял задачу»')}</button><button type="button" role="radio" aria-checked={gender === 'f'} className={gender === 'f' ? 'is-on' : ''} onClick={() => setGender('f')}>{tr('«взяла задачу»')}</button></div></div>}
        <div className="field"><span className="field-label">{tr('Навыки')}</span><SkillPicker value={skills} onChange={setSkills} /></div>
        <Field label={tr('О себе')}><textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} /></Field>
        <div className="field"><span className="field-label">{tr('Соцсети и ссылки')}</span><SocialEditor value={socials} onChange={setSocials} scope="user" /></div>
        <div className="row-end"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('Отмена')}</button><button type="submit" className="btn btn-primary">{tr('Сохранить')}</button></div>
      </form>
    </Modal>
  );
}

export default function Profile() {
  const { handle } = useParams();
  const s = useAppState();
  const me = useMe();
  const navigate = useNavigate();
  const u = s.users.find((x) => x.handle === handle);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);

  const days = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of s.activity) if (a.actorId === u?.id) m.set(dayKey(a.at), (m.get(dayKey(a.at)) ?? 0) + 1);
    return m;
  }, [s.activity, u?.id]);

  if (!u) return <div className="page narrow"><h1 className="h1">{tr('Участник не найден')}</h1><Link to="/projects">{tr('К проектам')}</Link></div>;

  const contribs = s.contributions.filter((c) => c.authorId === u.id).sort((a, b) => b.createdAt - a.createdAt);
  const accepted = contribs.filter((c) => c.status === 'accepted');
  const done = s.tasks.filter((t) => t.assigneeId === u.id && t.status === 'done').length;
  const { own: ownProjects, member } = userProjects(s, u);
  const own = me?.id === u.id;
  const total = [...days.values()].reduce((a, b) => a + b, 0);
  const works = u.portfolio ?? [];
  const canInvite = !!me && !own && !u.team;

  return (
    <div className="page profile">
      <aside className="profile-side">
        <Avatar user={u} size={160} />
        <h1 className="profile-name">{u.name}</h1>
        <p className="profile-handle">{u.handle}</p>
        {u.country && <p className="profile-country"><Country code={u.country} /></p>}
        {u.bio && <p className="profile-bio">{u.bio}</p>}
        {own && <button type="button" className="btn btn-sm btn-block" onClick={() => setEditing(true)}>{tr('Изменить профиль')}</button>}
        {!own && !u.team && (
          <div className="profile-actions">
            <button type="button" className="btn btn-sm btn-primary" onClick={() => (me ? navigate(`/messages/${u.handle}`) : openLogin())}><IconMail />{tr('Написать')}</button>
            {canInvite && <button type="button" className="btn btn-sm" onClick={() => setInviting(true)}>{tr('Пригласить в проект')}</button>}
          </div>
        )}
        <SocialLinks links={u.socials} />
        <div className="labels-wrap">{u.skills.map((x) => <CraftLabel key={x} skill={x} />)}</div>
        <ul className="profile-stats">
          <li><strong>{accepted.length}</strong> {tr('принятых вкладов')}</li>
          <li><strong>{done}</strong> {tr('выполненных задач')}</li>
          <li><strong>{ownProjects.length + member.length}</strong> {tr('проектов')}</li>
        </ul>
        <p className="muted small">{tr('На платформе с')} {dateLabel(u.joinedAt)}</p>
      </aside>

      <div className="profile-main">
        {ownProjects.length > 0 && (
          <section>
            <h2 className="h3">{tr('Свои проекты')}</h2>
            <ProjectGrid list={ownProjects} u={u} s={s} />
          </section>
        )}
        {member.length > 0 && (
          <section>
            <h2 className="h3">{tr('Работает над проектами')}</h2>
            <ProjectGrid list={member} u={u} s={s} />
          </section>
        )}

        <section>
          <div className="section-head">
            <h2 className="h3">{tr('Работы вне проектов')}</h2>
            {own && <button type="button" className="btn btn-sm" onClick={() => setAdding(true)}><IconPlus />{tr('Добавить работу')}</button>}
          </div>
          {works.length ? <div className="works">{works.map((w) => <WorkCard key={w.id} w={w} own={own} />)}</div> : (
            own ? <Empty title={tr('Покажите, что вы уже сделали')}>{tr('Рисунки, треки, модели, сайты, тексты — всё, что сделано вне Commons. По работам авторы проектов поймут, чем вы можете помочь.')}</Empty>
              : <p className="muted">{tr('Работ вне проектов пока нет.')}</p>
          )}
        </section>

        <section>
          <h2 className="h3">{tr('Активность за {n} недель: {count}', { n: WEEKS, count: total })}</h2>
          <div className="box cal-box"><Calendar days={days} /><div className="cal-legend"><span className="muted small">{tr('меньше')}</span>{[0, 1, 2, 3, 4].map((l) => <span key={l} className={`cal-d l${l}`} />)}<span className="muted small">{tr('больше')}</span></div></div>
        </section>

        <section>
          <h2 className="h3">{tr('Вклады')}</h2>
          {contribs.length ? (
            <div className="box">
              <ul className="ilist">
                {contribs.slice(0, 10).map((c) => {
                  const p = getProject(s, c.projectId)!;
                  return (
                    <li key={c.id} className="irow">
                      <ContribIcon c={c} />
                      <div className="irow-main">
                        <div className="irow-line"><Link to={`/p/${p.slug}/pulls/${c.number}`} className="irow-title">{c.title}</Link><CraftLabels skills={[c.kind]} /></div>
                        <div className="irow-meta"><Link to={`/p/${p.slug}`}>{p.title}</Link> <span>#{c.number}, <TimeAgo at={c.createdAt} /></span></div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : <p className="muted">{own ? <>{tr('Вкладов пока нет.')} <Link to="/for-you">{tr('Подобрать задачу')}</Link></> : tr('Вкладов пока нет.')}</p>}
        </section>
      </div>

      {editing && <EditModal u={u} open={editing} onClose={() => setEditing(false)} />}
      <WorkModal open={adding} onClose={() => setAdding(false)} />
      {canInvite && <InviteModal to={u} open={inviting} onClose={() => setInviting(false)} />}
    </div>
  );
}
