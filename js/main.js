// Point d'entrée.
import { store } from './store.js';
import * as cloud from './pcloud.js';
import * as sync from './sync.js';
import { renderBoard } from './board.js';
import { renderBackground } from './background.js';
import { initSettings, toggle as toggleSettings } from './settings.js';
import { h, toast } from './util.js';

function renderHeader() {
  const c = store.get();
  document.getElementById('title').textContent = c.title;
  document.getElementById('desc').textContent = c.description;
  document.getElementById('footer').textContent = c.footer;
  document.title = c.title || 'WebOrganizer';
  const root = document.documentElement.style;
  root.setProperty('--accent', c.theme.accent);
  root.setProperty('--panel-alpha', String(c.theme.panelOpacity));
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
  if (dismissed || cloud.isConnected() || !cloud.isConfigured()) return;
  const banner = document.getElementById('banner');
  const close = () => {
    banner.replaceChildren();
    try { localStorage.setItem('wo.welcome.dismissed', '1'); } catch { /* ignore */ }
  };
  banner.replaceChildren(h('div', { class: 'banner' },
    h('span', {}, 'Sauvegardez votre page et retrouvez-la sur tous vos ordinateurs.'),
    h('button', { type: 'button', class: 'btn primary', onclick: () => cloud.connect() }, 'Se connecter à pCloud'),
    h('button', { type: 'button', class: 'btn link-btn', onclick: close }, 'Plus tard'),
  ));
  cloud.onAuthChange(ok => ok && banner.replaceChildren());
}

async function start() {
  const redirect = cloud.handleRedirect();
  await store.load();
  render();
  store.subscribe(render);
  initSettings();
  await sync.init();
  welcomeBanner();

  if (redirect?.error) toast(`Connexion à pCloud refusée ou interrompue (${redirect.error}).`, { kind: 'error' });
  if (cloud.isConnected()) {
    cloud.loadAccount()
      .then(info => redirect?.ok && toast(`pCloud est connecté${info.email ? ` (${info.email})` : ''}.`, { kind: 'ok' }))
      .catch(() => redirect?.ok && toast('La connexion à pCloud a échoué. Réessayez depuis les Paramètres.', { kind: 'error' }));
    sync.syncNow();
  }

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
