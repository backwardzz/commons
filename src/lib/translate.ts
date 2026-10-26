// Перевод материалов и сообщений на язык интерфейса.
// 1) Встроенный переводчик браузера (Chrome 138+, работает на устройстве, без ключей).
// 2) Claude по ключу участника, если он подключён в настройках.
import { getLang, tr, type Lang } from '../i18n';
import type { AiSettings } from '../data/types';
import { AiError, claudeTranslate } from './ai-claude';

/** Грубое определение языка по алфавиту — для решения «нужен ли перевод». */
export function guessLang(text: string): Lang | null {
  const t = text.replace(/https?:\/\/\S+/g, '').replace(/[`*_#>[\]()\d\s.,:;!?«»"'—–-]+/g, '');
  if (t.length < 2) return null;
  const count = (re: RegExp) => (t.match(re) ?? []).length;
  const kana = count(/[぀-ヿ]/g);
  const han = count(/[一-鿿]/g);
  const cyr = count(/[а-яёәғқңөұүһі]/gi);
  const kkOnly = count(/[әғқңөұүһі]/gi);
  const lat = count(/[a-z]/gi);
  if (kana > 0 && kana + han > t.length * 0.3) return 'ja';
  if (han > t.length * 0.3) return 'zh';
  if (cyr > lat) return kkOnly >= Math.max(2, cyr * 0.03) ? 'kk' : 'ru';
  if (lat > 0) return 'en';
  return null;
}

/** Нужен ли перевод этого текста для текущего языка интерфейса. */
export function needsTranslation(text: string, to: Lang = getLang()): boolean {
  const from = guessLang(text);
  return !!from && from !== to;
}

const cache = new Map<string, string>();

interface BrowserTranslator { translate(text: string): Promise<string> }
interface TranslatorStatic {
  availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<'unavailable' | 'downloadable' | 'downloading' | 'available'>;
  create(o: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>;
}
const translators = new Map<string, Promise<BrowserTranslator>>();

/** Не ждать вечно: в некоторых браузерах переводчик есть, но не отвечает. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

let browserBroken = false;

async function viaBrowser(text: string, from: Lang, to: Lang): Promise<string | null> {
  const T = (globalThis as unknown as { Translator?: TranslatorStatic }).Translator;
  if (!T || browserBroken) return null;
  const pair = { sourceLanguage: from, targetLanguage: to };
  const state = await withTimeout(T.availability(pair), 3000).catch(() => { browserBroken = true; return 'unavailable' as const; });
  if (state === 'unavailable') return null;
  const key = `${from}>${to}`;
  // первая загрузка языковой модели может занять время
  if (!translators.has(key)) translators.set(key, withTimeout(T.create(pair), state === 'available' ? 10000 : 60000));
  try {
    const tr8 = await translators.get(key)!;
    return await withTimeout(tr8.translate(text), 20000);
  } catch {
    translators.delete(key);
    return null;
  }
}

export type TranslateEngine = 'browser' | 'claude';

export async function translate(text: string, ai: AiSettings, to: Lang = getLang()): Promise<{ text: string; engine: TranslateEngine }> {
  const from = guessLang(text) ?? 'en';
  const key = `${to}\u0000${text}`;
  const hit = cache.get(key);
  if (hit) return { text: hit, engine: 'browser' };
  const browser = await viaBrowser(text, from, to);
  if (browser) { cache.set(key, browser); return { text: browser, engine: 'browser' }; }
  if (ai.mode === 'claude' && ai.apiKey.trim()) {
    try {
      const out = await claudeTranslate(ai, text, to);
      cache.set(key, out);
      return { text: out, engine: 'claude' };
    } catch (e) {
      throw new Error(e instanceof AiError ? e.message : tr('перевод не удался'));
    }
  }
  throw new Error(tr('Перевод недоступен: в этом браузере нет встроенного переводчика. Подключите Claude в настройках или откройте сайт в свежем Chrome.'));
}
