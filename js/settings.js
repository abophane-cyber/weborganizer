// Panneau Paramètres : synchronisation, général, design & fond.
import { h, svgIcon, toast, formatBytes } from './util.js';
import { store, isPristine, findCategory, findGroup, findCard } from './store.js';
import * as cloud from './folder.js';
import * as sync from './sync.js';
import { addMediaFile, isMediaRef, mediaInfo } from './media.js';
import { kindFor } from './background.js';
import { exportZip, importZip } from './transfer.js';
import { imageField } from './modal.js';
import { measurePositions, openView } from './board.js';
import * as selection from './selection.js';
import * as actions from './actions.js';
import { findCity } from './weather.js';

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
  const diag = h('p', { class: 'muted small diag' });
  const fmt = d => { const t = d ? new Date(d) : null; return t && !isNaN(t) ? t.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '?'; };
  const renderDiag = () => {
    const c = store.get();
    const i = sync.getInfo();
    const local = isPristine(c) ? 'page de départ (jamais modifiée)'
      : `« ${c.title || 'sans titre'} », ${c.categories.length} catégorie(s), modifiée le ${fmt(c.updatedAt)}`;
    const remote = !cloud.isConnected() ? 'non relié'
      : i.remoteExists === null ? 'pas encore vérifié'
        : i.remoteExists ? `config.json du ${fmt(i.remoteModified)}` : 'vide (aucune page enregistrée)';
    diag.replaceChildren(
      h('span', {}, `Cette page : ${local}`), h('br'),
      h('span', {}, `Dossier : ${remote}`),
      ...(i.lastSyncAt ? [h('br'), h('span', {}, `Dernière synchro : ${fmt(i.lastSyncAt)}`)] : []),
    );
  };
  const progress = h('p', { class: 'muted small progress-line', hidden: true });
  const actionBtn = h('button', { type: 'button', class: 'btn primary' });
  const syncBtn = h('button', { type: 'button', class: 'btn', onclick: () => sync.syncNow() }, 'Synchroniser maintenant');
  const changeBtn = h('button', {
    type: 'button', class: 'btn', onclick: () => pickFolder(),
  }, 'Changer de dossier');
  const disconnectBtn = h('button', {
    type: 'button', class: 'btn link-btn',
    onclick: () => {
      if (confirm('Ne plus synchroniser avec ce dossier sur ce navigateur ? Les fichiers du dossier ne sont pas supprimés.')) cloud.disconnect();
    },
  }, 'Oublier ce dossier');
  // Choisir le dossier (clic obligatoire : le navigateur affiche son sélecteur).
  async function pickFolder() {
    try {
      await cloud.connect();
      toast(`Dossier « ${cloud.folderName()} » relié. Synchronisation en cours…`, { kind: 'ok' });
    } catch (e) {
      if (e?.name !== 'AbortError') toast(`Impossible d'utiliser ce dossier : ${e.message}`, { kind: 'error' });
    }
  }

  const render = ({ status, detail }) => {
    chip.className = `sync-chip sync-${status}`;
    chip.textContent = sync.statusLabel[status] + (detail ? ` — ${detail}` : '');
    document.getElementById('settings-btn').dataset.sync = status;
    const connected = cloud.isConnected();
    const needsAuth = cloud.hasFolder() && !connected;
    actionBtn.hidden = connected || !cloud.isConfigured();
    actionBtn.textContent = needsAuth ? 'Autoriser l’accès au dossier' : 'Choisir le dossier de synchronisation…';
    syncBtn.hidden = !connected;
    changeBtn.hidden = !cloud.hasFolder();
    disconnectBtn.hidden = !cloud.hasFolder();
    account.textContent = !cloud.isConfigured()
      ? 'Ce navigateur ne permet pas d’enregistrer dans un dossier : utilisez Chrome ou Edge sur ordinateur. Vos données restent sur cet ordinateur.'
      : connected
        ? `Dossier relié : « ${cloud.folderName()} ». pCloud Drive le synchronise avec vos autres ordinateurs.`
        : needsAuth
          ? `Dossier « ${cloud.folderName()} » choisi : Chrome demande de réautoriser l’accès (un clic).`
          : 'Vos données sont enregistrées dans ce navigateur. Choisissez votre dossier WebOrganizer dans pCloud Drive (ex. P:\\WebOrganizer) pour les sauvegarder et les retrouver sur vos autres ordinateurs.';
  };
  actionBtn.addEventListener('click', async () => {
    if (cloud.hasFolder() && !cloud.isConnected()) {
      try { await cloud.reauthorize(); } catch (e) { toast(`Accès refusé : ${e.message}`, { kind: 'error' }); }
    } else pickFolder();
  });
  sync.onStatus(s => { render(s); renderDiag(); });
  store.subscribe(renderDiag);
  cloud.onAuthChange(() => render(sync.getStatus()));
  sync.onProgress(p => {
    progress.hidden = !!p.done;
    progress.textContent = `${p.download ? 'Lecture' : 'Enregistrement dans le dossier'} : ${p.name} — ${Math.round(p.ratio * 100)} %`;
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

  // Version de la page mise de côté (remplacée par celle de pCloud) : la proposer.
  const asideBox = h('div', { class: 'aside-box', hidden: true });
  const refreshAside = async () => {
    const a = await sync.getAside();
    if (!a) { asideBox.hidden = true; return; }
    const n = (a.categories || []).length;
    const when = a.asideAt ? new Date(a.asideAt).toLocaleString('fr-FR') : '';
    asideBox.replaceChildren(
      h('p', { class: 'small' }, h('strong', {}, 'Une autre version de votre page a été mise de côté'),
        ` — « ${a.title || 'sans titre'} », ${n} catégorie(s)${when ? `, le ${when}` : ''}. `,
        'Elle a été remplacée par la version de pCloud.'),
      h('div', { class: 'row wrap' },
        h('button', {
          type: 'button', class: 'btn primary',
          onclick: async () => {
            if (!confirm('Restaurer cette version ? Elle remplacera la page actuelle, ici et dans pCloud.')) return;
            await sync.restoreAside();
            toast('Votre page a été restaurée. Elle est envoyée dans pCloud.', { kind: 'ok' });
            fillInputs();
            refreshAside();
          },
        }, 'Restaurer cette version'),
        h('button', {
          type: 'button', class: 'btn link-btn',
          onclick: async () => {
            if (!confirm('Oublier définitivement cette version mise de côté ?')) return;
            await sync.dismissAside();
            refreshAside();
          },
        }, 'Ignorer'),
      ),
    );
    asideBox.hidden = false;
  };
  refreshAside();
  store.subscribe(e => { if (e.remote) refreshAside(); });

  return section('Synchronisation',
    h('div', { class: 'row' }, chip),
    asideBox,
    account,
    diag,
    progress,
    h('div', { class: 'row wrap' }, actionBtn, syncBtn),
    h('div', { class: 'row wrap' }, exportBtn,
      h('button', { type: 'button', class: 'btn', onclick: () => importInput.click() }, 'Importer'), importInput),
    h('div', { class: 'row wrap' }, changeBtn, disconnectBtn),
  );
}

// ---- Élément choisi (catégorie, sous-catégorie ou carte) ----
// Ses outils : modifier, ajouter dedans, ouvrir, supprimer. Sans choix : un rappel.

function contextBox() {
  const box = h('div', { class: 'context-box' });
  const btn = (label, onclick, cls = '', icon = '') => h('button', { type: 'button', class: `btn ${cls}`, onclick },
    icon && svgIcon(icon, 15), label);
  const render = () => {
    const s = selection.effective();
    const cat = s && findCategory(s.catId);
    const group = s?.groupId ? findGroup(s.catId, s.groupId) : null;
    const card = s?.kind === 'card' ? findCard(s.catId, s.groupId, s.cardId) : null;
    const missing = s && (!cat || (s.groupId && !group) || (s.kind === 'card' && !card));
    if (missing) { queueMicrotask(() => selection.clear()); return; }
    box.className = `context-box${s ? ` context-${s.kind}` : ''}`;
    if (!s) {
      box.replaceChildren(h('p', { class: 'muted small' },
        'Cliquez sur une catégorie, une sous-catégorie ou une carte : ses outils s’affichent ici. '
        + 'Double-clic sur une catégorie pour l’ouvrir.'));
      return;
    }
    const explicit = !!selection.get();
    const close = explicit && h('button', {
      type: 'button', class: 'icon-btn context-close', 'aria-label': 'Ne plus sélectionner', title: 'Ne plus sélectionner',
      onclick: () => selection.clear(),
    }, svgIcon('close', 16));
    const head = (kind, name, where) => h('header', { class: 'context-head' },
      h('div', {},
        h('span', { class: 'context-kind' }, kind),
        h('strong', { class: 'context-name' }, name || 'Sans titre'),
        where && h('span', { class: 'muted small context-where' }, where)),
      close);
    const toParent = () => selection.set({ kind: 'category', catId: cat.id });
    const inView = !explicit;
    let parts;
    if (s.kind === 'category') {
      const n = cat.cards.length + cat.groups.reduce((k, g) => k + g.cards.length, 0);
      parts = [
        head('Catégorie', cat.name, `${cat.groups.length} sous-catégorie(s), ${n} carte(s)`),
        h('div', { class: 'context-actions' },
          btn('Modifier (nom, icône, couleur)', () => actions.editCategory(cat.id), 'primary', 'edit'),
          btn('Ajouter une carte', () => actions.addCard(cat.id), '', 'plus'),
          btn('Ajouter une sous-catégorie', () => actions.addGroup(cat.id), '', 'plus'),
          !inView && btn('Ouvrir la catégorie', () => openView(cat.id), '', 'right'),
          btn('Supprimer la catégorie', () => actions.deleteCategory(cat.id), 'danger', 'trash')),
      ];
    } else if (s.kind === 'group') {
      parts = [
        head('Sous-catégorie', group.name, `Dans « ${cat.name} » · ${group.cards.length} carte(s)`),
        h('div', { class: 'context-actions' },
          btn('Modifier (nom, couleur)', () => actions.editGroup(cat.id, group.id), 'primary', 'edit'),
          btn('Ajouter une carte', () => actions.addCard(cat.id, group.id), '', 'plus'),
          !inView && btn('Ouvrir la sous-catégorie', () => openView(cat.id, group.id), '', 'right'),
          btn(`Catégorie « ${cat.name} »`, toParent, 'link-btn', 'up'),
          btn('Supprimer la sous-catégorie', () => actions.deleteGroup(cat.id, group.id), 'danger', 'trash')),
      ];
    } else {
      const where = cat.bare ? 'Carte seule (hors catégorie)' : `Dans « ${cat.name}${group ? ` › ${group.name}` : ''} »`;
      parts = [
        head(card.type === 'chrome' ? 'Carte — profil Chrome' : 'Carte', card.title, where),
        h('div', { class: 'context-actions' },
          btn('Modifier la carte', () => actions.editCard(cat.id, s.groupId, card.id), 'primary', 'edit'),
          group && btn(`Sous-catégorie « ${group.name} »`, () => selection.set({ kind: 'group', catId: cat.id, groupId: group.id }), 'link-btn', 'up'),
          !cat.bare && btn(`Catégorie « ${cat.name} »`, toParent, 'link-btn', 'up'),
          btn('Supprimer la carte', () => actions.deleteCard(cat.id, s.groupId, card.id), 'danger', 'trash')),
      ];
    }
    box.replaceChildren(...parts);
  };
  selection.onChange(render);
  render();
  return box;
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
    weatherFields(),
  );
}

