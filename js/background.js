// Fond d'écran : image ou vidéo (lecture auto, en boucle, sans le son), plus un voile.
import { store } from './store.js';
import { resolve, mediaInfo, isMediaRef } from './media.js';
import { h } from './util.js';

const VIDEO_EXT = /\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i;
let renderedKey = null;

export function kindFor(src, mime) {
  if (mime) return mime.startsWith('video/') ? 'video' : 'image';
  return VIDEO_EXT.test(src || '') ? 'video' : 'image';
}

export function renderBackground() {
  const bg = store.get().background;
  document.getElementById('bg-overlay').style.opacity = String(bg.overlay ?? 0.35);

  const key = `${bg.kind}|${bg.src}`;
  if (key === renderedKey) return;
  const holder = document.getElementById('bg-media');
  if (!bg.src) { renderedKey = key; holder.replaceChildren(); return; }

  resolve(bg.src).then(url => {
    if (store.get().background.src !== bg.src) return; // changé entre-temps
    if (!url) { holder.replaceChildren(); return; }     // pas encore disponible : réessai au prochain rendu
    renderedKey = key;
    const kind = isMediaRef(bg.src) ? kindFor('', mediaInfo(bg.src)?.mime) : bg.kind || kindFor(bg.src);
    if (kind === 'video') {
      const v = h('video', { class: 'bg-video', autoplay: true, loop: true, muted: true, playsinline: true, preload: 'auto' });
      v.muted = true;            // obligatoire pour la lecture automatique
      v.defaultMuted = true;
      v.setAttribute('muted', '');
      v.src = url;
      holder.replaceChildren(v);
      v.play().catch(() => {});
    } else {
      const div = h('div', { class: 'bg-image' });
      div.style.backgroundImage = `url("${url.replace(/"/g, '%22')}")`;
      holder.replaceChildren(div);
    }
  });
}
