// Export / import de toutes les données en .zip (config.json + media/).
import { makeZip, readZip } from './zip.js';
import { store, normalize } from './store.js';
import { mediaGet, mediaPut } from './db.js';
import * as cloud from './pcloud.js';

export async function exportZip() {
  const cfg = store.get();
  const files = [{ name: 'config.json', data: JSON.stringify(cfg, null, 2) }];
  const missing = [];
  for (const [id, info] of Object.entries(cfg.media)) {
    let blob = await mediaGet(id).catch(() => null);
    if (!blob && info.remoteId && cloud.isConnected()) {
      blob = await cloud.downloadMedia(info.remoteId).catch(() => null);
    }
    if (blob) files.push({ name: `media/${id}__${(info.name || 'fichier').replace(/[\\/:*?"<>|]/g, '_')}`, data: blob });
    else missing.push(info.name);
  }
  const zip = await makeZip(files);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(zip);
  a.download = `weborganizer-${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
  return { count: files.length - 1, missing };
}

export async function importZip(file) {
  const entries = await readZip(file);
  const cfgEntry = entries.find(e => e.name === 'config.json' || e.name.endsWith('/config.json'));
  if (!cfgEntry) throw new Error('config.json introuvable dans l’archive');
  const cfg = normalize(JSON.parse(new TextDecoder().decode(cfgEntry.data)));
  let count = 0;
  for (const e of entries) {
    const m = e.name.match(/(?:^|\/)media\/(m[a-z0-9]+)__/);
    if (!m || !cfg.media[m[1]]) continue;
    await mediaPut(m[1], new Blob([e.data], { type: cfg.media[m[1]].mime }));
    count++;
  }
  // Les médias seront renvoyés vers le pCloud connecté.
  for (const info of Object.values(cfg.media)) info.remoteId = null;
  store.replace(cfg, { local: true });
  return { count };
}
