// Actions d'édition : catégories, sous-catégories et cartes.
import { h, uid, safeUrl, gmailInfo, EMAIL_RE } from './util.js';
import { store, findCategory, findGroup, findHolder, findCard, columnLayout, PROFILE_COLORS, DEFAULT_PROFILE_COLOR } from './store.js';
import { openModal, field, imageField } from './modal.js';
import { PROFILE_DIR_RE } from './chrome-profiles.js';

function move(list, index, dir) {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
}

const allCardsCount = cat => cat.cards.length + cat.groups.reduce((n, g) => n + g.cards.length, 0);

// ---- Catégories ----

// Case « Couleur personnalisée » + palette / code (catégories et sous-catégories).
function optionalColorField(current, help) {
  const input = colorInput(current || '#2F5A61');
  const use = h('input', { type: 'checkbox', checked: !!current });
  const el = h('div', { class: 'field' },
    h('label', { class: 'check-row' }, use, h('span', { class: 'field-label' }, 'Couleur personnalisée')),
    input.el,
    h('span', { class: 'field-help' }, help));
  const sync = () => { input.el.hidden = !use.checked; };
  use.addEventListener('change', sync);
  sync();
  return {
    el,
    get error() { return use.checked && !input.valid ? 'Code couleur invalide : utilisez le format #RRGGBB (ex. #6B3A4A).' : ''; },
    get value() { return use.checked ? input.value : ''; },
  };
}

// Enregistre ou retire la couleur (champ absent si vide).
function applyColor(obj, color) {
  if (color) obj.color = color; else delete obj.color;
}

function categoryForm(cat, onSave) {
  const name = h('input', { type: 'text', value: cat.name || '', required: true, maxlength: '60' });
  const icon = imageField('Icône', cat.icon, { emoji: true, icons: true, help: 'Une icône de la bibliothèque, une URL d’image, un fichier ou un emoji. Vide : initiale du nom.' });
  const dock = h('input', { type: 'checkbox', checked: cat.display === 'dock' });
  const dockRow = h('div', { class: 'field' },
    h('label', { class: 'check-row' }, dock, h('span', { class: 'field-label' }, 'Afficher en ronds sur le côté gauche')),
    h('span', { class: 'field-help' },
      'Les cartes deviennent des ronds dans une barre fixée au bord gauche ; le survol affiche leur fiche. '
      + 'Pour les modifier : Paramètres ouverts, cliquez sur un rond (corbeille pour supprimer, + pour ajouter).'));
  const color = optionalColorField(cat.color, 'Teinte le cadre de la catégorie et sa bande de gauche. Décoché : fond neutre.');
  openModal({
    title: cat.id ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    body: [field('Nom', name), icon.el, color.el, dockRow],
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (color.error) return color.error;
      onSave({ name: name.value.trim(), icon: icon.value, display: dock.checked ? 'dock' : undefined, color: color.value });
    },
  });
}

export function addCategory() {
  categoryForm({ name: '', icon: '' }, v => store.update(c => {
    const cat = { id: uid(), ...v, cards: [], groups: [] };
    if (!cat.display) delete cat.display;
    applyColor(cat, v.color);
    // En disposition libre : visible tout de suite, en haut au centre.
    if (c.theme.layout === 'free') cat.pos = { x: 0.5, y: 0 };
    c.categories.push(cat);
  }));
}
export function editCategory(id) {
  categoryForm(findCategory(id), v => store.update(() => {
    const cat = Object.assign(findCategory(id), v);
    if (!cat.display) delete cat.display;
    applyColor(cat, v.color);
  }));
}
export function deleteCategory(id) {
  const cat = findCategory(id);
  const n = allCardsCount(cat);
  const g = cat.groups.length;
  const detail = [g && `${g} sous-catégorie(s)`, n && `${n} carte(s)`].filter(Boolean).join(' et ');
  if (!confirm(`Supprimer la catégorie « ${cat.name} »${detail ? ` avec ${detail}` : ''} ?`)) return;
  store.update(c => { c.categories = c.categories.filter(x => x.id !== id); });
}
export function toggleCategory(id) {
  store.update(() => { const cat = findCategory(id); cat.collapsed = !cat.collapsed; });
}
export function toggleGroup(catId, groupId) {
  store.update(() => { const g = findGroup(catId, groupId); g.collapsed = !g.collapsed; });
}
// ---- Barre « en ronds » : ordre des catégories (dans la liste générale) ----
export function moveDocked(id, dir) {
  store.update(c => {
    const docked = c.categories.map((cat, i) => ({ cat, i })).filter(x => x.cat.display === 'dock');
    const k = docked.findIndex(x => x.cat.id === id);
    const other = docked[k + dir];
    if (k < 0 || !other) return;
    const a = docked[k].i, b = other.i;
    [c.categories[a], c.categories[b]] = [c.categories[b], c.categories[a]];
  });
}

