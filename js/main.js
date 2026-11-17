// Point d'entrée.
import { store } from './store.js';
import * as cloud from './folder.js';
import * as sync from './sync.js';
import { renderBoard } from './board.js';
import { renderBackground } from './background.js';
import { initSettings, toggle as toggleSettings } from './settings.js';
import { h, toast } from './util.js';
import { imageEl } from './icons.js';
import { initSearch } from './board.js';
import { initWeather } from './weather.js';

let renderedLogo = null;
function renderLogo(src) {
  const box = document.getElementById('logo');
  // Réessaie si l'image n'était pas encore disponible (média en cours de téléchargement).
  if (src === renderedLogo && box.firstChild && !box.querySelector('.icon-fallback')) return;
  renderedLogo = src;
  box.hidden = !src;
  box.replaceChildren(src ? imageEl(src, store.get().title, 'logo-img') : '');
}

// ---- Logo et titre déplaçables (mode édition) ----
const MOVABLE = { logo: 'logo', title: 'title-block' };

function applyLayout() {
  const { layout } = store.get();
  for (const [key, id] of Object.entries(MOVABLE)) {
    const el = document.getElementById(id);
    if (el.dataset.dragging) continue; // ne pas gêner un déplacement en cours
    const { x, y } = layout[key];
    el.style.translate = x || y ? `${x}px ${y}px` : '';
  }
}

function initMovable() {
  for (const [key, id] of Object.entries(MOVABLE)) {
    const el = document.getElementById(id);
    let start = null;
    el.addEventListener('pointerdown', e => {
      if (!document.body.classList.contains('editing') || e.button !== 0) return;
      e.preventDefault();
      const { x, y } = store.get().layout[key];
      start = { px: e.clientX, py: e.clientY, x, y };
      el.dataset.dragging = '1';
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!start) return;
      const x = Math.round(start.x + e.clientX - start.px);
      const y = Math.round(start.y + e.clientY - start.py);
      el.style.translate = `${x}px ${y}px`;
      start.cur = { x, y };
    });
    const end = () => {
      if (!start) return;
      const cur = start.cur;
      start = null;
      delete el.dataset.dragging;
      if (cur) store.update(c => { c.layout[key] = cur; });
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
}

function renderHeader() {
  const c = store.get();
  renderLogo(c.logo);
  applyLayout();
  document.getElementById('title').textContent = c.title;
  document.getElementById('desc').textContent = c.description;
  // Titre et description vides : le bloc est caché (sinon son cadre d'édition
  // apparaît comme un petit carré vide).
  document.getElementById('title-block').hidden = !c.title && !c.description;
  document.getElementById('title').hidden = !c.title;
  document.getElementById('desc').hidden = !c.description;
  document.getElementById('footer').textContent = c.footer;
  document.title = c.title || 'WebOrganizer';
  const root = document.documentElement.style;
  root.setProperty('--accent', c.theme.accent);
  root.setProperty('--panel-alpha', String(c.theme.panelOpacity));
  document.body.classList.toggle('cards-row', c.theme.cardStyle === 'row');
  document.body.classList.toggle('palette-nature', c.theme.palette === 'nature');
}

function render() {
  renderHeader();
  renderBackground();
  renderBoard(document.getElementById('board'));
}

// Bandeau du premier lancement : proposer la connexion à pCloud.
function welcomeBanner() {
  let dismissed = false;
  try { dismissed = localStorage.getItem('wo.welcome.dismissed') === '1'; } catch { /* ignore */ }
  if (dismissed || cloud.hasFolder() || !cloud.isConfigured()) return;
  const banner = document.getElementById('banner');
  const close = () => {
    banner.replaceChildren();
    try { localStorage.setItem('wo.welcome.dismissed', '1'); } catch { /* ignore */ }
  };
  banner.replaceChildren(h('div', { class: 'banner' },
    h('span', {}, 'Enregistrez votre page dans pCloud Drive pour la retrouver sur tous vos ordinateurs.'),
    h('button', {
      type: 'button', class: 'btn primary',
      onclick: () => cloud.connect().catch(e => { if (e?.name !== 'AbortError') toast(e.message, { kind: 'error' }); }),
    }, 'Choisir le dossier'),
    h('button', { type: 'button', class: 'btn link-btn', onclick: close }, 'Plus tard'),
  ));
  cloud.onAuthChange(ok => ok && banner.replaceChildren());
}

// Bouton plein écran (en bas à droite, au-dessus des Paramètres). Le navigateur
// n'autorise le plein écran qu'après un clic ; Échap ou un second clic en sort.
function initFullscreen() {
  const btn = document.getElementById('fullscreen-btn');
  if (!document.fullscreenEnabled) return;
  btn.hidden = false;
  const sync = () => {
    const on = !!document.fullscreenElement;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-label', on ? 'Quitter le plein écran' : 'Plein écran');
    btn.title = on ? 'Quitter le plein écran (Échap)' : 'Plein écran (touche Échap pour sortir)';
  };
  btn.addEventListener('click', () => {
    const p = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    p?.catch?.(e => toast(`Plein écran impossible : ${e.message}`, { kind: 'error' }));
  });
  document.addEventListener('fullscreenchange', sync);
  sync();
}

async function start() {
  await cloud.init();
  await store.load();
  render();
  store.subscribe(render);
  initSearch(document.getElementById('search'), document.getElementById('board'));
  initMovable();
  initSettings();
  initWeather();
  initFullscreen();
  await sync.init();
  welcomeBanner();

  if (cloud.isConnected()) sync.syncNow();

  // Resynchronise quand on revient sur l'onglet (modifications faites ailleurs).
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && cloud.isConnected()) sync.syncNow();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker', e));
  }
  window.__wo = { store, sync, cloud, toggleSettings }; // aide au débogage
}

start();
