// Affichage des catégories, sous-catégories et cartes.
import { h, svgIcon, safeUrl, gmailInfo } from './util.js';
import { store, columnLayout } from './store.js';
import { iconEl, faviconFor } from './icons.js';
import { glyph } from './icon-library.js';
import { isMediaRef } from './media.js';
import { openChromeProfile, profileUrl, PROFILE_DIR_RE } from './chrome-profiles.js';
import * as actions from './actions.js';

function editButton(icon, label, onclick, extra = '') {
  return h('button', {
    type: 'button', class: `edit-btn ${extra}`, title: label, 'aria-label': label,
    onclick: e => { e.preventDefault(); e.stopPropagation(); onclick(); },
  }, svgIcon(icon, 15));
}

// ctx : { cat, groupId, list } (list = cartes du conteneur)
function cardControls(ctx, card, i) {
  const { cat, groupId, list } = ctx;
  return h('div', { class: 'edit-controls card-controls' },
    i > 0 && editButton('left', 'Déplacer avant', () => actions.moveCard(cat.id, groupId, card.id, -1)),
    i < list.length - 1 && editButton('right', 'Déplacer après', () => actions.moveCard(cat.id, groupId, card.id, 1)),
    editButton('edit', 'Modifier la carte', () => actions.editCard(cat.id, groupId, card.id)),
    editButton('trash', 'Supprimer la carte', () => actions.deleteCard(cat.id, groupId, card.id), 'danger'),
  );
}

// Contenu du cercle : photo / image envoyée (plein cercle), icône de la bibliothèque,
// favicône ou image web (centrée), sinon l'initiale du nom.
function avatarEl(src, label) {
  const full = isMediaRef(src);
  return h('span', { class: 'avatar' }, iconEl(src, label, full ? 'avatar-img' : 'avatar-icon'));
}

// Toutes les cartes partagent la même structure ; le style « tuile » (par défaut,
// comme les profils Chrome) ou « ligne » est choisi dans Paramètres → Design.
function linkCard(ctx, card, i) {
  const url = safeUrl(card.url);
  const color = /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : '';
  const email = url ? gmailInfo(url)?.email || '' : '';
  const name = card.title || email || url || 'Sans titre';
  // Lien à ouvrir dans un profil Chrome précis (chromeprofile://profil/adresse).
  const inProfile = url && /^https:/.test(url) && PROFILE_DIR_RE.test(card.openIn || '') ? card.openIn : '';
  return h('a', {
    class: `card tile link-card${url ? '' : ' link-blocked'}${color ? ' colored' : ''}`,
    href: inProfile ? profileUrl(inProfile, url) : (url || null),
    style: color ? { '--card-bg': color } : null,
    target: url && !inProfile ? '_blank' : null, rel: 'noopener noreferrer',
    onclick: inProfile ? e => { e.preventDefault(); openChromeProfile({ title: name, profileDir: inProfile }, url); } : null,
    title: !url ? 'Adresse refusée (seuls les liens http, https et mailto sont autorisés)'
      : email ? `Ouvrir la boîte ${email}` : url,
    'aria-disabled': url ? null : 'true',
  },
    avatarEl(card.icon || faviconFor(url), name),
    // Seulement le nom : l'adresse e-mail apparaît au survol (title).
    h('span', { class: 'card-text' }, h('span', { class: 'card-name' }, name)),
    card.badge && h('span', { class: 'badge' }, card.badge),
    cardControls(ctx, card, i),
  );
}

function chromeCard(ctx, card, i) {
  const valid = PROFILE_DIR_RE.test((card.profileDir || '').trim());
  return h('a', {
    class: 'card tile chrome-card colored', href: valid ? profileUrl(card.profileDir) : '#',
    style: { '--card-bg': card.color },
    title: valid ? `Ouvrir Chrome — profil « ${card.profileDir} »` : 'Dossier du profil à renseigner',
    onclick: e => { e.preventDefault(); openChromeProfile(card); },
  },
    avatarEl(card.photo, card.title),
    h('span', { class: 'card-text' }, h('span', { class: 'card-name' }, card.title || 'Profil')),
    card.badge && h('span', { class: 'badge' }, card.badge),
    cardControls(ctx, card, i),
  );
}

