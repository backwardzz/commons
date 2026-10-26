// Пригласить участника в свой проект — можно сразу предложить конкретную задачу.
import { useMemo, useState } from 'react';
import { sendInvite } from '../data/community';
import { isMaintainer } from '../data/ops';
import { act, useAppState } from '../data/store';
import type { User } from '../data/types';
import { tr } from '../i18n';
import { Select } from './pop';
import { Field, Modal, report, useMe } from './ui';

export function InviteModal({ to, open, onClose }: { to: User; open: boolean; onClose: () => void }) {
  const s = useAppState();
  const me = useMe();
  const mine = useMemo(() => s.projects.filter((p) => isMaintainer(p, me?.id) && !s.invites.some((i) => i.toId === to.id && i.projectId === p.id && i.status === 'pending')), [s.projects, s.invites, me?.id, to.id]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const pid = projectId ?? mine[0]?.id ?? null;
  const [taskId, setTaskId] = useState<string>('');
  const [message, setMessage] = useState(tr('Здравствуйте! Кажется, вам может быть интересен наш проект — будем рады, если присоединитесь.'));
  const tasks = useMemo(() => s.tasks
    .filter((t) => t.projectId === pid && t.status === 'open' && !t.assigneeId)
    .sort((a, b) => Number(b.skills.some((x) => to.skills.includes(x))) - Number(a.skills.some((x) => to.skills.includes(x)))), [s.tasks, pid, to.skills]);

  const submit = () => {
    if (!me || !pid) return;
    const r = act<ReturnType<typeof sendInvite>>('sendInvite', [{ toId: to.id, projectId: pid, taskId: taskId || undefined, message }, me.id]);
    if (report(r, tr('Приглашение отправлено — {name} увидит его в сообщениях', { name: to.name }))) onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={tr('Пригласить в проект')}>
      {mine.length ? (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <div className="field"><span className="field-label">{tr('Проект')}</span>
            <Select<string> label={tr('Проект')} block value={pid} onChange={(v) => { setProjectId(v); setTaskId(''); }} options={mine.map((p) => ({ value: p.id, label: p.title }))} />
          </div>
          <div className="field"><span className="field-label">{tr('Задача (необязательно)')}</span>
            <Select<string> label={tr('Задача')} block value={taskId} onChange={setTaskId}
              options={[{ value: '', label: tr('Без конкретной задачи') }, ...tasks.map((t) => ({ value: t.id, label: `#${t.number} ${t.title}`, hint: t.skills.some((x) => to.skills.includes(x)) ? tr('подходит по навыкам') : undefined }))]} />
          </div>
          <Field label={tr('Сообщение')}><textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
          <div className="row-end"><button type="button" className="btn btn-ghost" onClick={onClose}>{tr('Отмена')}</button><button type="submit" className="btn btn-primary">{tr('Отправить приглашение')}</button></div>
        </form>
      ) : (
        <p className="muted">{tr('Приглашать можно в проекты, которые вы ведёте. Создайте проект или станьте сопровождающим — и возвращайтесь.')}</p>
      )}
    </Modal>
  );
}
