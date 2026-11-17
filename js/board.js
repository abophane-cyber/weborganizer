// Affichage des catégories, sous-catégories et cartes.
import { h, svgIcon, safeUrl, gmailInfo } from './util.js';
import { store, columnLayout, viewOrder } from './store.js';
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

// ctx : { cat, groupId, list, keys?, drag? } (list = cartes du conteneur ;
// keys = ordre commun cartes + sous-catégories sur l'écran de la catégorie, i y est l'index)
function cardControls(ctx, card, i) {
  const { cat, groupId, list, keys } = ctx;
  const shift = dir => (keys ? actions.moveInView(cat.id, 'c:' + card.id, dir) : actions.moveCard(cat.id, groupId, card.id, dir));
  const n = keys ? keys.length : list.length;
  return h('div', { class: 'edit-controls card-controls' },
    i > 0 && editButton('left', 'Déplacer avant', () => shift(-1)),
    i < n - 1 && editButton('right', 'Déplacer après', () => shift(1)),
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
    dataset: { key: 'c:' + card.id }, draggable: ctx.drag ? 'false' : null,
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
    dataset: { key: 'c:' + card.id }, draggable: ctx.drag ? 'false' : null,
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

const cardEl = (ctx, card, i) => (card.type === 'chrome' ? chromeCard(ctx, card, i) : linkCard(ctx, card, i));
const addCardButton = ctx => h('button', { type: 'button', class: 'card add-card edit-only', onclick: () => actions.addCard(ctx.cat.id, ctx.groupId) },
  svgIcon('plus', 16), 'Ajouter une carte');

function cardsGrid(ctx) {
  return h('div', { class: 'cards' }, ctx.list.map((card, i) => cardEl(ctx, card, i)), addCardButton(ctx));
}

// ---- Ouverture d'une catégorie / sous-catégorie sur un écran à part ----
// L'écran ouvert est dans l'adresse (#c/<catégorie> ou #c/<catégorie>/<sous-catégorie>) :
// le bouton « Retour » comme le retour du navigateur ramènent au niveau précédent.
const boardRoot = () => document.getElementById('board');
const enc = encodeURIComponent;
const pageUrl = () => location.pathname + location.search;

function currentView(cfg) {
  const m = /^#c\/([^/]+)(?:\/([^/]+))?$/.exec(location.hash);
  if (!m) return null;
  const cat = cfg.categories.find(c => c.id === decodeURIComponent(m[1]));
  if (!cat || cat.bare) return null;
  const group = m[2] ? cat.groups.find(g => g.id === decodeURIComponent(m[2])) || null : null;
  return { cat, group };
}

function clearSearch() {
  const input = document.getElementById('search');
  if (input) input.value = '';
  query = '';
}

export function openView(catId, groupId = '') {
  clearSearch();
  history.pushState({ wo: true }, '', `#c/${enc(catId)}${groupId ? `/${enc(groupId)}` : ''}`);
  renderBoard(boardRoot());
  scrollTo(0, 0);
}

function goBack(view) {
  // Écran ouvert depuis la page : on revient simplement en arrière dans l'historique.
  if (history.state?.wo) { history.back(); return; }
  history.replaceState(null, '', view.group ? `#c/${enc(view.cat.id)}` : pageUrl());
  renderBoard(boardRoot());
}

addEventListener('popstate', () => { renderBoard(boardRoot()); scrollTo(0, 0); });

// Touche Échap sur l'écran d'une catégorie : comme le bouton Retour
// (sauf dans un champ de saisie, une fenêtre ouverte ou les Paramètres).
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || e.defaultPrevented || !document.body.classList.contains('viewing')) return;
  if (document.body.classList.contains('editing') || document.querySelector('.modal, dialog[open]')) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
  const back = document.querySelector('.view-back');
  if (back) { e.preventDefault(); back.click(); }
});

// Titre cliquable d'une catégorie (ou sous-catégorie) sur la page : ouvre son écran.
function openButton(tag, label, count, onOpen) {
  return h('button', {
    type: 'button', class: 'collapse-toggle open-toggle', title: `Ouvrir « ${label} »`,
    onclick: e => { e.preventDefault(); e.stopPropagation(); onOpen(); },
  },
    h(tag, {}, label),
    count > 0 && h('span', { class: 'collapsed-count' }, String(count)),
  );
}