// Météo : afficher ou non, et pour quelle ville.
function weatherFields() {
  const show = h('input', { type: 'checkbox' });
  show.checked = store.get().weather.enabled;
  show.addEventListener('change', () => store.update(c => { c.weather.enabled = show.checked; }));
  store.subscribe(() => { show.checked = store.get().weather.enabled; });
  const city = h('input', { type: 'text', maxlength: '80', placeholder: 'Ex. Lille' });
  const status = h('span', { class: 'field-help' });
  inputs.weatherCity = { input: city, read: c => c.weather.city };
  const search = async () => {
    const name = city.value.trim();
    if (!name || name === store.get().weather.city) return;
    status.textContent = 'Recherche…';
    try {
      const found = await findCity(name);
      if (!found) { status.textContent = `Ville « ${name} » introuvable.`; return; }
      store.update(c => { c.weather = { ...c.weather, ...found }; });
      city.value = found.city;
      status.textContent = `Météo de ${found.city}.`;
    } catch (e) { status.textContent = `Recherche impossible : ${e.message}`; }
  };
  city.addEventListener('change', search);
  city.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
  return h('div', { class: 'field' },
    h('label', { class: 'check-row' }, show, h('span', {}, 'Afficher la météo en haut de la page')),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Ville pour la météo'), city, status),
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
  // Charte de couleurs : change l'ambiance de toute la page (et la couleur d'accent).
  const palette = h('select', {},
    h('option', { value: 'classic' }, 'Classique (bleu nuit)'),
    h('option', { value: 'nature' }, 'Nature (verts, bruns, sable)'));
  inputs.palette = bind(palette, c => c.theme.palette, (c, i) => {
    c.theme.palette = i.value;
    c.theme.accent = i.value === 'nature' ? '#e2b98f' : '#6ea8fe';
  }, 'change');
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
    h('div', { class: 'row' }, removeBg),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Assombrissement du fond (voile) ', overlayOut), overlay),
    h('label', { class: 'field' }, h('span', { class: 'field-label' }, 'Opacité des catégories'), opacity),
    h('label', { class: 'field inline' }, h('span', { class: 'field-label' }, 'Charte de couleurs'), palette),
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
    h('p', { class: 'muted small edit-hint' }, 'Mode édition actif : sur la page, les flèches déplacent et la corbeille supprime.'),
    contextBox(),
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
