// Panneau Paramètres : synchronisation, général, design & fond.
import { h, svgIcon, toast, formatBytes } from './util.js';
import { store } from './store.js';
import * as cloud from './pcloud.js';
import * as sync from './sync.js';
import { addMediaFile, isMediaRef, mediaInfo } from './media.js';
import { kindFor } from './background.js';
import { exportZip, importZip } from './transfer.js';
import { imageField } from './modal.js';
import { measurePositions } from './board.js';
import * as actions from './actions.js';

let panel;
let inputs = {};

export function isOpen() { return document.body.classList.contains('editing'); }

export function toggle(force) {
  const open = force ?? !isOpen();
  document.body.classList.toggle('editing', open);
  panel.hidden = !open;
  document.getElementById('settings-btn').setAttribute('aria-expanded', String(open));
  if (open) { fillInputs(); panel.querySelector('.settings-close').focus(); }
}

function section(title, ...content) {
  return h('section', { class: 'settings-section' }, h('h3', {}, title), ...content);
}

function bind(input, read, write, event = 'input') {
  input.addEventListener(event, () => store.update(c => write(c, input)));
  return { input, read };
}

function fillInputs() {
  const c = store.get();
  for (const { input, read } of Object.values(inputs)) {
    if (document.activeElement === input) continue;
    const v = read(c);
    if (input.type === 'range') input.value = v; else input.value = v ?? '';
  }
  updateBgInfo();
}

// ---- Synchronisation ----

function syncSection() {
  const chip = h('span', { class: 'sync-chip' });
  const account = h('p', { class: 'muted small' });
  const progress = h('p', { class: 'muted small progress-line', hidden: true });
  const actionBtn = h('button', { type: 'button', class: 'btn primary' });
  const syncBtn = h('button', { type: 'button', class: 'btn', onclick: () => sync.syncNow() }, 'Synchroniser maintenant');
  const disconnectBtn = h('button', {
    type: 'button', class: 'btn link-btn',
    onclick: () => {
      if (confirm('Déconnecter pCloud sur cet ordinateur ? Vos données restent sur pCloud et dans le cache local.')) cloud.disconnect();
    },
  }, 'Déconnecter pCloud');

  const render = ({ status, detail }) => {
    chip.className = `sync-chip sync-${status}`;
    chip.textContent = sync.statusLabel[status] + (detail ? ` — ${detail}` : '');
    document.getElementById('settings-btn').dataset.sync = status;
    const connected = cloud.isConnected();
    actionBtn.hidden = connected || !cloud.isConfigured();
    actionBtn.textContent = status === 'reauth' ? 'Se reconnecter à pCloud' : 'Se connecter à pCloud';
    syncBtn.hidden = !connected;
    disconnectBtn.hidden = !connected;
    account.textContent = !cloud.isConfigured()
      ? 'pCloud n’est pas encore configuré (Client ID manquant dans js/app-config.js, voir le guide). Vos données sont enregistrées sur cet ordinateur.'
      : connected
        ? `Connecté${cloud.accountEmail() ? ` : ${cloud.accountEmail()}` : ''}. Dossier pCloud : WebOrganizer`
        : 'Vos données sont enregistrées sur cet ordinateur. Connectez pCloud pour les sauvegarder et les retrouver ailleurs.';
  };
  actionBtn.addEventListener('click', () => cloud.connect());
  sync.onStatus(render);
  cloud.onAuthChange(() => render(sync.getStatus()));
  sync.onProgress(p => {
    progress.hidden = !!p.done;
    progress.textContent = `${p.download ? 'Téléchargement' : 'Envoi vers pCloud'} : ${p.name} — ${Math.round(p.ratio * 100)} %`;
  });

  const importInput = h('input', {
    type: 'file', accept: '.zip,application/zip', hidden: true,
    onchange: async () => {
      const f = importInput.files[0];
      importInput.value = '';
      if (!f) return;
      if (!confirm('Importer cette archive ? Elle remplace la configuration actuelle (catégories, cartes, réglages).')) return;
      try {
        const r = await importZip(f);
        toast(`Import terminé : configuration et ${r.count} média(s).`, { kind: 'ok' });
        fillInputs();
      } catch (e) { toast(`Import impossible : ${e.message}`, { kind: 'error' }); }
    },
  });
  const exportBtn = h('button', {
    type: 'button', class: 'btn',
    onclick: async () => {
      exportBtn.disabled = true;
      try {
        const r = await exportZip();
        toast(`Export prêt : configuration et ${r.count} média(s).${r.missing.length ? ` Non disponibles : ${r.missing.join(', ')}.` : ''}`, { kind: 'ok' });
      } catch (e) { toast(`Export impossible : ${e.message}`, { kind: 'error' }); }
      exportBtn.disabled = false;
    },
  }, 'Exporter (.zip)');

  return section('Synchronisation',
    h('div', { class: 'row' }, chip),
    account,
    progress,
    h('div', { class: 'row wrap' }, actionBtn, syncBtn),
    h('div', { class: 'row wrap' }, exportBtn,
      h('button', { type: 'button', class: 'btn', onclick: () => importInput.click() }, 'Importer'), importInput),
    h('div', { class: 'row' }, disconnectBtn),
  );
}

