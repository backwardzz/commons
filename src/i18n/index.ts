// Переводы интерфейса. Ключ — русский текст: в коде видно, что написано, а словари
// других языков сопоставляют ему перевод. Нет перевода — показываем русский текст.
// Плейсхолдеры: {name}. Формы множественного числа разделяются «|» (ru: одна|несколько|много).

export type Lang = 'en' | 'ru' | 'kk' | 'zh' | 'ja';

export const LANGS: { id: Lang; name: string; short: string; locale: string }[] = [
  { id: 'en', name: 'English', short: 'EN', locale: 'en-US' },
  { id: 'ru', name: 'Русский', short: 'RU', locale: 'ru-RU' },
  { id: 'kk', name: 'Қазақша', short: 'KZ', locale: 'kk-KZ' },
  { id: 'zh', name: '中文', short: '中文', locale: 'zh-CN' },
  { id: 'ja', name: '日本語', short: '日本語', locale: 'ja-JP' },
];

type Dict = Record<string, string>;
// словари грузятся отдельными файлами — посетитель скачивает только свой язык
const LOADERS: Record<Exclude<Lang, 'ru'>, () => Promise<Dict>> = {
  en: () => import('./en').then((m) => m.en),
  kk: () => import('./kk').then((m) => m.kk),
  zh: () => import('./zh').then((m) => m.zh),
  ja: () => import('./ja').then((m) => m.ja),
};
const DICTS: Partial<Record<Exclude<Lang, 'ru'>, Dict>> = {};

/** Загрузить словарь языка (русский встроен в код). */
export async function loadLang(l: Lang): Promise<void> {
  if (l === 'ru' || DICTS[l]) return;
  DICTS[l] = await LOADERS[l]();
}

let current: Lang = 'ru';

export const getLang = () => current;
export const locale = () => LANGS.find((l) => l.id === current)!.locale;

export function setLang(l: Lang) {
  current = l;
  if (typeof document === 'undefined') return;
  document.documentElement.lang = l;
  document.title = tr('Commons — открытая мастерская проектов');
}

/** Язык браузера, если он есть среди поддерживаемых, иначе английский. */
export function detectLang(): Lang {
  const list = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const raw of list) {
    const code = (raw ?? '').toLowerCase().split('-')[0];
    if (code === 'kz') return 'kk';
    if (LANGS.some((l) => l.id === code)) return code as Lang;
  }
  return 'en';
}

export const hasTranslation = (key: string, l: Lang = current) => l === 'ru' || key in (DICTS[l] ?? {});

type Vars = Record<string, string | number | undefined>;

function fill(s: string, vars?: Vars) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k] ?? '') : m));
}

function pickForm(forms: string[], n: number): string {
  if (forms.length === 1) return forms[0];
  const cat = new Intl.PluralRules(locale()).select(n);
  if (current === 'ru') return forms[cat === 'one' ? 0 : cat === 'few' ? 1 : 2] ?? forms[forms.length - 1];
  return forms[cat === 'one' ? 0 : 1] ?? forms[forms.length - 1];
}

/** Перевести строку. */
export function tr(key: string, vars?: Vars): string {
  const s = current === 'ru' ? key : DICTS[current]?.[key] ?? key;
  return fill(s, vars);
}

/** Число с подходящей формой слова: tn(3, '{n} задача|{n} задачи|{n} задач') → «3 задачи». */
export function tn(n: number, key: string, vars?: Vars): string {
  const s = current === 'ru' ? key : DICTS[current]?.[key] ?? key;
  return fill(pickForm(s.split('|'), n), { n, ...vars });
}

/** Только форма слова без числа: tp(3, 'задача|задачи|задач') → «задачи». */
export const tp = (n: number, key: string) => tn(n, key);