function cardsGrid(ctx) {
  const { list } = ctx;
  return h('div', { class: 'cards' },
    list.map((card, i) => (card.type === 'chrome' ? chromeCard(ctx, card, i) : linkCard(ctx, card, i))),
    h('button', { type: 'button', class: 'card add-card edit-only', onclick: () => actions.addCard(ctx.cat.id, ctx.groupId) },
      svgIcon('plus', 16), 'Ajouter une carte'),
  );
}

// Bouton de repli : flèche + titre cliquables, avec le nombre de cartes quand c'est replié.
function collapseToggle(tag, label, collapsed, count, onToggle) {
  return h('button', {
    type: 'button', class: 'collapse-toggle', 'aria-expanded': String(!collapsed),
    title: collapsed ? `Déplier « ${label} »` : `Replier « ${label} »`,
    onclick: e => { e.preventDefault(); onToggle(); },
  },
    h('span', { class: 'chevron', 'aria-hidden': 'true' }, svgIcon('down', 16)),
    h(tag, {}, label),
    collapsed && count > 0 && h('span', { class: 'collapsed-count' }, String(count)),
  );
}

function groupEl(cat, group, gi) {
  return h('div', {
    class: `group${group.collapsed ? ' collapsed' : ''}${group.color ? ' tinted' : ''}`,
    style: group.color ? { '--group-color': group.color } : null,
  },
    h('div', { class: 'group-head' },
      h('span', { class: 'group-icon', 'aria-hidden': 'true' }, glyph('folder', 15)),
      collapseToggle('h3', group.name, group.collapsed, group.cards.length, () => actions.toggleGroup(cat.id, group.id)),
      h('div', { class: 'edit-controls' },
        gi > 0 && editButton('up', 'Monter la sous-catégorie', () => actions.moveGroup(cat.id, group.id, -1)),
        gi < cat.groups.length - 1 && editButton('down', 'Descendre la sous-catégorie', () => actions.moveGroup(cat.id, group.id, 1)),
        editButton('edit', 'Renommer la sous-catégorie', () => actions.editGroup(cat.id, group.id)),
        editButton('trash', 'Supprimer la sous-catégorie', () => actions.deleteGroup(cat.id, group.id), 'danger'),
      ),
    ),
    cardsGrid({ cat, groupId: group.id, list: group.cards }),
  );
}

// pos : { col, nCols, index, count } — place de la catégorie dans sa colonne,
//       ou { free: true } en disposition libre (déplacement à la souris uniquement).
// Carte seule : pas de cadre ni de titre ; en édition, seulement la poignée et les
// boutons de déplacement (la carte garde ses boutons modifier / supprimer).
function bareEl(cat, pos) {
  const card = cat.cards[0];
  return h('section', {
    class: 'category bare', 'aria-label': card?.title || 'Carte', dataset: { id: cat.id },
    style: { '--cat-w': '140px' },
  },
    h('header', { class: 'category-head' },
      h('div', { class: 'edit-controls' },
        h('span', { class: 'drag-handle', title: 'Glisser pour déplacer la carte', 'aria-hidden': 'true' }, svgIcon('grip', 16)),
        !pos.free && pos.col > 0 && editButton('left', 'Colonne de gauche', () => actions.moveCategoryColumn(cat.id, -1)),
        !pos.free && pos.col < pos.nCols - 1 && editButton('right', 'Colonne de droite', () => actions.moveCategoryColumn(cat.id, 1)),
        !pos.free && pos.index > 0 && editButton('up', 'Monter', () => actions.moveCategoryInColumn(cat.id, -1)),
        !pos.free && pos.index < pos.count - 1 && editButton('down', 'Descendre', () => actions.moveCategoryInColumn(cat.id, 1)),
      ),
    ),
    cardsGrid({ cat, groupId: '', list: cat.cards }),
  );
}