// ---- Général ----

function generalSection() {
  const title = h('input', { type: 'text', maxlength: '80' });
  const desc = h('input', { type: 'text', maxlength: '160' });
  const footer = h('input', { type: 'text', maxlength: '80' });
  inputs.title = bind(title, c => c.title, (c, i) => { c.title = i.value; });
  inputs.desc = bind(desc, c => c.description, (c, i) => { c.description = i.value; });
  inputs.footer = bind(footer, c => c.footer, (c, i) => { c.footer = i.value; });
  const logo = imageField('Logo (au-dessus du titre)', store.get().logo, {
    help: 'Image ronde affichée au-dessus du titre. Une URL ou un fichier ; vide : pas de logo.',
    onChange: v => store.update(c => { c.logo = v; }),
  });
  const recenter = h('button', {
    type: 'button', class: 'btn small',
    onclick: () => store.update(c => { c.layout = { logo: { x: 0, y: 0 }, title: { x: 0, y: 0 } }; }),
  }, 'Recentrer le logo et le titre');
  return section('Général',
    logo.el,
    h('p', { class: 'muted small' }, 'Le logo et le titre se déplacent à la souris tant que ce panneau est ouvert.'),
    h('div', { class: 'row' }, recenter),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Titre'), title),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Description'), desc),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Pied de page'), footer),
  );
}

// ---- Design & fond ----

let bgInfo;
function updateBgInfo() {
  if (!bgInfo) return;
  const bg = store.get().background;
  if (!bg.src) { bgInfo.textContent = 'Aucun fond.'; return; }
  if (isMediaRef(bg.src)) {
    const m = mediaInfo(bg.src);
    bgInfo.textContent = `Fond actuel : ${m?.name || 'fichier'} (${m?.mime?.startsWith('video/') ? 'vidéo' : 'image'}, ${formatBytes(m?.size)})${m && !m.remoteId ? ' — pas encore sur pCloud' : ''}`;
  } else {
    bgInfo.textContent = `Fond actuel : ${bg.kind === 'video' ? 'vidéo' : 'image'} en ligne.`;
  }
}

