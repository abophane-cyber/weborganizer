// Fenêtres d'édition (catégorie, carte) et champs réutilisables.
import { h, svgIcon } from './util.js';
import { addMediaFile, isMediaRef, mediaInfo } from './media.js';
import { iconEl } from './icons.js';

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

// Champ image : URL web, ou fichier envoyé dans media/ (référence "media:…").
export function imageField(label, value, { accept = 'image/*', help, emoji = false, onChange } = {}) {
  let current = value || '';
  const preview = h('span', { class: 'image-preview' });
  const text = h('input', {
    type: 'text', value: isMediaRef(current) ? '' : current,
    placeholder: emoji ? 'URL d’image ou emoji' : 'https://…',
  });
  const fileName = h('span', { class: 'file-name' });
  const fileInput = h('input', { type: 'file', accept, hidden: true });
  const clearBtn = h('button', { type: 'button', class: 'btn small', onclick: () => set('') }, 'Retirer');

  let ready = false;
  function set(v) {
    const changed = v !== current;
    current = v;
    if (ready && changed && onChange) onChange(v);
    if (!isMediaRef(v)) text.value = v;
    else text.value = '';
    fileName.textContent = isMediaRef(v) ? (mediaInfo(v)?.name || 'Fichier') : '';
    preview.replaceChildren(v ? iconEl(v, '?', 'preview-img') : '');
    clearBtn.hidden = !v;
  }
  text.addEventListener('input', () => set(text.value.trim()));
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (f) set(await addMediaFile(f));
    fileInput.value = '';
  });
  set(current);
  ready = true;

  const el = h('div', { class: 'field' },
    h('span', { class: 'field-label' }, label),
    h('div', { class: 'image-field' },
      preview,
      h('div', { class: 'image-field-inputs' },
        text,
        h('div', { class: 'image-field-row' },
          h('button', { type: 'button', class: 'btn small', onclick: () => fileInput.click() }, 'Choisir un fichier…'),
          fileName, clearBtn, fileInput),
      ),
    ),
    help && h('span', { class: 'field-help' }, help),
  );
  return { el, get value() { return current; } };
}