function categoryEl(cat, pos) {
  if (cat.bare) return bareEl(cat, pos);
  // Cartes directes : masquées si vides et qu'il y a des sous-catégories (sauf en mode édition).
  const direct = cardsGrid({ cat, groupId: '', list: cat.cards });
  if (!cat.cards.length && cat.groups.length) direct.classList.add('edit-only-grid');
  const cardCount = cat.cards.length + cat.groups.reduce((n, g) => n + g.cards.length, 0);
  return h('section', {
    class: `category${cat.collapsed ? ' collapsed' : ''}${cat.color ? ' tinted' : ''}`, 'aria-label': cat.name, dataset: { id: cat.id },
    style: cat.color ? { '--cat-color': cat.color } : null,
  },
    h('header', { class: 'category-head' },
      iconEl(cat.icon, cat.name, 'category-icon'),
      collapseToggle('h2', cat.name, cat.collapsed, cardCount, () => actions.toggleCategory(cat.id)),
      h('div', { class: 'edit-controls' },
        h('span', { class: 'drag-handle', title: pos.free ? 'Glisser pour placer la catégorie où vous voulez' : 'Glisser pour déplacer la catégorie (dessus, dessous, autre colonne)', 'aria-hidden': 'true' }, svgIcon('grip', 16)),
        !pos.free && pos.col > 0 && editButton('left', 'Colonne de gauche', () => actions.moveCategoryColumn(cat.id, -1)),
        !pos.free && pos.col < pos.nCols - 1 && editButton('right', 'Colonne de droite', () => actions.moveCategoryColumn(cat.id, 1)),
        !pos.free && pos.index > 0 && editButton('up', 'Monter la catégorie', () => actions.moveCategoryInColumn(cat.id, -1)),
        !pos.free && pos.index < pos.count - 1 && editButton('down', 'Descendre la catégorie', () => actions.moveCategoryInColumn(cat.id, 1)),
        editButton('edit', 'Modifier la catégorie', () => actions.editCategory(cat.id)),
        editButton('trash', 'Supprimer la catégorie', () => actions.deleteCategory(cat.id), 'danger'),
      ),
    ),
    direct,
    cat.groups.map((g, gi) => groupEl(cat, g, gi)),
    h('button', { type: 'button', class: 'add-group edit-only', onclick: () => actions.addGroup(cat.id) },
      svgIcon('plus', 14), 'Ajouter une sous-catégorie'),
  );
}

// ---- Glisser-déposer des catégories (mode édition, par la poignée) ----
// Sur une catégorie : moitié haute = au-dessus, moitié basse = en dessous.
// Sur le vide d'une colonne : à la fin de cette colonne.
let dragId = null;
function clearDropMarks() {
  document.querySelectorAll('.drop-before, .drop-after, .drop-end')
    .forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-end'));
}
function enableCategoryDrag(section, cat) {
  const handle = section.querySelector('.drag-handle');
  // La catégorie n'est déplaçable que si on la saisit par sa poignée.
  handle.addEventListener('pointerdown', () => { section.draggable = true; });
  handle.addEventListener('pointerup', () => { if (!dragId) section.draggable = false; });
  section.addEventListener('dragstart', e => {
    if (!section.draggable) return;
    dragId = cat.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cat.name);
    section.classList.add('dragging');
    document.body.classList.add('cat-dragging');
  });
  section.addEventListener('dragend', () => {
    section.draggable = false;
    section.classList.remove('dragging');
    document.body.classList.remove('cat-dragging');
    dragId = null;
    clearDropMarks();
  });
  section.addEventListener('dragover', e => {
    if (!dragId || dragId === cat.id) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    const r = section.getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    clearDropMarks();
    section.classList.add(after ? 'drop-after' : 'drop-before');
  });
  section.addEventListener('drop', e => {
    if (!dragId || dragId === cat.id) return;
    e.preventDefault();
    e.stopPropagation();
    const after = section.classList.contains('drop-after');
    const moved = dragId;
    clearDropMarks();
    actions.placeCategory(moved, Number(section.closest('.board-col').dataset.col), cat.id, after);
  });
}
function enableColumnDrop(col, index) {
  col.addEventListener('dragover', e => {
    if (!dragId) return;
    e.preventDefault();
    clearDropMarks();
    col.classList.add('drop-end');
  });
  col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drop-end'); });
  col.addEventListener('drop', e => {
    if (!dragId) return;
    e.preventDefault();
    const moved = dragId;
    clearDropMarks();
    actions.placeCategory(moved, index, null, false);
  });
}

// ---- Disposition libre : chaque catégorie a une position { x, y } ----
// x : fraction (0 à 1) de la largeur disponible ; y : distance en px depuis le haut.
const GRID = 10; // aimantation

function placeFree(section, pos) {
  section.style.left = `calc((100% - var(--cat-w)) * ${Math.min(1, Math.max(0, pos.x))})`;
  section.style.top = `${Math.max(0, pos.y)}px`;
}

