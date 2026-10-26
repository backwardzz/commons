import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getUser } from '../data/ops';
import { useAppState } from '../data/store';
import {
  PRIORITIES, SKILLS, STAGES, skillInfo,
  type Contribution, type Priority, type Skill, type Stage, type Task, type User,
} from '../data/types';
import { initials } from '../lib/format';
import { IconIssue, IconIssueDeclined, IconIssueDone, IconIssueProposed, IconPull, IconPullClosed, IconPullMerged } from './icons';
import { tr } from '../i18n';

export function useMe(): User | undefined {
  const s = useAppState();
  return getUser(s, s.currentUserId);
}

export function Avatar({ user, size = 28 }: { user?: User; size?: number }) {
  if (!user) return <span className="avatar avatar-empty" style={{ width: size, height: size }} aria-hidden />;
  if (user.photo) return <img className="avatar avatar-img" src={user.photo} width={size} height={size} alt="" referrerPolicy="no-referrer" loading="lazy" style={{ width: size, height: size }} />;
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, ['--h' as string]: user.hue }} aria-hidden>
      {initials(user.name)}
    </span>
  );
}

export function UserLink({ id, avatar = false, handle = false }: { id?: string; avatar?: boolean; handle?: boolean }) {
  const s = useAppState();
  const u = getUser(s, id);
  if (!u) return <span className="muted">{tr('участник')}</span>;
  return (
    <Link to={`/u/${u.handle}`} className="user-link">
      {avatar && <Avatar user={u} size={20} />}
      <span>{handle ? u.handle : u.name}</span>
    </Link>
  );
}

export function AvatarStack({ ids, max = 6, size = 24 }: { ids: string[]; max?: number; size?: number }) {
  const s = useAppState();
  return (
    <span className="avatar-stack">
      {ids.slice(0, max).map((id) => (
        <Link key={id} to={`/u/${getUser(s, id)?.handle}`} data-tip={getUser(s, id)?.name} aria-label={getUser(s, id)?.name}>
          <Avatar user={getUser(s, id)} size={size} />
        </Link>
      ))}
      {ids.length > max && <span className="avatar avatar-more" style={{ width: size, height: size }}>+{ids.length - max}</span>}
    </span>
  );
}

/** Метка ремесла — как метка задачи на GitHub, цвет ремесла. */
export function CraftLabel({ skill, onClick, active }: { skill: Skill; onClick?: () => void; active?: boolean }) {
  const info = skillInfo(skill);
  const style = { ['--c' as string]: `var(--sk-${skill})` };
  if (onClick) return <button type="button" className={`label label-btn${active ? ' is-on' : ''}`} style={style} aria-pressed={!!active} onClick={onClick}>{info.short}</button>;
  return <span className="label" style={style}>{info.short}</span>;
}

export function CraftLabels({ skills }: { skills: Skill[] }) {
  return <span className="labels">{skills.map((s) => <CraftLabel key={s} skill={s} />)}</span>;
}

/** Чип с точкой — для выбора ремёсел в формах. */
export function SkillChip({ skill, active, onClick, full }: { skill: Skill; active?: boolean; onClick?: () => void; full?: boolean }) {
  const info = skillInfo(skill);
  const content = (<><span className="dot" style={{ background: `var(--sk-${skill})` }} />{full ? info.name : info.short}</>);
  if (onClick) {
    return <button type="button" className={`chip chip-btn${active ? ' is-on' : ''}`} style={{ ['--c' as string]: `var(--sk-${skill})` }} aria-pressed={!!active} onClick={onClick}>{content}</button>;
  }
  return <span className="chip">{content}</span>;
}

export function SkillDots({ skills }: { skills: Skill[] }) {
  return <span className="skill-dots">{skills.map((s) => <span key={s} className="sdot" style={{ background: `var(--sk-${s})` }} data-tip={skillInfo(s).name} aria-label={skillInfo(s).name} />)}</span>;
}

export function SkillPicker({ value, onChange, label = tr('Навыки') }: { value: Skill[]; onChange: (v: Skill[]) => void; label?: string }) {
  return (
    <div className="skill-picker" role="group" aria-label={label}>
      {SKILLS.map((s) => (
        <SkillChip key={s.id} skill={s.id} full active={value.includes(s.id)} onClick={() => onChange(value.includes(s.id) ? value.filter((x) => x !== s.id) : [...value, s.id])} />
      ))}
    </div>
  );
}

export function StageMeter({ stage }: { stage: Stage }) {
  const idx = STAGES.findIndex((s) => s.id === stage);
  return (
    <div className="stage-meter" aria-label={tr('Стадия: {name}', { name: STAGES[idx].name })}>
      <div className="stage-bars">{STAGES.map((s, i) => <span key={s.id} className={i <= idx ? 'is-on' : ''} data-tip={`${s.name} — ${s.hint.toLowerCase()}`} />)}</div>
      <span className="stage-name">{STAGES[idx].name}</span>
    </div>
  );
}

