import { getLang, locale, tr } from '../i18n';

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

export const count = (n: number, one: string, few: string, many: string) => `${n} ${plural(n, one, few, many)}`;

export function dateLabel(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(locale(), sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export const timeLabel = (ts: number) => new Date(ts).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' });

export function timeAgo(ts: number, now = Date.now()): string {
  const s = Math.max(0, (now - ts) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (s < 60) return tr('только что');
  const m = Math.floor(s / 60);
  if (m < 60) return rtf.format(-m, 'minute');
  const h = Math.floor(m / 60);
  if (h < 24) return rtf.format(-h, 'hour');
  const d = Math.floor(h / 24);
  if (d < 7) return rtf.format(-d, 'day');
  return dateLabel(ts, now);
}

export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function dayTitle(ts: number, now = Date.now()): string {
  const k = dayKey(ts);
  if (k === dayKey(now)) return tr('Сегодня');
  if (k === dayKey(now - 864e5)) return tr('Вчера');
  return dateLabel(ts, now);
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/** Первая буква строчная: «Иллюстрация и 2D» → «иллюстрация и 2D». Аббревиатуры вроде «UI design» не трогаем. */
export const lcFirst = (s: string) => (getLang() === 'en' && /^[A-Z]{2}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

/** Согласовать глагол прошедшего времени с участником: g(user, «взял», «взяла»). Род есть только в русском. */
export const g = (u: { gender?: 'm' | 'f' } | undefined, m: string, fem: string) => (u?.gender === 'f' && getLang() === 'ru' ? fem : m);

/** Перевести первое сказуемое в тексте события в женский род: «взял в работу» → «взяла в работу». Только для русского. */
export function gverb(text: string, u: { gender?: 'm' | 'f' } | undefined): string {
  if (u?.gender !== 'f' || getLang() !== 'ru') return text;
  return text.replace(/^((?:снова )?)([а-яё]+)/i, (_m, pre: string, w: string) => {
    if (w.endsWith('ёс')) return pre + w.slice(0, -2) + 'есла';
    if (w.endsWith('л')) return pre + w + 'а';
    return pre + w;
  });
}