// Hauteur du plan : jusqu'à la catégorie la plus basse, au moins jusqu'en bas de l'écran,
// et une marge supplémentaire en mode édition pour pouvoir descendre plus bas.
// Échelle du plan pendant l'édition : il est réduit pour tenir à côté du panneau
// Paramètres, sans changer les positions (pas de chevauchement).
function editScale(canvas) {
  if (!document.body.classList.contains('editing')) return 1;
  const panel = document.getElementById('settings');
  const avail = window.innerWidth - (panel?.offsetWidth || 400) - canvas.getBoundingClientRect().left - 16;
  return Math.max(0.4, Math.min(1, avail / canvas.offsetWidth));
}

function fitCanvas(canvas) {
  canvas.style.setProperty('--edit-scale', String(editScale(canvas)));
  let bottom = 0;
  canvas.querySelectorAll(':scope > .category').forEach(s => { if (!s.hidden) bottom = Math.max(bottom, s.offsetTop + s.offsetHeight); });
  const top = canvas.getBoundingClientRect().top + window.scrollY; // position dans la page
  const screenRest = window.innerHeight - top - 60;
  const extra = document.body.classList.contains('editing') ? 320 : 24;
  canvas.style.height = `${Math.max(bottom + extra, screenRest, 200)}px`;
}