export function Progress({ ratio, label }: { ratio: number; label?: string }) {
  return (
    <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)} aria-label={label}>
      <span style={{ width: `${Math.round(ratio * 100)}%` }} />
    </div>
  );
}

export function PriorityMark({ priority }: { priority: Priority }) {
  if (priority === 'normal' || priority === 'low') return null;
  return <span className={`prio prio-${priority}`}>{PRIORITIES.find((p) => p.id === priority)!.name}</span>;
}

// ——— состояния задач и вкладов ———

const TASK_STATE = {
  proposed: { icon: IconIssueProposed, cls: 'is-proposed', get name() { return tr('Предложена'); } },
  open: { icon: IconIssue, cls: 'is-open', get name() { return tr('Открыта'); } },
  in_progress: { icon: IconIssue, cls: 'is-open', get name() { return tr('Открыта'); } },
  review: { icon: IconIssue, cls: 'is-open', get name() { return tr('Открыта'); } },
  done: { icon: IconIssueDone, cls: 'is-done', get name() { return tr('Выполнена'); } },
  declined: { icon: IconIssueDeclined, cls: 'is-declined', get name() { return tr('Отклонена'); } },
} as const;

const CONTRIB_STATE = {
  open: { icon: IconPull, cls: 'is-open', get name() { return tr('Открыт'); } },
  changes_requested: { icon: IconPull, cls: 'is-open', get name() { return tr('Открыт'); } },
  accepted: { icon: IconPullMerged, cls: 'is-done', get name() { return tr('Принят'); } },
  rejected: { icon: IconPullClosed, cls: 'is-closed', name: tr('Закрыт') },
} as const;

export function TaskIcon({ t }: { t: Pick<Task, 'status'> }) {
  const st = TASK_STATE[t.status];
  const I = st.icon;
  return <span className={`sicon ${st.cls}`} data-tip={st.name} aria-label={st.name}><I /></span>;
}

export function ContribIcon({ c }: { c: Pick<Contribution, 'status'> }) {
  const st = CONTRIB_STATE[c.status];
  const I = st.icon;
  return <span className={`sicon ${st.cls}`} data-tip={st.name} aria-label={st.name}><I /></span>;
}

export function TaskPill({ t }: { t: Pick<Task, 'status'> }) {
  const st = TASK_STATE[t.status];
  const I = st.icon;
  return <span className={`spill ${st.cls}`}><I />{st.name}</span>;
}

export function ContribPill({ c }: { c: Pick<Contribution, 'status'> }) {
  const st = CONTRIB_STATE[c.status];
  const I = st.icon;
  return <span className={`spill ${st.cls}`}><I />{st.name}</span>;
}

// ——— формы ———

export function Field({ label, hint, children, error }: { label: string; hint?: string; children: ReactNode; error?: string }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && !error && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <span className="empty-icon">{icon}</span>}
      <p className="empty-title">{title}</p>
      {children && <div className="empty-text">{children}</div>}
      {action}
    </div>
  );
}

export function Modal({ open, onClose, title, children, side, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; side?: boolean; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !document.querySelector('.pop, .overlay-dialog')) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input, textarea, button:not(.modal-close)')?.focus(), 30);
    return () => {
      clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className={`overlay${side ? ' overlay-side' : ''}`} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal${side ? ' modal-side' : ''}${wide ? ' modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label={tr('Закрыть')}>×</button>
        </header>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ——— уведомления ———

type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const toastListeners = new Set<(t: Toast) => void>();
let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'ok') {
  const t = { id: ++toastId, text, kind };
  toastListeners.forEach((l) => l(t));
}

export function Toasts() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setList((x) => [...x, t]);
      setTimeout(() => setList((x) => x.filter((y) => y.id !== t.id)), t.kind === 'error' ? 6000 : 3500);
    };
    toastListeners.add(l);
    return () => { toastListeners.delete(l); };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {list.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.text}</div>)}
    </div>
  );
}

/** Показать результат операции: ошибку — уведомлением, успех — по желанию. */
export function report<T>(r: { ok: true; value: T } | { ok: false; error: string }, okText?: string): r is { ok: true; value: T } {
  if (!r.ok) { toast(r.error, 'error'); return false; }
  if (okText) toast(okText);
  return true;
}

// ——— окно входа (открывается из любого места) ———

const loginListeners = new Set<() => void>();
export const openLogin = () => loginListeners.forEach((l) => l());
export function useLoginRequest(cb: () => void) {
  useEffect(() => {
    loginListeners.add(cb);
    return () => { loginListeners.delete(cb); };
  }, [cb]);
}

export { getUser };
