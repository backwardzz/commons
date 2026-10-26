// Встраивание материалов по ссылке: видео, макеты, 3D-модели, музыка, картинки.
// Работает без ключей — через официальные встраиваемые плееры сервисов.

export type Embed =
  | { kind: 'frame'; src: string; title: string; ratio: number; service: string }
  | { kind: 'image'; src: string };

export function embedFor(raw: string): Embed | null {
  let u: URL;
  try { u = new URL(raw.trim()); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\.|^m\./, '');
  const path = u.pathname;

  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(path)) return { kind: 'image', src: u.href };

  if (host === 'youtube.com' || host === 'youtu.be' || host === 'youtube-nocookie.com') {
    const id = host === 'youtu.be' ? path.slice(1) : u.searchParams.get('v') ?? /^\/(?:shorts|embed|live)\/([\w-]{6,})/.exec(path)?.[1];
    if (id && /^[\w-]{6,20}$/.test(id)) return { kind: 'frame', src: `https://www.youtube-nocookie.com/embed/${id}`, title: 'YouTube', ratio: path.startsWith('/shorts') ? 9 / 16 : 16 / 9, service: 'YouTube' };
  }
  if (host === 'vimeo.com') {
    const id = /^\/(\d+)/.exec(path)?.[1];
    if (id) return { kind: 'frame', src: `https://player.vimeo.com/video/${id}`, title: 'Vimeo', ratio: 16 / 9, service: 'Vimeo' };
  }
  if (host === 'figma.com' && /^\/(file|design|proto|board)\//.test(path)) {
    return { kind: 'frame', src: `https://www.figma.com/embed?embed_host=commons&url=${encodeURIComponent(u.href)}`, title: 'Figma', ratio: 16 / 10, service: 'Figma' };
  }
  if (host === 'sketchfab.com') {
    const id = /([0-9a-f]{32})/i.exec(path)?.[1];
    if (id) return { kind: 'frame', src: `https://sketchfab.com/models/${id}/embed`, title: 'Sketchfab', ratio: 16 / 10, service: 'Sketchfab' };
  }
  if (host === 'soundcloud.com' && path.split('/').filter(Boolean).length >= 2) {
    return { kind: 'frame', src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(u.href)}&visual=false`, title: 'SoundCloud', ratio: 0, service: 'SoundCloud' };
  }
  if (host === 'open.spotify.com') {
    const mm = /^\/(track|album|playlist|episode|show)\/(\w+)/.exec(path);
    if (mm) return { kind: 'frame', src: `https://open.spotify.com/embed/${mm[1]}/${mm[2]}`, title: 'Spotify', ratio: 0, service: 'Spotify' };
  }
  if (host.endsWith('itch.io') && /^\/[\w-]+/.test(path)) return null; // itch.io требует id игры — оставляем ссылкой
  return null;
}

/** Ссылка ли это целиком (строка из одного URL). */
export const isBareUrl = (line: string) => /^https:\/\/\S+$/.test(line.trim());
