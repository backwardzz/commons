// Текст события ленты на языке зрителя.
import { tr } from '../i18n';
import type { Activity, Msg } from '../data/types';

export function renderMsg(msg: Msg): string {
  if (!msg.a) return tr(msg.k);
  const vars: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(msg.a)) {
    vars[k] = Array.isArray(v) ? v.map(renderMsg).join(', ') : typeof v === 'object' ? renderMsg(v) : v;
  }
  return tr(msg.k, vars);
}

export const activityText = (a: Activity) => (a.msg ? renderMsg(a.msg) : a.text ?? '');