async function setBackgroundFile(file) {
  if (!file) return;
  if (!/^(image|video)\//.test(file.type)) { toast('Choisissez une image ou une vidéo.', { kind: 'warn' }); return; }
  const ref = await addMediaFile(file);
  store.update(c => { c.background.src = ref; c.background.kind = kindFor('', file.type); });
  updateBgInfo();
}

function designSection() {
  bgInfo = h('p', { class: 'muted small' });
  const fileInput = h('input', { type: 'file', accept: 'image/*,video/*', hidden: true,
    onchange: () => { setBackgroundFile(fileInput.files[0]); fileInput.value = ''; } });
  const drop = h('div', {
    class: 'dropzone', tabindex: '0', role: 'button',
    'aria-label': 'Déposer une image ou une vidéo de fond, ou cliquer pour choisir un fichier',
    onclick: () => fileInput.click(),
    onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } },
  },
    h('strong', {}, 'Glissez une image ou une vidéo ici'),
    h('span', { class: 'muted small' }, 'ou cliquez pour choisir un fichier'),
  );
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault();
    drop.classList.remove('over');
    setBackgroundFile(e.dataTransfer.files[0]);
  });

  const url = h('input', { type: 'url', placeholder: 'https://… (image ou vidéo .mp4/.webm)' });
  const kind = h('select', {},
    h('option', { value: 'auto' }, 'Type : auto'),
    h('option', { value: 'image' }, 'Image'),
    h('option', { value: 'video' }, 'Vidéo'));
  const applyUrl = h('button', {
    type: 'button', class: 'btn',
    onclick: () => {
      const v = url.value.trim();
      if (!/^https?:\/\//i.test(v)) { toast('Saisissez une adresse commençant par https://', { kind: 'warn' }); return; }
      store.update(c => { c.background.src = v; c.background.kind = kind.value === 'auto' ? kindFor(v) : kind.value; });
      url.value = '';
      updateBgInfo();
    },
  }, 'Appliquer');
  const removeBg = h('button', {
    type: 'button', class: 'btn link-btn',
    onclick: () => { store.update(c => { c.background.src = ''; }); updateBgInfo(); },
  }, 'Retirer le fond');

  const overlay = h('input', { type: 'range', min: '0', max: '0.9', step: '0.05' });
  const overlayOut = h('output', {});
  inputs.overlay = bind(overlay, c => c.background.overlay, (c, i) => { c.background.overlay = Number(i.value); overlayOut.textContent = `${Math.round(i.value * 100)} %`; });
  const accent = h('input', { type: 'color' });
  inputs.accent = bind(accent, c => c.theme.accent, (c, i) => { c.theme.accent = i.value; });
  const opacity = h('input', { type: 'range', min: '0', max: '0.95', step: '0.05' });
  inputs.opacity = bind(opacity, c => c.theme.panelOpacity, (c, i) => { c.theme.panelOpacity = Number(i.value); });
  const cardStyle = h('select', {},
    h('option', { value: 'tile' }, 'Tuiles (comme les profils)'),
    h('option', { value: 'row' }, 'Lignes'));
  inputs.cardStyle = bind(cardStyle, c => c.theme.cardStyle, (c, i) => { c.theme.cardStyle = i.value; }, 'change');
  const layout = h('select', {},
    h('option', { value: 'columns' }, 'Colonnes'),
    h('option', { value: 'free' }, 'Libre (n’importe où)'));
  inputs.layout = bind(layout, c => c.theme.layout, (c, i) => {
    if (i.value === 'free' && c.theme.layout !== 'free') {
      // Chaque catégorie garde sa place actuelle à l'écran.
      const pos = measurePositions();
      for (const cat of c.categories) if (pos[cat.id]) cat.pos = pos[cat.id];
    }
    c.theme.layout = i.value;
  }, 'change');
  const columns = h('select', {}, [1, 2, 3, 4, 5].map(n => h('option', { value: String(n) }, String(n))));
  inputs.columns = bind(columns, c => String(c.theme.columns), (c, i) => { c.theme.columns = Number(i.value); }, 'change');
  store.subscribe(() => { overlayOut.textContent = `${Math.round((store.get().background.overlay ?? 0) * 100)} %`; });

  return section('Design & fond',
    drop, fileInput, bgInfo,
    h('div', { class: 'row' }, url),
    h('div', { class: 'row' }, kind, applyUrl, removeBg),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Assombrissement du fond (voile) ', overlayOut), overlay),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Opacité des catégories'), opacity),
    h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Couleur d’accent'), accent),
    h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Style des cartes'), cardStyle),
    h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Disposition des catégories'), layout),
    h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Nombre de colonnes'), columns),
    h('p', { class: 'muted small' }, 'Libre : attrapez une catégorie par sa poignée ⠿ et posez-la où vous voulez, même en bas de la page.'),
  );
}

export function initSettings() {
  panel = document.getElementById('settings');
  panel.append(
    h('header', { class: 'settings-head' },
      h('h2', {}, 'Paramètres'),
      h('button', { type: 'button', class: 'icon-btn settings-close', 'aria-label': 'Fermer les paramètres', onclick: () => toggle(false) }, svgIcon('close')),
    ),
    h('p', { class: 'muted small edit-hint' }, 'Mode édition actif : les boutons modifier / supprimer apparaissent sur les catégories et les cartes.'),
    h('div', { class: 'add-row' },
      h('button', { type: 'button', class: 'btn primary', onclick: () => actions.addCategory() }, svgIcon('plus', 15), 'Ajouter une catégorie'),
      h('button', { type: 'button', class: 'btn', onclick: () => actions.addStandaloneCard() }, svgIcon('plus', 15), 'Ajouter une carte seule'),
    ),
    syncSection(),
    generalSection(),
    designSection(),
  );
  document.getElementById('settings-btn').addEventListener('click', () => toggle());
  addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen() && !document.querySelector('dialog[open]')) toggle(false); });
  store.subscribe(e => { if (e.remote || e.type === 'refresh') fillInputs(); });
}
