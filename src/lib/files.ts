// Загрузка файлов во вклады. С общей базой — в хранилище Supabase (папка пользователя в корзине files),
// в демо — внутрь браузера в виде data:-ссылки (поэтому там лимит меньше).
import { backendEnabled, sb } from '../data/backend';
import { FILE_LIMIT, FILE_LIMIT_DEMO, OpError } from '../data/ops';
import type { Attachment } from '../data/types';
import { tr } from '../i18n';

const BUCKET = 'files';

// те же типы, что разрешены корзине (supabase/migrations/…_files.sql); остальное — как «просто файл»
const SAFE_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
  'application/pdf', 'text/plain', 'text/markdown', 'text/csv', 'application/json',
  'application/zip', 'application/x-zip-compressed', 'application/x-7z-compressed', 'application/vnd.rar',
  'model/gltf-binary', 'model/gltf+json', 'model/obj', 'model/stl', 'font/ttf', 'font/otf', 'font/woff', 'font/woff2',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

export const fileLimit = () => (backendEnabled ? FILE_LIMIT : FILE_LIMIT_DEMO);

export function formatSize(bytes: number): string {
  if (bytes < 1024) return tr('{n} Б', { n: bytes });
  if (bytes < 1024 * 1024) return tr('{n} КБ', { n: Math.max(1, Math.round(bytes / 1024)) });
  return tr('{n} МБ', { n: (bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0) });
}

export const isImage = (a: Pick<Attachment, 'type'>) => /^image\/(png|jpeg|gif|webp|avif)$/.test(a.type);

/** Имя для пути в хранилище: только латиница, цифры и . _ - (кириллицу хранилище не принимает). */
function safeName(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) : '';
  const base = (dot > 0 ? name.slice(0, dot) : name).replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return ext ? `${base}.${ext}` : base;
}

const randomId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export async function uploadFile(file: File): Promise<Attachment> {
  const limit = fileLimit();
  if (file.size > limit) {
    throw new OpError(backendEnabled
      ? tr('«{name}» больше {size} — дайте на него ссылку', { name: file.name, size: formatSize(limit) })
      : tr('В демо файлы до {size}. «{name}» больше — дайте на него ссылку', { name: file.name, size: formatSize(limit) }));
  }
  const type = SAFE_TYPES.has(file.type) ? file.type : 'application/octet-stream';
  if (!sb) return { name: file.name, size: file.size, type, url: await readAsDataUrl(file) };

  const { data } = await sb.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) throw new OpError(tr('Войдите, чтобы продолжить'));
  const path = `${uid}/${randomId()}/${safeName(file.name)}`;
  // переупаковываем с нашим типом: иначе хранилище увидит исходный (например, text/html) и откажет
  const body = type === file.type ? file : new Blob([file], { type });
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType: type, upsert: false, cacheControl: '31536000' });
  if (error) throw new OpError(tr('Не удалось загрузить «{name}»: {x1}', { name: file.name, x1: error.message }));
  const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { name: file.name, size: file.size, type, url };
}

/** Убрать загруженный, но так и не отправленный файл. Ошибки не важны: в худшем случае файл останется лежать. */
export async function discardFile(a: Attachment): Promise<void> {
  if (!sb) return;
  const marker = `/object/public/${BUCKET}/`;
  const i = a.url.indexOf(marker);
  if (i < 0) return;
  await sb.storage.from(BUCKET).remove([decodeURIComponent(a.url.slice(i + marker.length))]).catch(() => undefined);
}

/** Ссылка, по которой файл скачается под своим настоящим именем. */
export function downloadUrl(a: Attachment): string {
  if (a.url.startsWith('data:')) return a.url;
  return `${a.url}${a.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(a.name)}`;
}
