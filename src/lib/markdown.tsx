// Небольшой и безопасный рендер Markdown: без HTML, только React-элементы.
// Ссылки на видео, макеты, модели и музыку отдельной строкой встраиваются плеером,
// текст на другом языке можно перевести на язык интерфейса.
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppState } from '../data/store';
import { LANGS, getLang, tr } from '../i18n';
import { embedFor, isBareUrl, type Embed } from './embeds';
import { needsTranslation, translate, type TranslateEngine } from './translate';

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))|(https:\/\/[^\s<>()]+[^\s<>().,;:!?»"'])/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (m[1]) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else if (m[2]) out.push(<strong key={k}>{inline(tok.slice(2, -2), k)}</strong>);
    else if (m[3]) out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    else if (m[4]) {
      const label = tok.slice(1, tok.indexOf(']'));
      const url = tok.slice(tok.indexOf('](') + 2, -1);
      if (/^https?:\/\//i.test(url)) out.push(<a key={k} href={url} target="_blank" rel="noreferrer noopener">{label}</a>);
      else out.push(label);
    } else if (m[5]) out.push(<a key={k} href={tok} target="_blank" rel="noreferrer noopener">{tok.replace(/^https:\/\/(www\.)?/, '')}</a>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function EmbedView({ embed, url }: { embed: Embed; url: string }) {
  if (embed.kind === 'image') return <a href={url} target="_blank" rel="noreferrer noopener" className="md-img"><img src={embed.src} alt="" loading="lazy" /></a>;
  return (
    <div className={`embed${embed.ratio ? '' : ' embed-audio'}`} style={embed.ratio ? { aspectRatio: String(embed.ratio) } : undefined}>
      <iframe src={embed.src} title={embed.title} loading="lazy" allow="autoplay; encrypted-media; fullscreen; picture-in-picture; xr-spatial-tracking" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
    </div>
  );
}

const BLOCK_START = /^(#{1,4}\s|>|```|\s*[-*•]\s|\s*\d+[.)]\s)/;

function MarkdownView({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (isBareUrl(line)) {
      const e = embedFor(line.trim());
      if (e) { blocks.push(<EmbedView key={key++} embed={e} url={line.trim()} />); i++; continue; }
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = Math.min(4, h[1].length + 1);
      const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
      blocks.push(<Tag key={key++}>{inline(h[2], `h${key}`)}</Tag>);
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) buf.push(lines[i++]);
      i++;
      blocks.push(<pre key={key++}><code>{buf.join('\n')}</code></pre>);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      blocks.push(<blockquote key={key++}>{inline(buf.join(' '), `q${key}`)}</blockquote>);
      continue;
    }
    const ul = /^\s*[-*•]\s+/;
    const ol = /^\s*\d+[.)]\s+/;
    if (ul.test(line) || ol.test(line)) {
      const ordered = ol.test(line);
      const re = ordered ? ol : ul;
      const items: string[] = [];
      while (i < lines.length && re.test(lines[i])) items.push(lines[i++].replace(re, ''));
      const lis = items.map((it, j) => {
        const cb = /^\[( |x|X)\]\s+(.*)$/.exec(it);
        if (cb) return <li key={j} className="md-check" data-done={cb[1] !== ' '}>{inline(cb[2], `l${key}-${j}`)}</li>;
        return <li key={j}>{inline(it, `l${key}-${j}`)}</li>;
      });
      blocks.push(ordered ? <ol key={key++}>{lis}</ol> : <ul key={key++}>{lis}</ul>);
      continue;
    }
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i]) && !(isBareUrl(lines[i]) && embedFor(lines[i].trim()))) buf.push(lines[i++]);
    blocks.push(<p key={key++}>{buf.map((b, j) => <Fragment key={j}>{j > 0 && <br />}{inline(b, `p${key}-${j}`)}</Fragment>)}</p>);
  }
  return <div className={`md ${className ?? ''}`}>{blocks}</div>;
}

/** Состояние перевода одного текста: кнопка «Перевести», автоматический режим, ошибки. */
export function useTranslation(text: string, enabled = true) {
  const s = useAppState();
  const need = enabled && needsTranslation(text);
  const [result, setResult] = useState<{ text: string; engine: TranslateEngine } | null>(null);
  const [showing, setShowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const auto = useRef(false);
  const run = async () => {
    if (result) { setShowing(true); return; }
    setBusy(true); setError('');
    try {
      const r = await translate(text, s.ai);
      setResult(r); setShowing(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('перевод не удался'));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => { setResult(null); setShowing(false); setError(''); auto.current = false; }, [text]);
  useEffect(() => {
    if (need && s.autoTranslate && !auto.current) { auto.current = true; void run(); }
  }); // eslint-disable-line react-hooks/exhaustive-deps
  return { need, busy, error, showing, result, run, toggle: () => (showing ? setShowing(false) : run()) };
}

export function TranslateBar({ t }: { t: ReturnType<typeof useTranslation> }) {
  if (!t.need) return null;
  const lang = LANGS.find((l) => l.id === getLang())!.name;
  return (
    <div className="tr-bar">
      <button type="button" className="link-btn" onClick={t.toggle} disabled={t.busy}>
        {t.busy ? tr('Перевожу…') : t.showing ? tr('Показать оригинал') : tr('Перевести: {lang}', { lang })}
      </button>
      {t.showing && t.result && <span className="muted small">{t.result.engine === 'claude' ? tr('перевёл Claude') : tr('перевод браузера')}</span>}
      {t.error && <span className="tr-err small">{t.error}</span>}
    </div>
  );
}

/** Markdown с переводом: если текст на другом языке, под ним появляется «Перевести». */
export function Markdown({ text, className, translatable = true }: { text: string; className?: string; translatable?: boolean }) {
  const t = useTranslation(text, translatable);
  return (
    <>
      <MarkdownView text={t.showing && t.result ? t.result.text : text} className={className} />
      <TranslateBar t={t} />
    </>
  );
}

/** Текст без разметки — для превью и поиска. */
export const plain = (md: string) => md.replace(/[#*_`>[\]]/g, '').replace(/\(https?:[^)]+\)/g, '').replace(/\s+/g, ' ').trim();
