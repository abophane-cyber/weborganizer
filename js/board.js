// Affichage des catégories, sous-catégories et cartes.
import { h, svgIcon, safeUrl, gmailInfo } from './util.js';
import { store, columnLayout } from './store.js';
import { iconEl, faviconFor } from './icons.js';
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
  return h('a', {
    class: `card tile link-card${url ? '' : ' link-blocked'}${color ? ' colored' : ''}`, href: url || null,
    style: color ? { '--card-bg': color } : null,
    target: url ? '_blank' : null, rel: 'noopener noreferrer',
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
  return h('div', { class: `group${group.collapsed ? ' collapsed' : ''}` },
    h('div', { class: 'group-head' },
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

// pos : { col, nCols, index, count } — place de la catégorie dans sa colonne.
function categoryEl(cat, pos) {
  // Cartes directes : masquées si vides et qu'il y a des sous-catégories (sauf en mode édition).
  const direct = cardsGrid({ cat, groupId: '', list: cat.cards });
  if (!cat.cards.length && cat.groups.length) direct.classList.add('edit-only-grid');
  const cardCount = cat.cards.length + cat.groups.reduce((n, g) => n + g.cards.length, 0);
  return h('section', { class: `category${cat.collapsed ? ' collapsed' : ''}`, 'aria-label': cat.name, dataset: { id: cat.id } },
    h('header', { class: 'category-head' },
      iconEl(cat.icon, cat.name, 'category-icon'),
      collapseToggle('h2', cat.name, cat.collapsed, cardCount, () => actions.toggleCategory(cat.id)),
      h('div', { class: 'edit-controls' },
        h('span', { class: 'drag-handle', title: 'Glisser pour déplacer la catégorie (dessus, dessous, autre colonne)', 'aria-hidden': 'true' }, svgIcon('grip', 16)),
        pos.col > 0 && editButton('left', 'Colonne de gauche', () => actions.moveCategoryColumn(cat.id, -1)),
        pos.col < pos.nCols - 1 && editButton('right', 'Colonne de droite', () => actions.moveCategoryColumn(cat.id, 1)),
        pos.index > 0 && editButton('up', 'Monter la catégorie', () => actions.moveCategoryInColumn(cat.id, -1)),
        pos.index < pos.count - 1 && editButton('down', 'Descendre la catégorie', () => actions.moveCategoryInColumn(cat.id, 1)),
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
  });
  section.addEventListener('dragend', () => {
    section.draggable = false;
    section.classList.remove('dragging');
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

export function renderBoard(root) {
  const cfg = store.get();
  const { nCols, byColumn } = columnLayout(cfg);
  const columns = byColumn.map((cats, col) => {
    const el = h('div', { class: 'board-col', dataset: { col: String(col) } },
      cats.map((cat, index) => {
        const sec = categoryEl(cat, { col, nCols, index, count: cats.length });
        enableCategoryDrag(sec, cat);
        return sec;
      }),
      h('div', { class: 'col-drop edit-only', 'aria-hidden': 'true' }, 'Déposer ici'),
    );
    enableColumnDrop(el, col);
    return el;
  });
  root.replaceChildren(
    h('div', { class: 'board-cols' }, columns),
    h('button', { type: 'button', class: 'add-category edit-only', onclick: () => actions.addCategory() },
      svgIcon('plus', 18), 'Ajouter une catégorie'),
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
