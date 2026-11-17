// Fenêtres d'édition (catégorie, carte) et champs réutilisables.
import { h, svgIcon } from './util.js';
import { addMediaFile, isMediaRef, mediaInfo } from './media.js';
import { iconEl, faviconCandidates } from './icons.js';
import { ICONS, glyph, isIconRef } from './icon-library.js';

export function openModal({ title, body, submitLabel = 'Enregistrer', onSubmit }) {
  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const form = h('form', { class: 'modal-form', novalidate: true },
    h('header', { class: 'modal-head' },
      h('h2', {}, title),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Fermer', onclick: () => dlg.close() }, svgIcon('close')),
    ),
    h('div', { class: 'modal-body' }, body),
    errorBox,
    h('footer', { class: 'modal-actions' },
      h('button', { type: 'button', class: 'btn', onclick: () => dlg.close() }, 'Annuler'),
      h('button', { type: 'submit', class: 'btn primary' }, submitLabel),
    ),
  );
  const dlg = h('dialog', { class: 'modal' }, form);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = await onSubmit();
    if (err) { errorBox.textContent = err; errorBox.hidden = false; return; }
    dlg.close();
  });
  dlg.addEventListener('close', () => dlg.remove());
  document.body.append(dlg);
  dlg.showModal();
  dlg.querySelector('input:not([type=hidden]), select')?.focus();
  return dlg;
}

export function field(label, input, help) {
  return h('label', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    input,
    help && h('span', { class: 'field-help' }, help),
  );
}

// Champ image : URL web, fichier envoyé dans media/ ("media:…"), icône de la
// bibliothèque ("icon:…") ou favicône d'un site.
//   icons   : affiche le bouton « Icônes… » (grille de la bibliothèque)
//   favicon : fonction qui renvoie l'adresse du site, pour « Attraper la favicône »
export function imageField(label, value, { accept = 'image/*', help, emoji = false, onChange, icons = false, favicon = null } = {}) {
  let current = value || '';
  const preview = h('span', { class: 'image-preview' });
  const text = h('input', {
    type: 'text', value: '',
    placeholder: emoji ? 'URL d\u2019image ou emoji' : 'https://…',
  });
  const fileName = h('span', { class: 'file-name' });
  const fileInput = h('input', { type: 'file', accept, hidden: true });
  const clearBtn = h('button', { type: 'button', class: 'btn small', onclick: () => set('') }, 'Retirer');
  const panel = h('div', { class: 'picker-panel', hidden: true });

  let ready = false;
  function set(v, { fromText = false } = {}) {
    const changed = v !== current;
    current = v;
    if (ready && changed && onChange) onChange(v);
    const special = isMediaRef(v) || isIconRef(v);
    if (!fromText) text.value = special ? '' : v;
    fileName.textContent = isMediaRef(v) ? (mediaInfo(v)?.name || 'Fichier')
      : isIconRef(v) ? `Icône : ${ICONS[v.slice(5)]?.[0] || v.slice(5)}` : '';
    preview.replaceChildren(v ? iconEl(v, '?', 'preview-img') : '');
    clearBtn.hidden = !v;
  }
  text.addEventListener('input', () => set(text.value.trim(), { fromText: true }));
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (f) set(await addMediaFile(f));
    fileInput.value = '';
  });

  // Grille des icônes de la bibliothèque, avec filtre.
  function showIcons() {
    const filter = h('input', { type: 'text', placeholder: 'Filtrer (ex. banque, mail, cuisine)…', class: 'picker-filter' });
    const grid = h('div', { class: 'icon-grid', role: 'listbox', 'aria-label': 'Icônes' });
    const fill = () => {
      const q = filter.value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      grid.replaceChildren(...Object.entries(ICONS)
        .filter(([name, [lbl]]) => !q || `${name} ${lbl}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(q))
        .map(([name, [lbl]]) => h('button', {
          type: 'button', class: `icon-choice${current === 'icon:' + name ? ' selected' : ''}`, title: lbl, 'aria-label': lbl,
          onclick: () => { set('icon:' + name); panel.hidden = true; },
        }, glyph(name, 20))));
    };
    filter.addEventListener('input', fill);
    filter.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    fill();
    panel.replaceChildren(filter, grid);
    panel.hidden = false;
    filter.focus();
  }

  // Versions de la favicône du site : l'utilisateur choisit celle qui lui plaît.
  function showFavicons() {
    const site = favicon?.();
    const list = faviconCandidates(site);
    if (!list.length) {
      panel.replaceChildren(h('p', { class: 'field-help' }, 'Saisissez d\u2019abord l\u2019adresse du site (ou l\u2019adresse e-mail).'));
      panel.hidden = false;
      return;
    }
    const grid = h('div', { class: 'favicon-grid' });
    let alive = list.length;
    const none = h('p', { class: 'field-help', hidden: true }, 'Aucune icône trouvée pour ce site.');
    for (const cand of list) {
      const img = h('img', { alt: '', referrerpolicy: 'no-referrer', src: cand.url });
      const btn = h('button', {
        type: 'button', class: `favicon-choice${current === cand.url ? ' selected' : ''}`, title: cand.label,
        onclick: () => { set(cand.url); panel.hidden = true; },
      }, img, h('span', {}, cand.label));
      img.addEventListener('error', () => { btn.remove(); if (--alive === 0) none.hidden = false; });
      // Certaines sources renvoient une icône générique minuscule : on l'ignore.
      img.addEventListener('load', () => { if (img.naturalWidth < 8) { btn.remove(); if (--alive === 0) none.hidden = false; } });
      grid.append(btn);
    }
    panel.replaceChildren(h('p', { class: 'field-help' }, 'Choisissez une version :'), grid, none);
    panel.hidden = false;
  }

  set(current);
  ready = true;

  const el = h('div', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h('div', { class: 'image-field' },
      preview,
      h('div', { class: 'image-field-inputs' },
        text,
        h('div', { class: 'image-field-row' },
          icons && h('button', { type: 'button', class: 'btn small', onclick: () => (panel.hidden ? showIcons() : (panel.hidden = true)) }, 'Icônes…'),
          favicon && h('button', { type: 'button', class: 'btn small', onclick: showFavicons }, 'Attraper la favicône'),
          h('button', { type: 'button', class: 'btn small', onclick: () => fileInput.click() }, 'Fichier…'),
          fileName, clearBtn, fileInput),
      ),
    ),
    panel,
    help && h('span', { class: 'field-help' }, help),
  );
  return {
    el,
    get value() { return current; },
    set value(v) { set(v || ''); },
  };
}
