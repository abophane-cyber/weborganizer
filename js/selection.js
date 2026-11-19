// Élément choisi en mode édition (catégorie, sous-catégorie ou carte) : le panneau
// des Paramètres affiche alors les outils qui le concernent.
// sel : { kind: 'category' | 'group' | 'card', catId, groupId?, cardId? } ou null.
let sel = null;
let view = null;       // écran ouvert : { catId, groupId } ou null
let viewKey = '';
const subs = new Set();

const emit = () => subs.forEach(fn => fn());

export const get = () => sel;
export function set(next) { sel = next; emit(); }
export const clear = () => set(null);
export function onChange(fn) { subs.add(fn); }

// Appelé après chaque affichage de la page : changer d'écran oublie la sélection.
export function setView(v) {
  const key = v ? `${v.catId}/${v.groupId || ''}` : '';
  if (key !== viewKey) { viewKey = key; sel = null; }
  view = v;
  emit();
}

// Sans choix explicite, l'écran ouvert (catégorie ou sous-catégorie) sert de sélection.
export function effective() {
  if (sel) return sel;
  if (!view) return null;
  return view.groupId ? { kind: 'group', catId: view.catId, groupId: view.groupId } : { kind: 'category', catId: view.catId };
}

export const same = (a, b) => !!a && !!b && a.kind === b.kind && a.catId === b.catId
  && (a.groupId || '') === (b.groupId || '') && (a.cardId || '') === (b.cardId || '');