// ---- Disposition libre ----
export function setCategoryPosition(id, pos) {
  store.update(() => { const cat = findCategory(id); if (cat) cat.pos = { x: pos.x, y: pos.y }; });
}

// ---- Disposition en colonnes ----

// Fige la colonne actuelle de chaque catégorie, puis réécrit la liste colonne par colonne
// (l'ordre dans une colonne = l'ordre de la liste).
function withColumns(c, mutate) {
  const { byColumn } = columnLayout(c);
  byColumn.forEach((cats, col) => cats.forEach(cat => { cat.column = col; }));
  mutate(byColumn);
  const docked = c.categories.filter(cat => cat.display === 'dock');
  c.categories = [...byColumn.flatMap((cats, col) => cats.map(cat => Object.assign(cat, { column: col }))), ...docked];
}

// Place `id` dans la colonne `col`, au-dessus (ou en dessous si `after`) de `targetId`,
// ou à la fin de la colonne si `targetId` est vide.
export function placeCategory(id, col, targetId, after) {
  if (id === targetId) return;
  store.update(c => withColumns(c, cols => {
    let moved = null;
    for (const list of cols) {
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) [moved] = list.splice(i, 1);
    }
    if (!moved) return;
    const dest = cols[Math.min(Math.max(col, 0), cols.length - 1)];
    const t = targetId ? dest.findIndex(x => x.id === targetId) : -1;
    dest.splice(t < 0 ? dest.length : t + (after ? 1 : 0), 0, moved);
  }));
}
export function moveCategoryColumn(id, dir) {
  store.update(c => withColumns(c, cols => {
    const from = cols.findIndex(list => list.some(x => x.id === id));
    const to = from + dir;
    if (from < 0 || to < 0 || to >= cols.length) return;
    const i = cols[from].findIndex(x => x.id === id);
    const [moved] = cols[from].splice(i, 1);
    cols[to].splice(Math.min(i, cols[to].length), 0, moved);
  }));
}
export function moveCategoryInColumn(id, dir) {
  store.update(c => withColumns(c, cols => {
    for (const list of cols) {
      const i = list.findIndex(x => x.id === id);
      if (i >= 0) { move(list, i, dir); return; }
    }
  }));
}

// Glisser-déposer : place la catégorie `id` avant ou après `targetId`.
export function reorderCategory(id, targetId, after) {
  if (id === targetId) return;
  store.update(c => {
    const from = c.categories.findIndex(x => x.id === id);
    if (from < 0) return;
    const [cat] = c.categories.splice(from, 1);
    const to = c.categories.findIndex(x => x.id === targetId);
    c.categories.splice(to < 0 ? c.categories.length : to + (after ? 1 : 0), 0, cat);
  });
}
export function moveCategory(id, dir) {
  store.update(c => move(c.categories, c.categories.findIndex(x => x.id === id), dir));
}

// ---- Sous-catégories ----

function groupForm(group, onSave) {
  const name = h('input', { type: 'text', value: group.name || '', required: true, maxlength: '60' });
  const color = optionalColorField(group.color, 'Teinte l’encadré de la sous-catégorie. Décoché : neutre.');
  openModal({
    title: group.id ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie',
    body: [field('Nom', name), color.el],
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      if (color.error) return color.error;
      onSave({ name: name.value.trim(), color: color.value });
    },
  });
}

