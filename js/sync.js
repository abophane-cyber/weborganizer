// Synchronisation cache local <-> pCloud.
// - Chaque modification locale planifie un envoi après SAVE_DELAY (regroupement).
// - Si config.json a changé sur pCloud depuis la dernière synchro (autre ordinateur),
//   la version la plus récente (champ updatedAt) l'emporte.
import { kvGet, kvSet, mediaGet, mediaPut, mediaDelete, mediaKeys } from './db.js';
import { store, isPristine } from './store.js';
import * as cloud from './pcloud.js';
import { SAVE_DELAY } from './app-config.js';

// status : saved | syncing | offline | local | reauth | error
let status = 'local';
let detail = '';
let meta = { dirty: false, remoteHash: null };
let timer = null;
let running = null;
let again = false;
const listeners = new Set();
const progressListeners = new Set();

export const getStatus = () => ({ status, detail });

// Diagnostic affiché dans les Paramètres : où en sont la page locale et pCloud.
const info = { remoteModified: null, remoteExists: null, lastSyncAt: null };
export const getInfo = () => ({ ...info });
export const onStatus = fn => { listeners.add(fn); fn(getStatus()); };
export const onProgress = fn => progressListeners.add(fn);

function setStatus(s, d = '') {
  status = s; detail = d;
  for (const fn of listeners) fn(getStatus());
}

async function saveMeta() {
  try { await kvSet('syncMeta', meta); } catch { /* ignore */ }
}

function idleStatus() {
  if (!cloud.isConfigured() || !cloud.isConnected()) return 'local';
  if (!navigator.onLine) return 'offline';
  return meta.dirty ? 'syncing' : 'saved';
}

export async function init() {
  try { meta = { ...meta, ...(await kvGet('syncMeta')) }; } catch { /* ignore */ }
  store.subscribe(e => {
    if (e.type !== 'change' || !e.local) return;
    meta.dirty = true;
    saveMeta();
    if (!e.quiet) schedule();
  });
  addEventListener('online', () => syncNow());
  addEventListener('offline', () => setStatus('offline'));
  cloud.onAuthChange(ok => (ok ? syncNow() : setStatus(meta.dirty || status !== 'local' ? 'reauth' : 'local')));
  setStatus(idleStatus());
}

export function schedule() {
  clearTimeout(timer);
  if (!cloud.isConnected()) return setStatus('local');
  if (!navigator.onLine) return setStatus('offline');
  setStatus('syncing');
  timer = setTimeout(syncNow, SAVE_DELAY);
}

export function syncNow() {
  clearTimeout(timer);
  if (running) { again = true; return running; }
  running = (async () => {
    try {
      await doSync();
    } catch (e) {
      console.error(e);
      if (e instanceof cloud.AuthError) setStatus('reauth');
      else if (!navigator.onLine) setStatus('offline');
      else setStatus('error', e.message);
    } finally {
      running = null;
      if (again) { again = false; syncNow(); }
    }
  })();
  return running;
}

async function doSync() {
  if (!cloud.isConfigured() || !cloud.isConnected()) return setStatus('local');
  if (!navigator.onLine) return setStatus('offline');
  setStatus('syncing');

  const files = await cloud.listRoot();
  const remote = files['config.json'] || null;
  const remoteHash = remote ? String(remote.hash) : null;
  info.remoteExists = !!remote;
  info.remoteModified = remote?.modified || null;

  // 1. Version distante modifiée ailleurs ?
  if (remote && remoteHash !== meta.remoteHash) {
    const remoteCfg = await cloud.downloadJson(remote.fileid);
    const local = store.get();
    const remoteNewer = (remoteCfg.updatedAt || '') >= (local.updatedAt || '');
    // Première synchro de ce navigateur / profil Chrome (jamais relié à pCloud) :
    // la version pCloud l'emporte, pour ne pas écraser la vraie page avec une page
    // de test. Exception : si pCloud ne contient que la page de départ intacte,
    // c'est la page locale (la vraie) qui l'emporte.
    const firstSync = meta.remoteHash == null;
    const remoteIsStarter = isPristine(remoteCfg) && !isPristine(local);
    if (!remoteIsStarter && (!meta.dirty || remoteNewer || firstSync)) {
      // Toute page locale réelle remplacée est mise de côté (bouton « Restaurer »).
      if (!isPristine(local)) await setAside(local);
      store.replace(remoteCfg);
      meta = { dirty: false, remoteHash };
      await saveMeta();
      await downloadMissingMedia();
      info.lastSyncAt = new Date().toISOString();
      return setStatus('saved');
    }
    // Sinon : la version locale est plus récente, elle sera envoyée ci-dessous.
    if (remoteIsStarter) meta.dirty = true;
  }

  // 2. Envoi des médias pas encore sur pCloud, puis nettoyage.
  await uploadPendingMedia();
  await collectUnusedMedia();

  // 3. Envoi de la config (jamais la page de départ intacte).
  if ((meta.dirty || !remote) && !isPristine(store.get())) {
    const snapshot = store.get();
    const stamp = snapshot.updatedAt;
    const saved = await cloud.writeConfig(snapshot, remote);
    meta.remoteHash = String(saved.hash);
    info.remoteExists = true;
    info.remoteModified = saved.modified || new Date().toUTCString();
    meta.dirty = store.get().updatedAt !== stamp; // modifié pendant l'envoi ?
    await saveMeta();
  }

  await downloadMissingMedia();
  info.lastSyncAt = new Date().toISOString();
  setStatus(meta.dirty ? 'syncing' : 'saved');
  if (meta.dirty) schedule();
}

