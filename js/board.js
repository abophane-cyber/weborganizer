// Affichage des catégories, sous-catégories et cartes.
import { h, svgIcon, safeUrl, gmailInfo } from './util.js';
import { store } from './store.js';
import { iconEl, imageEl, faviconFor, fallbackIcon } from './icons.js';
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

function linkCard(ctx, card, i) {
  const url = safeUrl(card.url);
  const icon = card.icon || faviconFor(url);
  const color = /^#[0-9a-f]{6}$/i.test(card.color || '') ? card.color : '';
  const gmail = url ? gmailInfo(url) : null;
  if (gmail) return gmailCard(ctx, card, i, url, gmail.email, color);
  return h('a', {
    class: `card link-card${url ? '' : ' link-blocked'}${color ? ' colored' : ''}`, href: url || null,
    style: color ? { '--card-bg': color } : null,
    target: url ? '_blank' : null, rel: 'noopener noreferrer',
    title: url || 'Adresse refusée (seuls les liens http, https et mailto sont autorisés)',
    'aria-disabled': url ? null : 'true',
  },
    iconEl(icon, card.title, 'card-icon'),
    h('span', { class: 'card-title' }, card.title || card.url || 'Sans titre'),
    card.badge && h('span', { class: 'badge' }, card.badge),
    cardControls(ctx, card, i),
  );
}

// Style « aux couleurs de Gmail » : fond clair, liseré rouge (ou couleur choisie), nom + adresse.
function gmailCard(ctx, card, i, url, email, color) {
  const name = card.title || email || 'Gmail';
  return h('a', {
    class: 'card link-card gmail-card', href: url, target: '_blank', rel: 'noopener noreferrer',
    title: email ? `Ouvrir la boîte ${email}` : 'Ouvrir Gmail',
    style: color ? { '--gmail-accent': color } : null,
  },
    iconEl(card.icon || faviconFor(url), name, 'card-icon'),
    h('span', { class: 'card-text' },
      h('span', { class: 'card-title' }, name),
      email && email !== name && h('span', { class: 'card-email' }, email),
    ),
    card.badge && h('span', { class: 'badge' }, card.badge),
    cardControls(ctx, card, i),
  );
}

function chromeCard(ctx, card, i) {
  const valid = PROFILE_DIR_RE.test((card.profileDir || '').trim());
  const avatar = card.photo
    ? h('span', { class: 'avatar' }, imageEl(card.photo, card.title, 'avatar-img'))
    : h('span', { class: 'avatar' }, fallbackIcon(card.title, 'avatar-letter'));
  return h('a', {
    class: 'card chrome-card', href: valid ? profileUrl(card.profileDir) : '#',
    style: { '--card-bg': card.color },
    title: valid ? `Ouvrir Chrome — profil « ${card.profileDir} »` : 'Dossier du profil à renseigner',
    onclick: e => { e.preventDefault(); openChromeProfile(card); },
  },
    avatar,
    h('span', { class: 'card-name' }, card.title || 'Profil'),
    card.badge && h('span', { class: 'badge' }, card.badge),
    cardControls(ctx, card, i),
  );
}

function cardsGrid(ctx) {
  const { list } = ctx;
  const isProfiles = list.length > 0 && list.every(c => c.type === 'chrome');
  return h('div', { class: `cards ${isProfiles ? 'cards-profiles' : ''}` },
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

function categoryEl(cat, ci, total) {
  // Cartes directes : masquées si vides et qu'il y a des sous-catégories (sauf en mode édition).
  const direct = cardsGrid({ cat, groupId: '', list: cat.cards });
  if (!cat.cards.length && cat.groups.length) direct.classList.add('edit-only-grid');
  const cardCount = cat.cards.length + cat.groups.reduce((n, g) => n + g.cards.length, 0);
  return h('section', { class: `category${cat.collapsed ? ' collapsed' : ''}`, 'aria-label': cat.name },
    h('header', { class: 'category-head' },
      iconEl(cat.icon, cat.name, 'category-icon'),
      collapseToggle('h2', cat.name, cat.collapsed, cardCount, () => actions.toggleCategory(cat.id)),
      h('div', { class: 'edit-controls' },
        ci > 0 && editButton('up', 'Monter la catégorie', () => actions.moveCategory(cat.id, -1)),
        ci < total - 1 && editButton('down', 'Descendre la catégorie', () => actions.moveCategory(cat.id, 1)),
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

export function renderBoard(root) {
  const cfg = store.get();
  root.replaceChildren(
    ...cfg.categories.map((cat, i) => categoryEl(cat, i, cfg.categories.length)),
    h('button', { type: 'button', class: 'add-category edit-only', onclick: () => actions.addCategory() },
      svgIcon('plus', 18), 'Ajouter une catégorie'),
  );
}
