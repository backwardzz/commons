// Приложенные файлы: выбор и перетаскивание в форме вклада, показ на странице вклада.
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { MAX_FILES } from '../data/ops';
import type { Attachment } from '../data/types';
import { discardFile, downloadUrl, fileLimit, formatSize, isImage, uploadFile } from '../lib/files';
import { tr } from '../i18n';
import { IconClip, IconDownload, IconFile, IconX } from './icons';
import { toast } from './ui';

interface Pending { key: string; name: string }

/**
 * Поле прикрепления файлов. Файлы загружаются сразу при выборе; пока идёт загрузка,
 * onBusy(true) — форму стоит не отправлять.
 */
export function FileDrop({ value, onChange, onBusy, keep = [] }: {
  value: Attachment[];
  onChange: Dispatch<SetStateAction<Attachment[]>>;
  onBusy?: (busy: boolean) => void;
  /** Уже сохранённые во вкладе файлы: при удалении из списка их не стираем из хранилища. */
  keep?: string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [over, setOver] = useState(false);
  const busy = pending.length > 0;
  useEffect(() => { onBusy?.(busy); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (!files.length) return;
    const room = MAX_FILES - value.length - pending.length;
    if (files.length > room) toast(tr('Можно приложить не больше {n} файлов', { n: MAX_FILES }), 'error');
    const batch = files.slice(0, Math.max(0, room)).map((f) => ({ f, key: Math.random().toString(36).slice(2) }));
    if (!batch.length) return;
    setPending((p) => [...p, ...batch.map((b) => ({ key: b.key, name: b.f.name }))]);
    await Promise.all(batch.map(async ({ f, key }) => {
      try {
        const a = await uploadFile(f);
        onChange((v) => [...v, a]);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setPending((p) => p.filter((x) => x.key !== key));
      }
    }));
  };

  const remove = (a: Attachment) => {
    onChange((v) => v.filter((x) => x.url !== a.url));
    if (!keep.includes(a.url)) void discardFile(a);
  };

  return (
    <div
      className={`filedrop${over ? ' is-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void add(e.dataTransfer.files); }}
    >
      {(value.length > 0 || pending.length > 0) && (
        <ul className="filedrop-list">
          {value.map((a) => (
            <li key={a.url} className="filechip">
              {isImage(a) ? <img src={a.url} alt="" className="filechip-thumb" /> : <IconFile className="file-ico" />}
              <span className="file-name" title={a.name}>{a.name}</span>
              <span className="muted small">{formatSize(a.size)}</span>
              <button type="button" className="icon-btn" onClick={() => remove(a)} aria-label={tr('Убрать «{a}»', { a: a.name })}><IconX /></button>
            </li>
          ))}
          {pending.map((p) => (
            <li key={p.key} className="filechip is-loading">
              <span className="filechip-spin" aria-hidden />
              <span className="file-name">{p.name}</span>
              <span className="muted small">{tr('загружается…')}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="filedrop-bar">
        <button type="button" className="btn btn-sm" onClick={() => input.current?.click()} disabled={value.length + pending.length >= MAX_FILES}><IconClip />{tr('Прикрепить файлы')}</button>
        <span className="field-hint">{tr('или перетащите сюда · до {n} файлов, каждый до {size}', { n: MAX_FILES, size: formatSize(fileLimit()) })}</span>
      </div>
      <input ref={input} type="file" multiple hidden onChange={(e) => { void add(e.target.files); e.target.value = ''; }} />
    </div>
  );
}

/** Список приложенных файлов на странице вклада: картинки — превью, остальное — строкой со скачиванием. */
export function FileGallery({ files }: { files: Attachment[] }) {
  const images = files.filter(isImage);
  return (
    <>
      {images.length > 0 && (
        <div className="file-grid">
          {images.map((a) => (
            <a key={a.url} href={a.url} target="_blank" rel="noreferrer noopener" className="file-tile" title={a.name}>
              <img src={a.url} alt={a.name} loading="lazy" />
            </a>
          ))}
        </div>
      )}
      {files.map((a) => (
        <a key={a.url} href={downloadUrl(a)} download={a.name} target="_blank" rel="noreferrer noopener" className="file-row file-row-dl">
          <IconFile className="file-ico" />
          <span className="file-name">{a.name}</span>
          <span className="muted small">{formatSize(a.size)}</span>
          <IconDownload className="file-ico" />
        </a>
      ))}
    </>
  );
}
