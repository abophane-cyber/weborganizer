// Stockage dans un dossier de l'ordinateur, choisi une fois par l'utilisateur
// (ex. P:\WebOrganizer dans pCloud Drive). C'est pCloud Drive qui synchronise ce
// dossier avec pCloud et les autres ordinateurs : la page n'utilise pas l'API pCloud.
//
// Navigateur requis : Chrome ou Edge sur ordinateur (File System Access API).
// Contenu du dossier : config.json, config.backup.json, media/<id>__<nom>.
import { kvGet, kvSet } from './db.js';

export class AuthError extends Error {}

const HANDLE_KEY = 'dirHandle';
let dir = null;          // FileSystemDirectoryHandle choisi
let granted = false;     // autorisation lecture/écriture accordée pour cette session
const authListeners = new Set();

const emitAuth = () => { for (const fn of authListeners) fn(granted); };

// Point d'accroche des tests : un faux dossier en mémoire.
const testDir = () => window.__woTestDir || null;

export const isSupported = () => !!testDir() || typeof window.showDirectoryPicker === 'function';
export const isConfigured = () => isSupported();
export const isConnected = () => !!dir && granted;
export const hasFolder = () => !!dir;            // dossier choisi (autorisation peut manquer)
export const accountEmail = () => dir?.name || '';
export const folderName = () => dir?.name || '';
export const onAuthChange = fn => authListeners.add(fn);

async function queryPermission(h) {
  try { return (await h.queryPermission({ mode: 'readwrite' })) === 'granted'; } catch { return false; }
}

// Au démarrage : retrouve le dossier choisi précédemment et vérifie l'autorisation.
export async function init() {
  dir = testDir();
  if (!dir) { try { dir = (await kvGet(HANDLE_KEY)) || null; } catch { dir = null; } }
  granted = dir ? await queryPermission(dir) : false;
}

// Choisir le dossier (doit être appelé depuis un clic).
export async function connect() {
  if (!isSupported()) throw new Error('Ce navigateur ne permet pas de choisir un dossier (utilisez Chrome ou Edge sur ordinateur).');
  const h = await window.showDirectoryPicker({ id: 'weborganizer', mode: 'readwrite', startIn: 'documents' });
  dir = h;
  try { await kvSet(HANDLE_KEY, h); } catch { /* ignore */ }
  granted = await queryPermission(h) || (await h.requestPermission({ mode: 'readwrite' })) === 'granted';
  emitAuth();
}

// Redonner l'autorisation au dossier déjà choisi (Chrome la redemande parfois ; depuis un clic).
export async function reauthorize() {
  if (!dir) return connect();
  granted = (await dir.requestPermission({ mode: 'readwrite' })) === 'granted';
  emitAuth();
}

export async function disconnect() {
  dir = null;
  granted = false;
  try { await kvSet(HANDLE_KEY, null); } catch { /* ignore */ }
  emitAuth();
}

// Compatibilité avec l'ancien module (plus de redirection OAuth).
export const handleRedirect = () => null;
export const loadAccount = async () => ({ email: folderName() });

function need() {
  if (!dir || !granted) throw new AuthError('Accès au dossier à autoriser');
  return dir;
}

// Accès retiré par le navigateur en cours de route : on le signale (bouton « Autoriser »).
async function guard(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
      granted = false;
      emitAuth();
      throw new AuthError('Accès au dossier refusé : réautorisez-le');
    }
    throw e;
  }
}

async function fileIn(d, name) {
  try { return await (await d.getFileHandle(name)).getFile(); } catch { return null; }
}

async function writeFile(d, name, data) {
  const fh = await d.getFileHandle(name, { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
  return fh.getFile();
}

const describe = f => ({ fileid: f.name, name: f.name, size: f.size, hash: `${f.lastModified}-${f.size}`, modified: new Date(f.lastModified).toUTCString() });

// Fichiers du dossier principal : { 'config.json': {fileid, hash, modified, size}, … }
export async function listRoot() { return guard(async () => {
  const d = need();
  const map = {};
  for (const name of ['config.json', 'config.backup.json']) {
    const f = await fileIn(d, name);
    if (f) map[name] = describe(f);
  }
  return map;
}); }

export async function downloadJson(fileid) { return guard(async () => {
  const f = await fileIn(need(), fileid);
  if (!f) throw new Error(`${fileid} introuvable dans le dossier`);
  let cfg;
  try { cfg = JSON.parse(await f.text()); } catch { throw new Error(`${fileid} illisible`); }
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.categories)) throw new Error(`${fileid} invalide (pas une page WebOrganizer)`);
  return cfg;
}); }

// Écrit config.json après avoir copié la version actuelle dans config.backup.json.
export async function writeConfig(cfg, existing) { return guard(async () => {
  const d = need();
  if (existing) {
    const old = await fileIn(d, 'config.json');
    if (old) await writeFile(d, 'config.backup.json', await old.text());
  }
  const f = await writeFile(d, 'config.json', JSON.stringify(cfg, null, 2));
  return describe(f);
}); }

async function mediaDir(create = true) {
  return need().getDirectoryHandle('media', { create });
}

export async function uploadMedia(name, blob, onProgress) { return guard(async () => {
  onProgress?.(0);
  const f = await writeFile(await mediaDir(), name, blob);
  onProgress?.(1);
  return describe(f);
}); }

// remoteId : nom du fichier dans media/. Les médias envoyés autrefois par l'API pCloud
// ont un identifiant numérique : on les retrouve par leur préfixe « <id>__ ».
export async function downloadMedia(remoteId, size, id) { return guard(async () => {
  const m = await mediaDir(false).catch(() => null);
  if (!m) throw new Error('dossier media/ introuvable');
  if (typeof remoteId === 'string') {
    const f = await fileIn(m, remoteId);
    if (f) return f;
  }
  if (id) {
    for await (const [name, h] of m.entries()) {
      if (h.kind === 'file' && name.startsWith(`${id}__`)) return h.getFile();
    }
  }
  throw new Error(`média introuvable dans media/ (${id || remoteId})`);
}); }

// Retire un média inutilisé (pCloud Drive le place dans la corbeille pCloud).
export async function trashMedia(remoteId) {
  if (typeof remoteId !== 'string') return;
  const m = await mediaDir(false).catch(() => null);
  if (m) await m.removeEntry(remoteId).catch(() => {});
}