// ---- Version mise de côté (remplacée par celle de pCloud) ----
const ASIDE_KEY = 'configAvantConflit';
async function setAside(cfg) {
  try { await kvSet(ASIDE_KEY, { ...cfg, asideAt: new Date().toISOString() }); } catch { /* ignore */ }
}
export async function getAside() {
  try { return (await kvGet(ASIDE_KEY)) || null; } catch { return null; }
}
export async function restoreAside() {
  const aside = await getAside();
  if (!aside) return false;
  const current = store.get();
  delete aside.asideAt;
  store.replace(aside, { local: true }); // devient la version la plus récente -> envoyée à pCloud
  // On garde l'autre version au cas où (sans la proposer à nouveau).
  try { await kvSet('configRemplacee', current); await kvSet(ASIDE_KEY, null); } catch { /* ignore */ }
  return true;
}
export async function dismissAside() {
  try { await kvSet(ASIDE_KEY, null); } catch { /* ignore */ }
}

async function uploadPendingMedia() {
  const media = store.get().media;
  for (const [id, info] of Object.entries(media)) {
    if (info.remoteId) continue;
    let blob = null;
    try { blob = await mediaGet(id); } catch { /* ignore */ }
    if (!blob) continue;
    const safeName = `${id}__${(info.name || 'fichier').replace(/[\\/:*?"<>|]/g, '_')}`;
    emitProgress({ id, name: info.name, ratio: 0 });
    const meta2 = await cloud.uploadMedia(safeName, blob, ratio => emitProgress({ id, name: info.name, ratio }));
    emitProgress({ id, name: info.name, ratio: 1, done: true });
    if (store.get().media[id]) store.update(c => { c.media[id].remoteId = meta2.fileid; }, { quiet: true });
  }
}

function referencedIds(cfg) {
  const text = JSON.stringify({ ...cfg, media: undefined });
  return new Set([...text.matchAll(/media:(m[a-z0-9]+)/g)].map(m => m[1]));
}

// Supprime les médias qui ne sont plus utilisés depuis plus d'une heure
// (laisse le temps de terminer une fenêtre d'édition en cours).
async function collectUnusedMedia() {
  const cfg = store.get();
  const used = referencedIds(cfg);
  const hourAgo = new Date(Date.now() - 3600e3).toISOString();
  const stale = Object.entries(cfg.media).filter(([id, m]) => !used.has(id) && (m.addedAt || '') < hourAgo);
  if (!stale.length) return;
  for (const [id, m] of stale) {
    if (m.remoteId) { try { await cloud.trashMedia(m.remoteId); } catch (e) { console.warn(e); } }
    await mediaDelete(id).catch(() => {});
  }
  store.update(c => { for (const [id] of stale) delete c.media[id]; }, { quiet: true });
}

async function downloadMissingMedia() {
  let local = [];
  try { local = new Set(await mediaKeys()); } catch { return; }
  let got = false;
  for (const [id, info] of Object.entries(store.get().media)) {
    if (local.has(id) || !info.remoteId) continue;
    try {
      emitProgress({ id, name: info.name, ratio: 0, download: true });
      const blob = await cloud.downloadMedia(info.remoteId);
      await mediaPut(id, blob);
      emitProgress({ id, name: info.name, ratio: 1, done: true, download: true });
      got = true;
    } catch (e) { console.warn('Média non récupéré', id, e); }
  }
  if (got) store.refresh();
}

function emitProgress(p) { for (const fn of progressListeners) fn(p); }

export const statusLabel = {
  saved: 'Enregistré',
  syncing: 'Synchronisation…',
  offline: 'Hors ligne',
  local: 'Local uniquement',
  reauth: 'Reconnexion à pCloud nécessaire',
  error: 'Erreur de synchronisation',
};
