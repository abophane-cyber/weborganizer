// Actions d'édition : catégories, sous-catégories et cartes.
import { h, uid, safeUrl } from './util.js';
import { store, findCategory, findGroup, findHolder, findCard, PROFILE_COLORS, DEFAULT_PROFILE_COLOR } from './store.js';
import { openModal, field, imageField } from './modal.js';
import { PROFILE_DIR_RE } from './chrome-profiles.js';

function move(list, index, dir) {
  const j = index + dir;
  if (index < 0 || j < 0 || j >= list.length) return;
  [list[index], list[j]] = [list[j], list[index]];
}

const allCardsCount = cat => cat.cards.length + cat.groups.reduce((n, g) => n + g.cards.length, 0);

// ---- Catégories ----

function categoryForm(cat, onSave) {
  const name = h('input', { type: 'text', value: cat.name || '', required: true, maxlength: '60' });
  const icon = imageField('Icône', cat.icon, { emoji: true, help: 'Une URL d’image, un fichier ou un emoji. Vide : initiale du nom.' });
  openModal({
    title: cat.id ? 'Modifier la catégorie' : 'Nouvelle catégorie',
    body: [field('Nom', name), icon.el],
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      onSave({ name: name.value.trim(), icon: icon.value });
    },
  });
}

export function addCategory() {
  categoryForm({ name: '', icon: '' }, v => store.update(c => c.categories.push({ id: uid(), ...v, cards: [], groups: [] })));
}
export function editCategory(id) {
  categoryForm(findCategory(id), v => store.update(() => Object.assign(findCategory(id), v)));
}
export function deleteCategory(id) {
  const cat = findCategory(id);
  const n = allCardsCount(cat);
  const g = cat.groups.length;
  const detail = [g && `${g} sous-catégorie(s)`, n && `${n} carte(s)`].filter(Boolean).join(' et ');
  if (!confirm(`Supprimer la catégorie « ${cat.name} »${detail ? ` avec ${detail}` : ''} ?`)) return;
  store.update(c => { c.categories = c.categories.filter(x => x.id !== id); });
}
export function moveCategory(id, dir) {
  store.update(c => move(c.categories, c.categories.findIndex(x => x.id === id), dir));
}

// ---- Sous-catégories ----

function groupForm(group, onSave) {
  const name = h('input', { type: 'text', value: group.name || '', required: true, maxlength: '60' });
  openModal({
    title: group.id ? 'Modifier la sous-catégorie' : 'Nouvelle sous-catégorie',
    body: [field('Nom', name)],
    onSubmit: () => {
      if (!name.value.trim()) return 'Le nom est obligatoire.';
      onSave({ name: name.value.trim() });
    },
  });
}

export function addGroup(catId) {
  groupForm({}, v => store.update(() => findCategory(catId).groups.push({ id: uid(), ...v, cards: [] })));
}
export function editGroup(catId, groupId) {
  groupForm(findGroup(catId, groupId), v => store.update(() => Object.assign(findGroup(catId, groupId), v)));
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
const EMAIL_RE = /^[^\s@/:?#]+@[^\s@/:?#]+\.[a-z]{2,}$/i;
function gmailUrl(email) {
  return `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email.trim().toLowerCase())}`;
}
function gmailAddressFrom(link) {
  try {
    const u = new URL(link);
    if (u.hostname !== 'mail.google.com') return '';
    const who = u.searchParams.get('authuser') || '';
    return EMAIL_RE.test(who) ? who : '';
  } catch { return ''; }
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

// Liste de tous les emplacements possibles : "catId|" ou "catId|groupId".
function locationSelect(current) {
  const sel = h('select', {});
  for (const cat of store.get().categories) {
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
  const icon = imageField('Icône', card.icon, { help: 'Vide : icône du site (favicon).' });
  const photo = imageField('Photo (dans le cercle)', card.photo, { help: 'Vide : initiale du nom.' });

  const linkFields = h('div', { class: 'field-group' },
    field('Adresse (URL)', url, 'Pour une boîte Gmail, tapez simplement l’adresse e-mail (ex. prenom.nom@gmail.com).'),
    icon.el);
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
        if (EMAIL_RE.test(u)) {
          // Adresse e-mail : lien vers cette boîte Gmail précise.
          onSave({ type: 'link', title: t || u, url: gmailUrl(u), icon: icon.value, badge: badge.value.trim() }, catId, groupId);
          return;
        }
        if (!/^[a-z][a-z0-9+.-]*:/i.test(u)) u = 'https://' + u;
        const safe = safeUrl(u);
        if (!safe) return 'Adresse refusée : seuls les liens http://, https:// et mailto: sont acceptés.';
        onSave({ type: 'link', title: t || new URL(safe).hostname || safe, url: safe, icon: icon.value, badge: badge.value.trim() }, catId, groupId);
      }
    },
  });
}

export function addCard(catId, groupId = '') {
  const holder = findHolder(catId, groupId);
  const profiles = holder.cards.length && holder.cards.every(c => c.type === 'chrome');
  cardForm({ type: profiles ? 'chrome' : 'link' }, `${catId}|${groupId}`,
    (v, toCat, toGroup) => store.update(() => findHolder(toCat, toGroup).cards.push({ id: uid(), ...v })));
}

export function editCard(catId, groupId, cardId) {
  cardForm(findCard(catId, groupId, cardId), `${catId}|${groupId}`, (v, toCat, toGroup) => store.update(() => {
    const from = findHolder(catId, groupId);
    const card = from.cards.find(c => c.id === cardId);
    for (const k of Object.keys(card)) if (k !== 'id') delete card[k];
    Object.assign(card, v);
    if (toCat !== catId || toGroup !== groupId) {
      from.cards = from.cards.filter(c => c.id !== cardId);
      findHolder(toCat, toGroup).cards.push(card);
    }
  }));
}

export function deleteCard(catId, groupId, cardId) {
  const card = findCard(catId, groupId, cardId);
  if (!confirm(`Supprimer la carte « ${card.title} » ?`)) return;
  store.update(() => { const holder = findHolder(catId, groupId); holder.cards = holder.cards.filter(x => x.id !== cardId); });
}

export function moveCard(catId, groupId, cardId, dir) {
  store.update(() => { const holder = findHolder(catId, groupId); move(holder.cards, holder.cards.findIndex(x => x.id === cardId), dir); });
}
