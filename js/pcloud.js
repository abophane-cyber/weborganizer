// Accès à pCloud : connexion OAuth (flux "token", sans serveur) et API HTTP JSON.
// Le jeton est passé en paramètre access_token (l'API n'autorise pas l'en-tête
// Authorization en CORS). Les jetons OAuth pCloud n'expirent pas : la connexion
// reste valable d'une visite à l'autre tant qu'elle n'est pas révoquée.
import { PCLOUD_CLIENT_ID, PCLOUD_FOLDER } from './app-config.js';

const LS_AUTH = 'wo.pcloud.auth';
const SS_STATE = 'wo.pcloud.state';

let auth = readAuth();   // { token, host, email? }
let folders = null;      // { root, media } (folderid)
const authListeners = new Set();

function readAuth() {
  try { return JSON.parse(localStorage.getItem(LS_AUTH)) || null; } catch { return null; }
}
function writeAuth(a) {
  auth = a;
  try {
    if (a) localStorage.setItem(LS_AUTH, JSON.stringify(a));
    else localStorage.removeItem(LS_AUTH);
  } catch { /* stockage indisponible */ }
  folders = null;
  for (const fn of authListeners) fn(!!a);
}

export class AuthError extends Error {}

export const isConfigured = () => !!PCLOUD_CLIENT_ID && !PCLOUD_CLIENT_ID.startsWith('COLLER_ICI');
export const isConnected = () => !!auth?.token;
export const accountEmail = () => auth?.email || '';
export const onAuthChange = fn => authListeners.add(fn);

function redirectUri() {
  return location.origin + location.pathname;
}

// Redirige vers la page d'autorisation pCloud.
export function connect() {
  const state = crypto.randomUUID();
  try { sessionStorage.setItem(SS_STATE, state); } catch { /* ignore */ }
  const url = new URL('https://my.pcloud.com/oauth2/authorize');
  url.searchParams.set('client_id', PCLOUD_CLIENT_ID);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirectUri());
  url.searchParams.set('state', state);
  location.assign(url.toString());
}