export function addGroup(catId) {
  groupForm({}, v => store.update(() => {
    const g = { id: uid(), name: v.name, cards: [] };
    applyColor(g, v.color);
    findCategory(catId).groups.push(g);
  }));
}
export function editGroup(catId, groupId) {
  groupForm(findGroup(catId, groupId), v => store.update(() => {
    const g = findGroup(catId, groupId);
    g.name = v.name;
    applyColor(g, v.color);
  }));
}
export function deleteGroup(catId, groupId) {
  const g = findGroup(catId, groupId);
  if (g.cards.length) {
    const choice = prompt(
      `La sous-catégorie « ${g.name} » contient ${g.cards.length} carte(s).\n\n`
      + 'Tapez 1 pour déplacer ses cartes dans la catégorie, 2 pour les supprimer aussi.', '1');
    if (choice !== '1' && choice !== '2') return;
    store.update(() => {
      const cat = findCategory(catId);
      if (choice === '1') cat.cards.push(...g.cards);
      cat.groups = cat.groups.filter(x => x.id !== groupId);
    });
    return;
  }
  if (!confirm(`Supprimer la sous-catégorie « ${g.name} » ?`)) return;
  store.update(() => { const cat = findCategory(catId); cat.groups = cat.groups.filter(x => x.id !== groupId); });
}
export function moveGroup(catId, groupId, dir) {
  store.update(() => { const cat = findCategory(catId); move(cat.groups, cat.groups.findIndex(x => x.id === groupId), dir); });
}

// ---- Cartes ----

