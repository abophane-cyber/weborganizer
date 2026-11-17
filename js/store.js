// État de l'application : la configuration (config.json) et ses abonnés.
import { kvGet, kvSet } from './db.js';
import { uid } from './util.js';

export const PROFILE_COLORS = {
  Abophane: '#34495E',
  Randophane: '#8A6A1F',
  Sillonphane: '#4A5D3A',
  Hypnophane: '#2F5A61',
};
export const DEFAULT_PROFILE_COLOR = '#34495E';
export const GMAIL_ICON = 'https://www.google.com/s2/favicons?domain=mail.google.com&sz=64';
const EPOCH = '1970-01-01T00:00:00.000Z';

export function defaultConfig() {
  const profile = (title, profileDir) => ({
    id: uid(), type: 'chrome', title, profileDir, color: PROFILE_COLORS[title], photo: '', badge: '',
  });
  return {
    schema: 1,
    updatedAt: EPOCH,
    title: 'WebOrganizer',
    description: 'Ma page d’accueil',
    footer: 'Créé par Sillonphane',
    theme: { accent: '#6ea8fe', panelOpacity: 0.55 },
    background: { src: '', kind: 'image', overlay: 0.35 },
    media: {},
    categories: [
      {
        id: uid(), name: 'Profils Chrome', icon: '',
        cards: [
          profile('Abophane', 'Default'),
          profile('Randophane', 'Profile 1'),
          profile('Sillonphane', 'Profile 2'),
          profile('Hypnophane', 'Profile 3'),
        ],
      },
      {
        id: uid(), name: 'GMAIL', icon: GMAIL_ICON,
        cards: [{ id: uid(), type: 'link', title: 'Gmail', url: 'https://mail.google.com/', icon: '' }],
      },
    ],
  };
}

// Complète une config (importée, ancienne, distante) avec les champs manquants.
export function normalize(cfg) {
  const d = defaultConfig();
  const c = { ...d, ...(cfg || {}) };
  c.theme = { ...d.theme, ...(c.theme || {}) };
  c.background = { ...d.background, ...(c.background || {}) };
  c.media = c.media && typeof c.media === 'object' ? c.media : {};
  c.categories = Array.isArray(c.categories) ? c.categories : [];
  for (const cat of c.categories) {
    cat.id ||= uid();
    cat.name ??= 'Catégorie';
    cat.icon ??= '';
    cat.collapsed = !!cat.collapsed;
    cat.groups = Array.isArray(cat.groups) ? cat.groups : [];
    for (const g of cat.groups) {
      g.id ||= uid();
      g.name ??= 'Sous-catégorie';
      g.collapsed = !!g.collapsed;
      g.cards = Array.isArray(g.cards) ? g.cards : [];
    }
  }
  for (const holder of c.categories.flatMap(cat => [cat, ...cat.groups])) {
    holder.cards = Array.isArray(holder.cards) ? holder.cards : [];
    for (const card of holder.cards) {
      card.id ||= uid();
      card.type = card.type === 'chrome' ? 'chrome' : 'link';
      card.title ??= '';
      card.badge ??= '';
      if (card.type === 'chrome') {
        card.profileDir ??= '';
        card.color ||= PROFILE_COLORS[card.title] || DEFAULT_PROFILE_COLOR;
        card.photo ??= '';
      } else {
        card.url ??= '';
        card.icon ??= '';
      }
    }
  }
  c.updatedAt ||= EPOCH;
  return c;
}

let config = null;
const listeners = new Set();

function emit(event) {
  for (const fn of listeners) {
    try { fn(event); } catch (e) { console.error(e); }
  }
}

export const store = {
  get: () => config,

  async load() {
    let saved = null;
    try { saved = await kvGet('config'); } catch (e) { console.warn('IndexedDB indisponible', e); }
    config = normalize(saved || defaultConfig());
    return config;
  },

  async persist() {
    try { await kvSet('config', config); } catch (e) { console.warn('Cache local non enregistré', e); }
  },

  // Modification locale par l'utilisateur. quiet : pas de nouvelle synchro planifiée.
  update(mutator, { quiet = false } = {}) {
    mutator(config);
    config.updatedAt = new Date().toISOString();
    this.persist();
    emit({ type: 'change', local: true, quiet });
  },

  // Remplacement complet (version distante plus récente, import).
  replace(next, { local = false } = {}) {
    config = normalize(next);
    if (local) config.updatedAt = new Date().toISOString();
    this.persist();
    emit({ type: 'change', local, remote: !local });
  },

  refresh() { emit({ type: 'refresh' }); },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
};

export function findCategory(id) { return config.categories.find(c => c.id === id); }
export function findGroup(catId, groupId) { return findCategory(catId)?.groups.find(g => g.id === groupId); }
// Conteneur de cartes : la catégorie elle-même (groupId vide) ou une de ses sous-catégories.
export function findHolder(catId, groupId) { return groupId ? findGroup(catId, groupId) : findCategory(catId); }
export function findCard(catId, groupId, cardId) { return findHolder(catId, groupId)?.cards.find(c => c.id === cardId); }