// Au retour de pCloud : lit le jeton dans le fragment d'URL puis nettoie l'adresse.
export function handleRedirect() {
  if (!location.hash.includes('access_token=') && !location.hash.includes('error=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  let expected = null;
  try { expected = sessionStorage.getItem(SS_STATE); sessionStorage.removeItem(SS_STATE); } catch { /* ignore */ }
  if (p.get('error')) return { error: p.get('error') };
  if (!expected || p.get('state') !== expected) return { error: 'state' };
  const host = p.get('hostname') || (p.get('locationid') === '2' ? 'eapi.pcloud.com' : 'api.pcloud.com');
  if (!/^e?api\.pcloud\.com$/.test(host)) return { error: 'host' };
  writeAuth({ token: p.get('access_token'), host });
  return { ok: true };
}

export function disconnect() { writeAuth(null); }

// ---- Appels API ----

// soft : erreur sans déconnexion (méthodes de téléchargement : un refus de leur part
// ne veut pas dire que la session pCloud a expiré).
async function call(method, params = {}, init = {}, { soft = false } = {}) {
  if (!auth?.token) throw new AuthError('Non connecté');
  const url = new URL(`https://${auth.host}/${method}`);
  url.searchParams.set('access_token', auth.token);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  // Sans en-tête Referer : pCloud refuse certaines méthodes (getfilelink : « Invalid link
  // referer », 7010) quand la demande vient d'un autre site que pcloud.com.
  const res = await fetch(url, { referrerPolicy: 'no-referrer', ...init });
  if (!res.ok) throw new Error(`pCloud ${method} : HTTP ${res.status}`);
  const data = await res.json();
  if (data.result !== 0) {
    // 1000 : connexion requise, 2000 : identifiants invalides, 2094 / 2095 : jeton invalide/expiré
    if (!soft && [1000, 2000, 2094, 2095].includes(data.result)) {
      writeAuth(null);
      throw new AuthError(data.error || 'Session pCloud expirée');
    }
    const err = new Error(`${method} : ${data.error || data.result} (${data.result})`);
    err.code = data.result;
    throw err;
  }
  return data;
}

export async function loadAccount() {
  const info = await call('userinfo');
  if (auth && info.email && auth.email !== info.email) writeAuthSilently({ ...auth, email: info.email });
  return info;
}
function writeAuthSilently(a) {
  auth = a;
  try { localStorage.setItem(LS_AUTH, JSON.stringify(a)); } catch { /* ignore */ }
}

async function ensureFolders() {
  if (folders) return folders;
  const root = await call('createfolderifnotexists', { path: PCLOUD_FOLDER });
  const media = await call('createfolderifnotexists', { folderid: root.metadata.folderid, name: 'media' });
  folders = { root: root.metadata.folderid, media: media.metadata.folderid };
  return folders;
}

// Fichiers du dossier principal, indexés par nom : { name: {fileid, hash, modified, size} }
export async function listRoot() {
  const { root } = await ensureFolders();
  const data = await call('listfolder', { folderid: root, nofiles: undefined });
  const map = {};
  for (const item of data.metadata.contents || []) {
    if (!item.isfolder) map[item.name] = item;
  }
  return map;
}

// ---- Téléchargement ----
// Les serveurs de fichiers de pCloud n'autorisent pas les pages web (pas de CORS) :
// le lien direct échoue en général. On essaie trois voies et on retient celle qui
// fonctionne : lien direct, gettextfile (API), puis file_open / file_pread (API).
// Une réponse d'erreur pCloud n'est JAMAIS prise pour le contenu du fichier.

function apiUrl(method, params) {
  const url = new URL(`https://${auth.host}/${method}`);
  url.searchParams.set('access_token', auth.token);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  return url;
}

// Réponse JSON d'erreur de pCloud : { result: <code ≠ 0>, error: "…" }
function pcloudError(obj) {
  return obj && typeof obj === 'object' && typeof obj.result === 'number' && obj.result !== 0 && 'error' in obj;
}
async function throwIfApiError(res, method) {
  const type = res.headers.get('content-type') || '';
  if (!type.includes('json')) return;
  const j = await res.clone().json().catch(() => null);
  if (pcloudError(j)) throw new Error(`${method} : ${j.error} (${j.result})`);
}

async function viaLink(fileid) {
  const link = await call('getfilelink', { fileid, forcedownload: 1 }, {}, { soft: true });
  const res = await fetch(`https://${link.hosts[0]}${link.path}`, { referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`lien direct : HTTP ${res.status}`);
  return res.blob();
}

async function viaTextFile(fileid) {
  const res = await fetch(apiUrl('gettextfile', { fileid }), { referrerPolicy: 'no-referrer' });
  if (!res.ok) throw new Error(`gettextfile : HTTP ${res.status}`);
  await throwIfApiError(res, 'gettextfile');
  return res.blob();
}

async function viaFileOps(fileid, size) {
  const opened = await call('file_open', { fileid, flags: 0 }, {}, { soft: true }); // lecture seule
  const fd = opened.fd;
  try {
    let total = Number(size);
    if (!Number.isFinite(total)) total = (await call('file_size', { fd }, {}, { soft: true })).size;
    const parts = [];
    let offset = 0;
    while (offset < total) {
      const count = Math.min(4 * 1024 * 1024, total - offset);
      const res = await fetch(apiUrl('file_pread', { fd, count, offset }), { referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error(`file_pread : HTTP ${res.status}`);
      await throwIfApiError(res, 'file_pread');
      const buf = await res.arrayBuffer();
      if (!buf.byteLength) break;
      parts.push(buf);
      offset += buf.byteLength;
    }
    if (offset < total) throw new Error(`file_pread : fichier incomplet (${offset}/${total} octets)`);
    return new Blob(parts);
  } finally {
    call('file_close', { fd }, {}, { soft: true }).catch(() => {});
  }
}

const WAYS = { link: viaLink, text: viaTextFile, fileops: viaFileOps };
const WAY_LABELS = { link: 'lien direct', text: 'gettextfile', fileops: 'file_open/file_pread' };
let preferredWay = null;
try { preferredWay = localStorage.getItem('wo.pcloud.way'); } catch { /* ignore */ }

async function downloadBlob(fileid, size) {
  const order = ['link', 'text', 'fileops'];
  if (preferredWay && WAYS[preferredWay]) order.sort((a, b) => (a === preferredWay ? -1 : b === preferredWay ? 1 : 0));
  const errors = [];
  for (const way of order) {
    try {
      const blob = await WAYS[way](fileid, size);
      if (way !== preferredWay) {
        preferredWay = way;
        try { localStorage.setItem('wo.pcloud.way', way); } catch { /* ignore */ }
      }
      return blob;
    } catch (e) {
      errors.push(`${WAY_LABELS[way]} : ${e.message || e}`);
    }
  }
  throw new Error(`Téléchargement depuis pCloud impossible (${errors.join(' ; ')})`);
}

export async function downloadJson(fileid, size) {
  const blob = await downloadBlob(fileid, size);
  let cfg;
  try { cfg = JSON.parse(await blob.text()); } catch { throw new Error('config.json illisible'); }
  if (pcloudError(cfg)) throw new Error(`pCloud : ${cfg.error} (${cfg.result})`);
  if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.categories)) throw new Error('config.json invalide (pas une page WebOrganizer)');
  return cfg;
}

export const downloadMedia = (fileid, size) => downloadBlob(fileid, size);

// Lien direct (temporaire) vers un fichier, pour l'afficher dans <img> / <video> :
// l'affichage ne demande pas l'autorisation CORS que la lecture exige.
export async function mediaLink(fileid) {
  const link = await call('getfilelink', { fileid }, {}, { soft: true });
  return `https://${link.hosts[0]}${link.path}`;
}

// Envoi d'un fichier (remplace un fichier du même nom ; pCloud garde l'ancien en révision).
// Les requêtes multipart/form-data passent en CORS sans pré-vérification.
function uploadTo(folderid, name, blob, onProgress) {
  return new Promise((resolve, reject) => {
    if (!auth?.token) return reject(new AuthError('Non connecté'));
    const url = new URL(`https://${auth.host}/uploadfile`);
    url.searchParams.set('access_token', auth.token);
    url.searchParams.set('folderid', folderid);
    url.searchParams.set('nopartial', '1');
    url.searchParams.set('filename', name);
    const form = new FormData();
    form.append('file', blob, name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.responseType = 'json';
    if (onProgress) xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status !== 200 || !data) return reject(new Error(`Envoi pCloud : HTTP ${xhr.status}`));
      if (data.result !== 0) {
        if ([1000, 2000, 2094, 2095].includes(data.result)) { writeAuth(null); return reject(new AuthError(data.error)); }
        return reject(new Error(`Envoi pCloud : ${data.error || data.result}`));
      }
      resolve(data.metadata[0]);
    };
    xhr.onerror = () => reject(new Error('Réseau indisponible pendant l’envoi'));
    xhr.send(form);
  });
}

// Envoi avec nouvelles tentatives (utile pour les vidéos lourdes).
async function uploadWithRetry(folderid, name, blob, onProgress, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      return await uploadTo(folderid, name, blob, onProgress);
    } catch (e) {
      if (e instanceof AuthError || i >= attempts || !navigator.onLine) throw e;
      await new Promise(r => setTimeout(r, 2000 * i));
    }
  }
}

export async function uploadMedia(name, blob, onProgress) {
  const { media } = await ensureFolders();
  return uploadWithRetry(media, name, blob, onProgress);
}

// Écrit config.json après avoir copié la version actuelle dans config.backup.json.
export async function writeConfig(cfg, existing) {
  const { root } = await ensureFolders();
  if (existing?.fileid) {
    await call('copyfile', { fileid: existing.fileid, tofolderid: root, toname: 'config.backup.json' });
  }
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: 'application/json' });
  return uploadWithRetry(root, 'config.json', blob);
}

// Met à la corbeille pCloud un média qui n'est plus utilisé (récupérable).
export async function trashMedia(fileid) {
  await call('deletefile', { fileid });
}