// Boîtes Gmail : "adresse@gmail.com" -> lien qui ouvre ce compte précis.
function gmailUrl(email) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email.trim().toLowerCase())}`;
}
const gmailAddressFrom = link => gmailInfo(link)?.email || '';
// Adresse du site saisie dans le champ « Adresse » (e-mail -> Gmail), pour la favicône.
function siteFor(value) {
  const v = (value || '').trim();
  if (!v) return '';
  if (EMAIL_RE.test(v)) return 'https://mail.google.com/';
  return safeUrl(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : 'https://' + v);
}

// Couleur : palette + code hexadécimal saisi au clavier, synchronisés.
const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
function normalizeHex(v) {
  const m = v.trim().match(HEX_RE);
  if (!m) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  return '#' + hex.toUpperCase();
}
function colorInput(initial) {
  const start = normalizeHex(initial) || DEFAULT_PROFILE_COLOR;
  const picker = h('input', { type: 'color', value: start.toLowerCase(), 'aria-label': 'Palette de couleurs' });
  const text = h('input', {
    type: 'text', value: start, maxlength: '7', spellcheck: 'false', class: 'hex-input',
    'aria-label': 'Code couleur hexadécimal', placeholder: '#6B3A4A',
  });
  picker.addEventListener('input', () => { text.value = picker.value.toUpperCase(); text.classList.remove('invalid'); });
  text.addEventListener('input', () => {
    const hex = normalizeHex(text.value);
    text.classList.toggle('invalid', !hex);
    if (hex) picker.value = hex.toLowerCase();
  });
  text.addEventListener('blur', () => { const hex = normalizeHex(text.value); if (hex) text.value = hex; });
  return {
    el: h('div', { class: 'color-field' }, picker, text),
    get value() { return normalizeHex(text.value) || picker.value.toUpperCase(); },
    get valid() { return !!normalizeHex(text.value); },
    set value(v) { const hex = normalizeHex(v); if (hex) { picker.value = hex.toLowerCase(); text.value = hex; text.classList.remove('invalid'); } },
  };
}

// Liste de tous les emplacements possibles : "catId|", "catId|groupId",
// ou « Carte seule » (NEW_BARE, ou la carte seule actuelle).
const NEW_BARE = '__carte_seule__';
function locationSelect(current) {
  const sel = h('select', {});
  const currentCat = store.get().categories.find(c => current === `${c.id}|`);
  sel.append(currentCat?.bare
    ? h('option', { value: current, selected: true }, 'Carte seule (hors catégorie)')
    : h('option', { value: `${NEW_BARE}|`, selected: current === `${NEW_BARE}|` }, 'Carte seule (hors catégorie)'));
  for (const cat of store.get().categories) {
    if (cat.bare) continue;
    sel.append(h('option', { value: `${cat.id}|`, selected: current === `${cat.id}|` }, cat.name));
    for (const g of cat.groups) {
      sel.append(h('option', { value: `${cat.id}|${g.id}`, selected: current === `${cat.id}|${g.id}` }, `   ${cat.name} › ${g.name}`));
    }
  }
  return sel;
}

function cardForm(card, location, onSave) {
  const type = h('select', {},
    h('option', { value: 'link', selected: card.type !== 'chrome' }, 'Lien web'),
    h('option', { value: 'chrome', selected: card.type === 'chrome' }, 'Profil Chrome'),
  );
  const where = locationSelect(location);
  const title = h('input', { type: 'text', value: card.title || '', maxlength: '60' });
  const url = h('input', { type: 'text', inputmode: 'url', value: card.url || '', placeholder: 'https://… ou adresse e-mail' });
  const profileDir = h('input', {
    type: 'text', value: card.profileDir || '', placeholder: 'Default, Profile 1…', maxlength: '64',
  });
  const color = colorInput(card.color || PROFILE_COLORS[card.title] || DEFAULT_PROFILE_COLOR);
  const badge = h('input', { type: 'text', value: card.badge || '', maxlength: '20', placeholder: 'ex. Tester' });
  const icon = imageField('Icône (dans le cercle)', card.icon, {
    icons: true, favicon: () => siteFor(url.value),
    help: 'Vide : favicône du site, automatiquement.',
  });
  const photo = imageField('Photo ou icône (dans le cercle)', card.photo, { icons: true, help: 'Vide : initiale du nom.' });

  // Couleur facultative des cartes de lien (case à cocher + palette/code).
  const linkColor = colorInput(card.type !== 'chrome' && card.color ? card.color : '#3A4A6B');
  const useLinkColor = h('input', { type: 'checkbox', checked: card.type !== 'chrome' && !!card.color });
  const linkColorRow = h('div', { class: 'field' },
    h('label', { class: 'check-row' }, useLinkColor, h('span', { class: 'field-label' }, 'Couleur personnalisée')),
    linkColor.el,
    h('span', { class: 'field-help' }, 'Fond coloré et texte blanc. Décoché : fond neutre transparent.'));
  const syncLinkColor = () => { linkColor.el.hidden = !useLinkColor.checked; };
  useLinkColor.addEventListener('change', syncLinkColor);
  syncLinkColor();

  // Ouvrir le lien dans un profil Chrome précis (ex. la boîte Gmail de ce profil).
  const profiles = [];
  for (const cat of store.get().categories) {
    for (const p of [...cat.cards, ...cat.groups.flatMap(g => g.cards)]) {
      if (p.type === 'chrome' && PROFILE_DIR_RE.test(p.profileDir || '') && !profiles.some(x => x.dir === p.profileDir)) {
        profiles.push({ dir: p.profileDir, name: p.title });
      }
    }
  }
  const openIn = h('select', {},
    h('option', { value: '' }, 'Non : dans l’onglet actuel'),
    profiles.map(p => h('option', { value: p.dir, selected: card.openIn === p.dir }, `${p.name} (${p.dir})`)),
    card.openIn && !profiles.some(p => p.dir === card.openIn) && h('option', { value: card.openIn, selected: true }, card.openIn),
  );

  const linkFields = h('div', { class: 'field-group' },
    field('Adresse (URL)', url, 'Pour une boîte Gmail, tapez simplement l’adresse e-mail (ex. prenom.nom@gmail.com).'),
    field('Ouvrir dans le profil Chrome', openIn,
      'Pour Gmail : choisissez le profil où ce compte est connecté, la boîte s’y ouvrira directement. '
      + 'Nécessite le protocole chromeprofile:// installé (version avec adresse).'),
    icon.el, linkColorRow);
  // Si c'est un lien Gmail déjà construit, on réaffiche l'adresse e-mail pour la modification.
  const existingEmail = gmailAddressFrom(card.url);
  if (existingEmail) url.value = existingEmail;
  const chromeFields = h('div', { class: 'field-group' },
    field('Dossier du profil', profileDir,
      'Dans Chrome, ouvrez chrome://version : à la ligne « Chemin d’accès au profil », reprenez le dernier dossier (Default, Profile 1…).'),
    field('Couleur de fond', color.el, 'Choisissez dans la palette ou tapez un code, ex. #6B3A4A.'),
    photo.el,
  );
  const sync = () => {
    const chrome = type.value === 'chrome';
    linkFields.hidden = chrome;
    chromeFields.hidden = !chrome;
  };
  type.addEventListener('change', sync);
  title.addEventListener('input', () => {
    const preset = PROFILE_COLORS[title.value.trim()];
    if (preset && type.value === 'chrome') color.value = preset;
  });
  sync();

  openModal({
    title: card.id ? 'Modifier la carte' : 'Nouvelle carte',
    body: [field('Type', type), field('Nom', title), linkFields, chromeFields,
      field('Badge (facultatif)', badge), field('Emplacement', where)],
    onSubmit: () => {
      const t = title.value.trim();
      const [catId, groupId] = where.value.split('|');
      if (type.value === 'chrome') {
        const dir = profileDir.value.trim();
        if (!t) return 'Le nom est obligatoire.';
        if (!PROFILE_DIR_RE.test(dir)) return 'Dossier du profil : lettres, chiffres et espaces uniquement (ex. Profile 1).';
        if (!color.valid) return 'Code couleur invalide : utilisez le format #RRGGBB (ex. #6B3A4A).';
        onSave({ type: 'chrome', title: t, profileDir: dir, color: color.value, photo: photo.value, badge: badge.value.trim() }, catId, groupId);
      } else {
        let u = url.value.trim();
        if (!u) return 'L’adresse est obligatoire.';
        if (useLinkColor.checked && !linkColor.valid) return 'Code couleur invalide : utilisez le format #RRGGBB (ex. #6B3A4A).';
        const extra = {
          icon: icon.value, badge: badge.value.trim(),
          ...(useLinkColor.checked ? { color: linkColor.value } : {}),
          ...(openIn.value ? { openIn: openIn.value } : {}),
        };
        if (EMAIL_RE.test(u)) {
          // Adresse e-mail : lien vers cette boîte Gmail précise.
          onSave({ type: 'link', title: t || u, url: gmailUrl(u), ...extra }, catId, groupId);
          return;
        }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
        const safe = safeUrl(u);
        if (!safe) return 'Adresse refusée : seuls les liens http://, https:// et mailto: sont acceptés.';
        onSave({ type: 'link', title: t || new URL(safe).hostname || safe, url: safe, ...extra }, catId, groupId);
      }
    },
  });
}

// Place une carte dans son emplacement ; NEW_BARE crée une carte seule.
function putCard(c, card, toCat, toGroup) {
  if (toCat === NEW_BARE) {
    const bare = { id: uid(), name: '', icon: '', bare: true, cards: [card], groups: [] };
    // En disposition libre : visible tout de suite, en haut au centre.
    if (c.theme.layout === 'free') bare.pos = { x: 0.5, y: 0 };
    c.categories.push(bare);
  } else {
    findHolder(toCat, toGroup).cards.push(card);
  }
}
// Une carte seule vidée de sa carte disparaît.
function dropEmptyBare(c) {
  c.categories = c.categories.filter(cat => !(cat.bare && cat.cards.length === 0));
}

export function addCard(catId, groupId = '') {
  const holder = findHolder(catId, groupId);
  const profiles = holder.cards.length && holder.cards.every(c => c.type === 'chrome');
  cardForm({ type: profiles ? 'chrome' : 'link' }, `${catId}|${groupId}`,
    (v, toCat, toGroup) => store.update(c => putCard(c, { id: uid(), ...v }, toCat, toGroup)));
}

export function addStandaloneCard() {
  cardForm({ type: 'link' }, `${NEW_BARE}|`,
    (v, toCat, toGroup) => store.update(c => putCard(c, { id: uid(), ...v }, toCat, toGroup)));
}

export function editCard(catId, groupId, cardId) {
  cardForm(findCard(catId, groupId, cardId), `${catId}|${groupId}`, (v, toCat, toGroup) => store.update(() => {
    const from = findHolder(catId, groupId);
    const card = from.cards.find(c => c.id === cardId);
    for (const k of Object.keys(card)) if (k !== 'id') delete card[k];
    Object.assign(card, v);
    if (toCat !== catId || toGroup !== groupId) {
      from.cards = from.cards.filter(c => c.id !== cardId);
      putCard(store.get(), card, toCat, toGroup);
      dropEmptyBare(store.get());
    }
  }));
}

export function deleteCard(catId, groupId, cardId) {
  const card = findCard(catId, groupId, cardId);
  if (!confirm(`Supprimer la carte « ${card.title} » ?`)) return;
  store.update(c => {
    const holder = findHolder(catId, groupId);
    holder.cards = holder.cards.filter(x => x.id !== cardId);
    dropEmptyBare(c);
  });
}

export function moveCard(catId, groupId, cardId, dir) {
  store.update(() => { const holder = findHolder(catId, groupId); move(holder.cards, holder.cards.findIndex(x => x.id === cardId), dir); });
}
