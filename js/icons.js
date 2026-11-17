// Affichage d'icônes / images avec icône de secours si le chargement échoue.
import { h } from './util.js';
import { resolve, isMediaRef } from './media.js';
import { glyph, isIconRef } from './icon-library.js';

const looksLikeImage = s => /^(https?:|data:image|blob:|media:|\.{0,2}\/)/i.test(s);

export function fallbackIcon(label, cls) {
  const letter = (label || '').trim().charAt(0).toUpperCase() || '•';
  return h('span', { class: `${cls} icon-fallback`, 'aria-hidden': 'true' }, letter);
}

// src : URL, référence media:…, icône de la bibliothèque (icon:…), emoji/texte court, ou vide.
export function iconEl(src, label, cls = 'icon') {
  if (!src) return fallbackIcon(label, cls);
  if (isIconRef(src)) {
    const svg = glyph(src.slice(5), 18);
    return svg ? h('span', { class: `${cls} icon-glyph`, 'aria-hidden': 'true' }, svg) : fallbackIcon(label, cls);
  }
  if (!looksLikeImage(src)) return h('span', { class: `${cls} icon-emoji`, 'aria-hidden': 'true' }, src);
  return imageEl(src, label, cls);
}

// Image toujours remplacée par une icône de secours en cas d'échec (jamais le texte "alt").
export function imageEl(src, label, cls) {
  const img = h('img', { class: cls, alt: '', decoding: 'async', referrerpolicy: 'no-referrer' });
  const fail = () => { if (img.isConnected || img.parentNode) img.replaceWith(fallbackIcon(label, cls)); };
  img.addEventListener('error', fail, { once: true });
  if (isMediaRef(src)) {
    resolve(src).then(u => (u ? (img.src = u) : fail())).catch(fail);
  } else {
    img.src = src;
  }
  return img;
}

// Différentes sources de favicône pour un site (l'utilisateur choisit).
export function faviconCandidates(siteUrl) {
  let host;
  try { host = new URL(siteUrl).hostname; } catch { return []; }
  if (!host) return [];
  const e = encodeURIComponent(host);
  return [
    { label: 'Haute définition', url: `https://www.google.com/s2/favicons?domain=${e}&sz=128` },
    { label: 'Standard', url: `https://www.google.com/s2/favicons?domain=${e}&sz=64` },
    { label: 'Icône du site', url: `https://${host}/apple-touch-icon.png` },
    { label: 'favicon.ico', url: `https://${host}/favicon.ico` },
    { label: 'DuckDuckGo', url: `https://icons.duckduckgo.com/ip3/${e}.ico` },
  ];
}

export function faviconFor(url) {
  try {
    const host = new URL(url).hostname;
    return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64` : '';
  } catch { return ''; }
}
