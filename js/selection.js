// Élément choisi en mode édition (catégorie, sous-catégorie ou carte) : le panneau
// des Paramètres affiche alors les outils qui le concernent.
// sel : { kind: 'category' | 'group' | 'card', catId, groupId?, cardId? } ou null.
let sel = null;
let view = null;       // écran ouvert : { catId, groupId } ou null
let viewKey = '';
const subs = new Set();

// Historique des écrans d'édition (écran ouvert + élément choisi), pour la flèche
// « retour » des Paramètres. Pendant un retour, rien n'est ajouté à l'historique.
const past = [];
let current = null;
let restoring = false;
const sameState = (a, b) => !!a && !!b && (a.view ? `${a.view.catId}/${a.view.groupId || ''}` : '')
  === (b.view ? `${b.view.catId}/${b.view.groupId || ''}` : '')
  && (a.sel ? same(a.sel, b.sel) : !b.sel);
function record() {
  if (restoring) return;
  const state = { view, sel };
  if (sameState(state, current)) return;
  if (current) past.push(current);
  if (past.length > 50) past.shift();
  current = state;
}
const emit = () => { record(); subs.forEach(fn => fn()); };

export const canGoBack = () => past.length > 0;
// Revient à l'écran précédent : navigate(view) affiche l'écran demandé (ou l'accueil).
export function goBack(navigate) {
  const prev = past.pop();
  if (!prev) return;
  restoring = true;
  try {
    const key = prev.view ? `${prev.view.catId}/${prev.view.groupId || ''}` : '';
    if (key !== viewKey) navigate(prev.view);
    sel = prev.sel;
    current = prev;
  } finally { restoring = false; }
  subs.forEach(fn => fn());
}

export const get = () => sel;
export const getView = () => view;
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