function groupEl(cat, group, gi) {
  return h('div', {
    class: `group${group.color ? ' tinted' : ''}`,
    // tone : rang de la sous-catégorie (0 à 3), pour alterner les teintes de la charte « Nature ».
    dataset: { tone: String(gi % 4) },
    style: group.color ? { '--group-color': group.color } : null,
  },
    h('div', { class: 'group-head' },
      h('span', { class: 'group-icon', 'aria-hidden': 'true' }, glyph('folder', 15)),
      openButton('h3', group.name, group.cards.length, () => openView(cat.id, group.id)),
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
    class: `category closed${cat.color ? ' tinted' : ''}`, 'aria-label': cat.name,
    // tone : rang de la catégorie (0 à 3), pour alterner les teintes de la charte « Nature ».
    dataset: { id: cat.id, tone: String(Math.max(0, store.get().categories.indexOf(cat)) % 4) },
    style: cat.color ? { '--cat-color': cat.color } : null,
    // Un clic n'importe où sur le cadre ouvre la catégorie (sauf boutons et cartes,
    // visibles seulement pendant une recherche ou en édition).
    onclick: e => {
      if (e.target.closest('.edit-controls, .card, .group, .add-group')) return;
      openView(cat.id);
    },
  },
    h('header', { class: 'category-head' },
      iconEl(cat.icon, cat.name, 'category-icon'),
      openButton('h2', cat.name, cardCount, () => openView(cat.id)),
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

// ---- Écran d'une catégorie ou d'une sous-catégorie ----
// Bouton « Retour », titre au centre, puis les cartes ; pour une catégorie, ses
// sous-catégories en tuiles qui ouvrent leur propre écran.
// i : place de la tuile parmi les cartes et sous-catégories (keys) de l'écran.
function groupTile(cat, group, i, keys) {
  const n = group.cards.length;
  const key = 'g:' + group.id;
  return h('a', {
    class: `card tile group-tile${group.color ? ' colored' : ''}`, href: `#c/${enc(cat.id)}/${enc(group.id)}`,
    dataset: { key }, draggable: 'false',
    style: group.color ? { '--card-bg': group.color } : null, title: `Ouvrir « ${group.name} »`,
    onclick: e => { e.preventDefault(); openView(cat.id, group.id); },
  },
    h('span', { class: 'avatar' }, glyph('folder', 24)),
    h('span', { class: 'card-text' }, h('span', { class: 'card-name' }, group.name)),
    // Nombre de cartes : gros chiffre en volume, comme un numéro de maison fixé au mur.
    h('span', { class: 'group-count', 'aria-label': `${n} carte${n > 1 ? 's' : ''}` }, String(n)),
    h('div', { class: 'edit-controls card-controls' },
      i > 0 && editButton('left', 'Déplacer avant', () => actions.moveInView(cat.id, key, -1)),
      i < keys.length - 1 && editButton('right', 'Déplacer après', () => actions.moveInView(cat.id, key, 1)),
      editButton('edit', 'Modifier la sous-catégorie', () => actions.editGroup(cat.id, group.id)),
      editButton('trash', 'Supprimer la sous-catégorie', () => actions.deleteGroup(cat.id, group.id), 'danger'),
    ),
  );
}

function viewEl(view) {
  const { cat, group } = view;
  const color = group ? group.color : cat.color;
  const head = h('header', { class: 'view-head' },
    h('button', { type: 'button', class: 'view-back', title: 'Retour (touche Échap)', onclick: () => goBack(view) }, svgIcon('left', 22), 'Retour'),
    h('h2', { class: 'view-title' },
      group ? h('span', { class: 'view-icon', 'aria-hidden': 'true' }, glyph('folder', 20)) : iconEl(cat.icon, cat.name, 'category-icon'),
      h('span', {}, group ? group.name : cat.name),
    ),
    h('div', { class: 'edit-controls view-controls' },
      group
        ? editButton('edit', 'Modifier la sous-catégorie', () => actions.editGroup(cat.id, group.id))
        : editButton('edit', 'Modifier la catégorie', () => actions.editCategory(cat.id)),
      group
        ? editButton('trash', 'Supprimer la sous-catégorie', () => actions.deleteGroup(cat.id, group.id), 'danger')
        : editButton('trash', 'Supprimer la catégorie', () => actions.deleteCategory(cat.id), 'danger'),
    ),
  );
  let body;
  if (group) {
    const ctx = { cat, groupId: group.id, list: group.cards, drag: true };
    body = enableTileDrag(cardsGrid(ctx), keys => actions.setCardOrder(cat.id, group.id, keys.map(k => k.slice(2))));
  } else {
    // Cartes et sous-catégories dans une seule grille, dans l'ordre choisi.
    const keys = viewOrder(cat);
    const ctx = { cat, groupId: '', list: cat.cards, keys, drag: true };
    const cards = new Map(cat.cards.map(c => ['c:' + c.id, c]));
    const groups = new Map(cat.groups.map(g => ['g:' + g.id, g]));
    body = [
      enableTileDrag(h('div', { class: 'cards' },
        keys.map((k, i) => (cards.has(k) ? cardEl(ctx, cards.get(k), i) : groupTile(cat, groups.get(k), i, keys))),
        addCardButton(ctx),
      ), next => actions.setViewOrder(cat.id, next)),
      h('button', { type: 'button', class: 'add-group edit-only', onclick: () => actions.addGroup(cat.id) },
        svgIcon('plus', 14), 'Ajouter une sous-catégorie'),
    ];
  }
  const empty = group ? !group.cards.length : !cat.cards.length && !cat.groups.length;
  // Nombre de tuiles de la rangée (hors édition / en édition, avec la tuile
  // « Ajouter une carte ») : le bloc prend exactement la largeur des tuiles,
  // ainsi « Retour » se place juste au-dessus, sur leur bord gauche.
  const tiles = group ? group.cards.length : cat.cards.length + cat.groups.length;
  const nv = tiles, ne = tiles + 1;
  return h('section', {
    class: 'cat-view', 'aria-label': group ? group.name : cat.name,
    style: { ...(color ? { '--cat-color': color } : {}), '--nv': String(nv), '--ne': String(ne) },
  },
    // Retour + titre + tuiles forment un seul bloc, centré sur l'écran.
    h('div', { class: 'view-body' },
      head,
      body,
      empty && h('p', { class: 'view-empty' }, 'Aucune carte pour l’instant. Ouvrez les Paramètres pour en ajouter.'),
    ),
  );
}

// ---- Glisser-déposer des tuiles d'un écran (mode édition) ----
// Cartes et sous-catégories : on saisit une tuile n'importe où (sauf ses boutons),
// elle suit la souris et les autres glissent pour lui faire de la place ; au lâcher,
// onDrop reçoit le nouvel ordre (clés 'c:<id>' / 'g:<id>'). Les tuiles restent
// toujours rangées dans la grille, donc toujours alignées.
function enableTileDrag(grid, onDrop) {
  const tiles = () => [...grid.querySelectorAll(':scope > .card[data-key]')];
  grid.addEventListener('pointerdown', e => {
    if (!document.body.classList.contains('editing') || e.button !== 0) return;
    const tile = e.target.closest('.card[data-key]');
    if (!tile || tile.parentElement !== grid || e.target.closest('.edit-controls')) return;
    const initial = tiles().map(t => t.dataset.key).join();
    const start = tile.getBoundingClientRect();
    const st = { x: e.clientX, y: e.clientY, offX: e.clientX - start.left, offY: e.clientY - start.top, moving: false };

    // Les autres tuiles glissent en douceur vers leur nouvelle place.
    const reorder = fn => {
      const others = tiles().filter(t => t !== tile);
      const before = new Map(others.map(t => [t, t.getBoundingClientRect()]));
      fn();
      for (const t of others) {
        const a = before.get(t), b = t.getBoundingClientRect();
        if (a.left === b.left && a.top === b.top) continue;
        t.animate([{ transform: `translate(${a.left - b.left}px, ${a.top - b.top}px)` }, { transform: 'none' }],
          { duration: 180, easing: 'ease-out' });
      }
    };
    // La tuile saisie reste sous la souris, où que soit sa place dans la grille.
    const follow = ev => {
      tile.style.setProperty('--drag-t', 'none');
      const r = tile.getBoundingClientRect();
      tile.style.setProperty('--drag-t', `translate(${ev.clientX - st.offX - r.left}px, ${ev.clientY - st.offY - r.top}px) scale(1.04)`);
    };

    const onMove = ev => {
      if (!st.moving) {
        if (Math.hypot(ev.clientX - st.x, ev.clientY - st.y) < 6) return;
        st.moving = true;
        tile.setPointerCapture(e.pointerId);
        tile.classList.add('tile-dragging');
        document.body.classList.add('group-dragging');
      }
      ev.preventDefault();
      // Tuile survolée : la tuile saisie prend sa place.
      const over = tiles().find(t => {
        if (t === tile) return false;
        const r = t.getBoundingClientRect();
        return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
      });
      if (over) {
        const list = tiles();
        const after = list.indexOf(over) > list.indexOf(tile);
        reorder(() => over.insertAdjacentElement(after ? 'afterend' : 'beforebegin', tile));
      }
      follow(ev);
    };
    const onUp = () => {
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      removeEventListener('pointercancel', onUp);
      if (!st.moving) return;
      // Le clic qui suit le lâcher ne doit pas ouvrir la sous-catégorie.
      const swallow = ev => { ev.preventDefault(); ev.stopPropagation(); };
      addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => removeEventListener('click', swallow, { capture: true }), 0);
      setTimeout(() => document.body.classList.remove('group-dragging'), 0);
      tile.classList.remove('tile-dragging');
      tile.style.removeProperty('--drag-t');
      const keys = tiles().map(t => t.dataset.key);
      if (keys.join() !== initial) onDrop(keys);
    };
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
  });
  return grid;
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
  centerGroup(canvas);
}

// Hors édition, l'ensemble des pavés est recentré sous la barre de recherche
// (les positions enregistrées ne changent pas ; en édition, on voit le plan tel quel).
function centerGroup(area) {
  if (!area) return;
  area.style.translate = '';
  if (document.body.classList.contains('editing')) return;
  let minL = Infinity, maxR = -Infinity;
  area.querySelectorAll('.category').forEach(s => {
    const r = s.getBoundingClientRect();
    if (!r.width) return;
    minL = Math.min(minL, r.left);
    maxR = Math.max(maxR, r.right);
  });
  if (minL === Infinity) return;
  const a = area.getBoundingClientRect();
  const ref = document.querySelector('.top-text')?.getBoundingClientRect();
  const target = ref && ref.width ? ref.left + ref.width / 2 : a.left + a.width / 2;
  // Sans sortir de la zone du tableau.
  const shift = Math.min(a.right - maxR, Math.max(a.left - minL, target - (minL + maxR) / 2));
  if (Math.abs(shift) >= 1) area.style.translate = `${Math.round(shift)}px 0`;
}
const recenter = () => centerGroup(document.querySelector('.board-cols, .board-canvas'));

// ---- Aimantation sur les autres pavés ----
// Pendant le glisser, le pavé s'accroche (à moins de SNAP px) aux bords et au centre
// des autres pavés, ou se place à l'écart habituel (GAP) à côté / en dessous d'eux.
// Sinon, il retombe sur la grille de GRID px. Des lignes guides montrent l'alignement.
const SNAP = 14;
const GAP = 18; // même écart qu'entre les colonnes de la disposition classique

function snapToOthers(section, canvas, rawL, rawT, maxL) {
  const w = section.offsetWidth, hgt = section.offsetHeight;
  const xs = [{ v: 0, g: 0 }, { v: maxL, g: maxL + w }]; // positions candidates + où tracer le guide
  const ys = [{ v: 0, g: 0 }];
  canvas.querySelectorAll(':scope > .category').forEach(o => {
    if (o === section || o.hidden) return;
    const L = o.offsetLeft, T = o.offsetTop, R = L + o.offsetWidth, B = T + o.offsetHeight;
    xs.push({ v: L, g: L }, { v: R - w, g: R }, { v: L + (o.offsetWidth - w) / 2, g: L + o.offsetWidth / 2 },
      { v: R + GAP, g: R + GAP }, { v: L - GAP - w, g: L - GAP }, { v: L - w, g: L }, { v: R, g: R });
    ys.push({ v: T, g: T }, { v: B - hgt, g: B }, { v: B + GAP, g: B + GAP }, { v: T - GAP - hgt, g: T - GAP });
  });
  const best = (raw, list, max) => {
    let pick = null;
    for (const c of list) {
      if (c.v < 0 || c.v > max) continue;
      const d = Math.abs(c.v - raw);
      if (d <= SNAP && (!pick || d < pick.d)) pick = { ...c, d };
    }
    return pick;
  };
  const bx = best(rawL, xs, maxL), by = best(rawT, ys, Infinity);
  return {
    left: bx ? Math.round(bx.v) : Math.min(maxL, Math.round(rawL / GRID) * GRID),
    top: by ? Math.round(by.v) : Math.round(rawT / GRID) * GRID,
    gx: bx ? bx.g : null, gy: by ? by.g : null,
  };
}

function showGuides(canvas, gx, gy) {
  for (const [cls, v] of [['v', gx], ['h', gy]]) {
    let g = canvas.querySelector(`:scope > .snap-guide.${cls}`);
    if (v == null) { g?.remove(); continue; }
    if (!g) { g = h('div', { class: `snap-guide ${cls}`, 'aria-hidden': 'true' }); canvas.append(g); }
    g.style.setProperty(cls === 'v' ? 'left' : 'top', `${Math.round(v)}px`);
  }
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
    const rawL = Math.min(maxL, Math.max(0, (e.clientX - c.left) / st.k - st.dx));
    const rawT = Math.max(0, (e.clientY - c.top) / st.k - st.dy);
    // Alt maintenu : déplacement libre, sans aimantation
    const snap = e.altKey ? { left: Math.round(rawL), top: Math.round(rawT), gx: null, gy: null } : snapToOthers(section, canvas, rawL, rawT, maxL);
    const { left, top } = snap;
    section.style.left = `${left}px`;
    section.style.top = `${top}px`;
    showGuides(canvas, snap.gx, snap.gy);
    st.cur = { x: maxL ? left / maxL : 0, y: top };
    fitCanvas(canvas);
  });
  const end = () => {
    if (!st) return;
    const cur = st.cur;
    st = null;
    section.classList.remove('moving');
    showGuides(canvas, null, null);
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
  hookRefit();
}

// Redimensionnement de la fenêtre, ouverture / fermeture des Paramètres (marge du bas
// en mode édition), recherche : on recale le plan et on recentre les pavés.
function hookRefit() {
  if (resizeHooked) return;
  resizeHooked = true;
  const refit = () => { const c = document.querySelector('.board-canvas'); if (c) fitCanvas(c); else recenter(); };
  addEventListener('resize', refit);
  new MutationObserver(refit).observe(document.body, { attributes: true, attributeFilter: ['class'] });
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
  return h('div', { class: 'dock-slot', dataset: { cat: cat.id, group: groupId || '', card: card.id } },
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

// ---- Glisser-déposer dans la barre des ronds ----
// Un rond : on le pose sur un autre rond (moitié haute = avant, basse = après), même
// dans une autre barre, ou sur le fond d'une barre (= à la fin de la catégorie).
// Une barre : on l'attrape par son fond et on la pose au-dessus / en dessous d'une autre.
// Un simple clic reste un clic : le déplacement ne démarre qu'après quelques pixels.
let dockHooked = false;
function enableDockDrag(dock) {
  if (dockHooked) return;
  dockHooked = true;
  let st = null;
  const clearMarks = () => dock.querySelectorAll('.drop-before, .drop-after, .drop-into')
    .forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));

  dock.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const slot = e.target.closest('.dock-slot');
    const group = e.target.closest('.dock-group');
    const el = slot || group;
    if (!el) return;
    st = { el, kind: slot ? 'card' : 'bar', x: e.clientX, y: e.clientY, id: e.pointerId, moving: false };
  });

  addEventListener('pointermove', e => {
    if (!st || e.pointerId !== st.id) return;
    if (!st.moving) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) < 6) return;
      st.moving = true;
      const r = st.el.getBoundingClientRect();
      st.dx = st.x - r.left; st.dy = st.y - r.top;
      st.ghost = st.el.cloneNode(true);
      st.ghost.classList.add('dock-ghost');
      st.ghost.querySelectorAll('.dock-card').forEach(x => x.remove());
      st.ghost.style.width = `${r.width}px`;
      document.body.append(st.ghost);
      st.el.classList.add('dock-dragging');
      document.body.classList.add('dock-moving');
    }
    st.ghost.style.left = `${e.clientX - st.dx}px`;
    st.ghost.style.top = `${e.clientY - st.dy}px`;
    clearMarks();
    st.target = null;
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (!under || !dock.contains(under)) return;
    if (st.kind === 'card') {
      const slot = under.closest('.dock-slot');
      if (slot && slot !== st.el) {
        const r = slot.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        slot.classList.add(after ? 'drop-after' : 'drop-before');
        st.target = { slot, after };
      } else if (!slot) {
        const group = under.closest('.dock-group');
        if (group) { group.classList.add('drop-into'); st.target = { group }; }
      }
    } else {
      const group = under.closest('.dock-group');
      if (group && group !== st.el) {
        const r = group.getBoundingClientRect();
        const after = e.clientY > r.top + r.height / 2;
        group.classList.add(after ? 'drop-after' : 'drop-before');
        st.target = { group, after };
      }
    }
  });

  const end = e => {
    if (!st || e.pointerId !== st.id) return;
    const s = st;
    st = null;
    if (!s.moving) return;
    s.ghost.remove();
    s.el.classList.remove('dock-dragging');
    document.body.classList.remove('dock-moving');
    clearMarks();
    // Le clic qui suit le relâchement ne doit pas ouvrir la carte.
    const eat = ev => { ev.preventDefault(); ev.stopPropagation(); };
    addEventListener('click', eat, { capture: true, once: true });
    setTimeout(() => removeEventListener('click', eat, { capture: true }), 0);
    const t = s.target;
    if (!t || e.type === 'pointercancel') return;
    if (s.kind === 'card') {
      const from = { cat: s.el.dataset.cat, group: s.el.dataset.group };
      if (t.slot) {
        actions.placeCard(from, s.el.dataset.card, { cat: t.slot.dataset.cat, group: t.slot.dataset.group }, t.slot.dataset.card, t.after);
      } else {
        actions.placeCard(from, s.el.dataset.card, { cat: t.group.dataset.cat, group: '' }, null, false);
      }
    } else {
      actions.placeDocked(s.el.dataset.cat, t.group.dataset.cat, t.after);
    }
  };
  addEventListener('pointerup', end);
  addEventListener('pointercancel', end);
  // Pas de glisser natif du navigateur (lien / image) qui gênerait le déplacement.
  dock.addEventListener('dragstart', e => e.preventDefault());
}