function enableFreeDrag(section, cat, canvas) {
  const handle = section.querySelector('.drag-handle');
  let st = null;
  handle.addEventListener('pointerdown', e => {
    if (!document.body.classList.contains('editing') || e.button !== 0) return;
    e.preventDefault();
    const r = section.getBoundingClientRect();
    const k = editScale(canvas); // coordonnées à l'écran -> coordonnées du plan
    st = { k, dx: (e.clientX - r.left) / k, dy: (e.clientY - r.top) / k };
    handle.setPointerCapture(e.pointerId);
    section.classList.add('moving');
  });
  handle.addEventListener('pointermove', e => {
    if (!st) return;
    const c = canvas.getBoundingClientRect();
    const maxL = Math.max(0, canvas.offsetWidth - section.offsetWidth);
    const left = Math.min(maxL, Math.max(0, Math.round(((e.clientX - c.left) / st.k - st.dx) / GRID) * GRID));
    const top = Math.max(0, Math.round(((e.clientY - c.top) / st.k - st.dy) / GRID) * GRID);
    section.style.left = `${left}px`;
    section.style.top = `${top}px`;
    st.cur = { x: maxL ? left / maxL : 0, y: top };
    fitCanvas(canvas);
  });
  const end = () => {
    if (!st) return;
    const cur = st.cur;
    st = null;
    section.classList.remove('moving');
    if (cur) actions.setCategoryPosition(cat.id, cur);
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

// Positions actuelles des catégories à l'écran (pour passer en disposition libre sans saut).
export function measurePositions() {
  const area = document.querySelector('.board-cols, .board-canvas');
  if (!area) return {};
  // Mesure la page telle qu'elle s'affiche panneau fermé (le panneau la rétrécit).
  const editing = document.body.classList.contains('editing');
  if (editing) document.body.classList.remove('editing');
  const a = area.getBoundingClientRect();
  const out = {};
  area.querySelectorAll('.category').forEach(s => {
    const r = s.getBoundingClientRect();
    const maxL = Math.max(1, a.width - r.width);
    out[s.dataset.id] = { x: Math.min(1, Math.max(0, (r.left - a.left) / maxL)), y: Math.round(r.top - a.top) };
  });
  if (editing) document.body.classList.add('editing');
  return out;
}

let resizeHooked = false;
function renderFree(root, cfg) {
  const canvas = h('div', { class: 'board-canvas' });
  // Catégories sans position : en quinconce, à la suite.
  let auto = 0;
  for (const cat of cfg.categories.filter(c => c.display !== 'dock')) {
    const sec = categoryEl(cat, { free: true });
    const pos = cat.pos || { x: (auto % 3) / 2, y: Math.floor(auto / 3) * 340 };
    if (!cat.pos) auto++;
    placeFree(sec, pos);
    enableFreeDrag(sec, cat, canvas);
    canvas.append(sec);
  }
  root.replaceChildren(
    canvas,
    h('p', { class: 'search-empty', hidden: true }, 'Aucune carte ne correspond à la recherche.'),
  );
  requestAnimationFrame(() => fitCanvas(canvas));
  // Les images (favicônes, photos) peuvent changer la hauteur après coup.
  const ro = new ResizeObserver(() => fitCanvas(canvas));
  canvas.querySelectorAll('.category').forEach(s => ro.observe(s));
  if (!resizeHooked) {
    resizeHooked = true;
    const refit = () => { const c = document.querySelector('.board-canvas'); if (c) fitCanvas(c); };
    addEventListener('resize', refit);
    // Ouverture / fermeture des Paramètres : marge du bas en mode édition.
    new MutationObserver(refit).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}

// ---- Barre latérale : catégories affichées « en ronds sur le côté gauche » ----
// Hors édition : un clic ouvre la carte. En édition (Paramètres ouverts) : un clic la
// modifie, la corbeille la supprime, « + » en ajoute une, le crayon modifie la catégorie.
const isEditing = () => document.body.classList.contains('editing');

function dockItem(card, cat, groupId) {
  const isChrome = card.type === 'chrome';
  const url = isChrome ? '' : safeUrl(card.url);
  const valid = isChrome && PROFILE_DIR_RE.test((card.profileDir || '').trim());
  const color = /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : '';
  const src = isChrome ? card.photo : (card.icon || faviconFor(url));
  const email = url ? gmailInfo(url)?.email || '' : '';
  const name = card.title || email || url || 'Sans titre';
  const inProfile = !isChrome && url && /^https:/.test(url) && PROFILE_DIR_RE.test(card.openIn || '') ? card.openIn : '';
  let sub = '';
  try { sub = isChrome ? `Profil Chrome · ${card.profileDir || '?'}` : (email || (url ? new URL(url).hostname : '')); } catch { /* ignore */ }
  if (inProfile) sub += ` · profil ${inProfile}`;
  const circle = big => h('span', { class: `dock-avatar${big ? ' big' : ''}`, style: color ? { '--card-bg': color } : null },
    iconEl(src, name, isMediaRef(src) ? 'avatar-img' : 'avatar-icon'));
  return h('div', { class: 'dock-slot' },
    h('a', {
      class: 'dock-item', href: isChrome ? (valid ? profileUrl(card.profileDir) : '#') : (inProfile ? profileUrl(inProfile, url) : (url || null)),
      target: !isChrome && url && !inProfile ? '_blank' : null, rel: 'noopener noreferrer', 'aria-label': name,
      onclick: e => {
        if (isEditing()) { e.preventDefault(); actions.editCard(cat.id, groupId, card.id); return; }
        if (isChrome) { e.preventDefault(); openChromeProfile(card); }
        else if (inProfile) { e.preventDefault(); openChromeProfile({ title: name, profileDir: inProfile }, url); }
      },
    },
      circle(false),
      card.badge && h('span', { class: 'dock-badge' }, card.badge),
      // Fiche affichée au survol, à droite du rond.
      h('span', { class: 'dock-card', role: 'tooltip' },
        circle(true),
        h('span', { class: 'dock-name' }, name),
        sub && h('span', { class: 'dock-sub' }, sub),
        card.badge && h('span', { class: 'badge' }, card.badge),
        h('span', { class: 'dock-hint' }, 'Clic : modifier la carte'),
      ),
    ),
    h('button', {
      type: 'button', class: 'dock-delete', title: `Supprimer « ${name} »`, 'aria-label': `Supprimer « ${name} »`,
      onclick: () => actions.deleteCard(cat.id, groupId, card.id),
    }, svgIcon('trash', 12)),
  );
}

function renderDock(cfg) {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const cats = cfg.categories.filter(c => c.display === 'dock');
  dock.hidden = cats.length === 0;
  document.body.classList.toggle('has-dock', cats.length > 0);
  // Une barre arrondie par catégorie, séparées par un espace ; ▲ ▼ changent leur ordre.
  dock.replaceChildren(...cats.map((cat, i) => h('div', { class: 'dock-group', 'aria-label': cat.name, role: 'group' },
    h('div', { class: 'dock-order' },
      i > 0 && h('button', {
        type: 'button', class: 'dock-mini', title: `Monter « ${cat.name} »`, 'aria-label': `Monter « ${cat.name} »`,
        onclick: () => actions.moveDocked(cat.id, -1),
      }, svgIcon('up', 12)),
      i < cats.length - 1 && h('button', {
        type: 'button', class: 'dock-mini', title: `Descendre « ${cat.name} »`, 'aria-label': `Descendre « ${cat.name} »`,
        onclick: () => actions.moveDocked(cat.id, 1),
      }, svgIcon('down', 12)),
    ),
    h('button', {
      type: 'button', class: 'dock-tool', title: `Modifier la catégorie « ${cat.name} »`, 'aria-label': `Modifier la catégorie « ${cat.name} »`,
      onclick: () => actions.editCategory(cat.id),
    }, svgIcon('edit', 14)),
    ...cat.cards.map(card => dockItem(card, cat, '')),
    ...cat.groups.flatMap(g => g.cards.map(card => dockItem(card, cat, g.id))),
    h('button', {
      type: 'button', class: 'dock-tool', title: `Ajouter une carte à « ${cat.name} »`, 'aria-label': `Ajouter une carte à « ${cat.name} »`,
      onclick: () => actions.addCard(cat.id),
    }, svgIcon('plus', 16)),
  )));
}

export function renderBoard(root) {
  const cfg = store.get();
  renderDock(cfg);
  root.classList.toggle('board-free', cfg.theme.layout === 'free');
  if (cfg.theme.layout === 'free') {
    renderFree(root, cfg);
    applySearch(root);
    return;
  }
  const { nCols, byColumn } = columnLayout(cfg);
  const columns = byColumn.map((cats, col) => {
    const el = h('div', { class: 'board-col', dataset: { col: String(col) } },
      cats.map((cat, index) => {
        const sec = categoryEl(cat, { col, nCols, index, count: cats.length });
        enableCategoryDrag(sec, cat);
        return sec;
      }),
      h('div', { class: 'col-drop', 'aria-hidden': 'true' }),
    );
    enableColumnDrop(el, col);
    return el;
  });
  root.replaceChildren(
    h('div', { class: 'board-cols' }, columns),
    h('p', { class: 'search-empty', hidden: true }, 'Aucune carte ne correspond à la recherche.'),
  );
  applySearch(root);
}

// ---- Recherche ----
// Filtre les cartes affichées (nom, adresse, e-mail, dossier de profil, badge, catégorie).
// Sans accents ni majuscules ; chaque mot tapé doit être trouvé.

let query = '';
const fold = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function cardText(card, cat, group) {
  return fold([card.title, card.url, gmailInfo(card.url || '')?.email, card.profileDir, card.badge,
    cat.name, group?.name].filter(Boolean).join(' '));
}

function applySearch(root) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  document.body.classList.toggle('searching', words.length > 0);
  const cfg = store.get();
  let shown = 0;
  root.querySelectorAll('.category').forEach(section => {
    const cat = cfg.categories.find(c => c.id === section.dataset.id);
    if (!cat) return;
    let catShown = 0;
    const holders = [{ el: section.querySelector(':scope > .cards'), list: cat.cards, group: null },
      ...[...section.querySelectorAll(':scope > .group')].map((el, gi) => ({ el, list: cat.groups[gi].cards, group: cat.groups[gi] }))];
    for (const { el, list, group } of holders) {
      const cardEls = el.querySelectorAll(':scope .card:not(.add-card)');
      let n = 0;
      list.forEach((card, i) => {
        const ok = !words.length || words.every(w => cardText(card, cat, group).includes(w));
        if (cardEls[i]) cardEls[i].hidden = !ok;
        if (ok) n++;
      });
      if (group) el.hidden = words.length > 0 && n === 0;
      catShown += n;
    }
    section.hidden = words.length > 0 && catShown === 0;
    shown += catShown;
  });
  root.querySelector('.search-empty').hidden = !(words.length && shown === 0);
}

export function initSearch(input, root) {
  input.addEventListener('input', () => { query = input.value; applySearch(root); });
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; query = ''; applySearch(root); input.blur(); }
    if (e.key === 'Enter') {
      // Entrée : ouvre la première carte trouvée.
      const first = [...root.querySelectorAll('.card:not(.add-card)')].find(c => c.offsetParent);
      if (first && query.trim()) { e.preventDefault(); first.click(); }
    }
  });
  // Touche « / » : place le curseur dans la recherche (hors champs de saisie).
  addEventListener('keydown', e => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select, [contenteditable], dialog')) return;
    e.preventDefault();
    input.focus();
  });
}
