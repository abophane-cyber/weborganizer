// Médias (images, vidéos, photos, icônes, musique) : cache local + pCloud.
// Une référence de média dans la config s'écrit "media:<id>".
import { mediaGet, mediaPut } from './db.js';
import { store } from './store.js';
import { uid } from './util.js';
import * as cloud from './folder.js';

const urls = new Map();     // id -> objectURL
const inflight = new Map(); // id -> Promise<objectURL|null>

export const isMediaRef = s => typeof s === 'string' && s.startsWith('media:');
export const mediaId = ref => ref.slice(6);

export async function addMediaFile(file) {
  const id = 'm' + uid();
  await mediaPut(id, file);
  urls.set(id, URL.createObjectURL(file));
  store.update(c => {
    c.media[id] = {
      name: file.name || 'fichier', mime: file.type || 'application/octet-stream',
      size: file.size, remoteId: null, addedAt: new Date().toISOString(),
    };
  });
  return 'media:' + id;
}

export function mediaInfo(ref) {
  return isMediaRef(ref) ? store.get().media[mediaId(ref)] || null : null;
}

// Renvoie une URL affichable pour une référence (URL web ou média), ou null.
export function resolve(ref) {
  if (!ref) return Promise.resolve(null);
  if (!isMediaRef(ref)) return Promise.resolve(ref);
  const id = mediaId(ref);
  if (urls.has(id)) return Promise.resolve(urls.get(id));
  if (inflight.has(id)) return inflight.get(id);
  const p = (async () => {
    let blob = null;
    try { blob = await mediaGet(id); } catch { /* cache indisponible */ }
    if (!blob) {
      const info = store.get().media[id];
      if (info?.remoteId && cloud.isConnected()) {
        try {
          blob = await cloud.downloadMedia(info.remoteId, info.size, id);
          await mediaPut(id, blob);
        } catch (e) { console.warn('Média non lu dans le dossier', id, e); }
      }
    }
    if (!blob) return null;
    const u = URL.createObjectURL(blob);
    urls.set(id, u);
    return u;
  })().finally(() => inflight.delete(id));
  inflight.set(id, p);
  return p;
}

export function hasUrl(ref) {
  return !isMediaRef(ref) || urls.has(mediaId(ref));
}