function renderDock(cfg) {
  const dock = document.getElementById('dock');
  if (!dock) return;
  const cats = cfg.categories.filter(c => c.display === 'dock');
  dock.hidden = cats.length === 0;
  document.body.classList.toggle('has-dock', cats.length > 0);
  // Une barre arrondie par catégorie, séparées par un espace ; ▲ ▼ changent leur ordre.
  enableDockDrag(dock);
  dock.replaceChildren(...cats.map((cat, i) => h('div', { class: 'dock-group', 'aria-label': cat.name, role: 'group', dataset: { cat: cat.id } },
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
  const view = currentView(cfg);
  document.body.classList.toggle('viewing', !!view);
  if (view) {
    root.classList.remove('board-free');
    root.replaceChildren(viewEl(view), h('p', { class: 'search-empty', hidden: true }));
    return;
  }
  // Adresse d'un écran qui n'existe plus (catégorie supprimée…) : retour à la page.
  if (location.hash.startsWith('#c/')) history.replaceState(null, '', pageUrl());
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
  const cols = h('div', { class: 'board-cols' }, columns);
  root.replaceChildren(
    cols,
    h('p', { class: 'search-empty', hidden: true }, 'Aucune carte ne correspond à la recherche.'),
  );
  applySearch(root);
  requestAnimationFrame(recenter);
  const ro = new ResizeObserver(recenter);
  cols.querySelectorAll('.category').forEach(sec => ro.observe(sec));
  hookRefit();
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
