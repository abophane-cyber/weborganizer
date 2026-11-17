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
    logo: '',
    // Décalage (px) du logo et du titre par rapport à leur position centrée.
    layout: { logo: { x: 0, y: 0 }, title: { x: 0, y: 0 } },
    theme: { accent: '#6ea8fe', panelOpacity: 0.55, cardStyle: 'tile', columns: 3, layout: 'columns' },
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
  const pos = p => ({ x: Number(p?.x) || 0, y: Number(p?.y) || 0 });
  c.layout = { logo: pos(c.layout?.logo), title: pos(c.layout?.title) };
  c.media = c.media && typeof c.media === 'object' ? c.media : {};
  c.categories = Array.isArray(c.categories) ? c.categories : [];
  for (const cat of c.categories) {
    cat.id ||= uid();
    cat.name ??= 'Catégorie';
    cat.icon ??= '';
    cat.collapsed = !!cat.collapsed;
    if (cat.display !== 'dock') delete cat.display; // 'dock' : ronds sur le côté gauche
    if (cat.bare) cat.bare = true; else delete cat.bare; // carte seule, sans cadre ni titre
    if (!/^#[0-9A-Fa-f]{6}$/.test(cat.color || '')) delete cat.color;
    if (!Number.isInteger(cat.column) || cat.column < 0) delete cat.column;
    if (cat.pos && Number.isFinite(cat.pos.x) && Number.isFinite(cat.pos.y)) {
      cat.pos = { x: Math.min(1, Math.max(0, cat.pos.x)), y: Math.max(0, Math.round(cat.pos.y)) };
    } else delete cat.pos;
    cat.groups = Array.isArray(cat.groups) ? cat.groups : [];
    for (const g of cat.groups) {
      g.id ||= uid();
      g.name ??= 'Sous-catégorie';
      g.collapsed = !!g.collapsed;
      if (!/^#[0-9A-Fa-f]{6}$/.test(g.color || '')) delete g.color;
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

// Disposition en colonnes : chaque catégorie a une colonne (cat.column) ; l'ordre dans
// une colonne suit l'ordre de la liste. Sans colonne enregistrée : réparties à tour de rôle.
export function columnLayout(cfg) {
  const nCols = Math.min(5, Math.max(1, Number(cfg.theme.columns) || 3));
  const byColumn = Array.from({ length: nCols }, () => []);
  // Les catégories « en ronds » (barre latérale) ne sont pas dans la page.
  cfg.categories.filter(cat => cat.display !== 'dock').forEach((cat, i) => {
    const col = Number.isInteger(cat.column) ? Math.min(cat.column, nCols - 1) : i % nCols;
    byColumn[col].push(cat);
  });
  return { nCols, byColumn };
}

export function findCategory(id) { return config.categories.find(c => c.id === id); }
export function findGroup(catId, groupId) { return findCategory(catId)?.groups.find(g => g.id === groupId); }
// Conteneur de cartes : la catégorie elle-même (groupId vide) ou une de ses sous-catégories.
export function findHolder(catId, groupId) { return groupId ? findGroup(catId, groupId) : findCategory(catId); }
export function findCard(catId, groupId, cardId) { return findHolder(catId, groupId)?.cards.find(c => c.id === cardId); }
