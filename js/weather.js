// Météo : le temps du jour dans l'en-tête ; un clic ouvre les prévisions de la semaine.
// Données Open-Meteo (gratuit, sans clé). La ville se règle dans Paramètres > Général.
import { h } from './util.js';
import { store } from './store.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_KEY = 'wo.weather';
const MAX_AGE = 30 * 60 * 1000; // relecture toutes les 30 minutes

// Codes météo WMO -> [emoji, libellé].
const CODES = {
  0: ['☀️', 'Ensoleillé'], 1: ['🌤️', 'Plutôt ensoleillé'], 2: ['⛅', 'Partiellement nuageux'], 3: ['☁️', 'Couvert'],
  45: ['🌫️', 'Brouillard'], 48: ['🌫️', 'Brouillard givrant'],
  51: ['🌦️', 'Bruine légère'], 53: ['🌦️', 'Bruine'], 55: ['🌧️', 'Bruine forte'],
  56: ['🌧️', 'Bruine verglaçante'], 57: ['🌧️', 'Bruine verglaçante'],
  61: ['🌦️', 'Pluie faible'], 63: ['🌧️', 'Pluie'], 65: ['🌧️', 'Forte pluie'],
  66: ['🌧️', 'Pluie verglaçante'], 67: ['🌧️', 'Pluie verglaçante'],
  71: ['🌨️', 'Neige faible'], 73: ['🌨️', 'Neige'], 75: ['❄️', 'Forte neige'], 77: ['🌨️', 'Grains de neige'],
  80: ['🌦️', 'Averses'], 81: ['🌧️', 'Averses'], 82: ['⛈️', 'Fortes averses'],
  85: ['🌨️', 'Averses de neige'], 86: ['❄️', 'Fortes averses de neige'],
  95: ['⛈️', 'Orage'], 96: ['⛈️', 'Orage avec grêle'], 99: ['⛈️', 'Orage avec grêle'],
};
const describe = code => CODES[code] || ['🌡️', 'Météo'];
const deg = t => `${Math.round(t)}°`;

let btn, pop, data = null, loadedFor = '';

const placeKey = w => `${w.lat},${w.lon}`;

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { return null; }
}
function writeCache(v) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

async function fetchForecast(w) {
  const q = new URLSearchParams({
    latitude: w.lat, longitude: w.lon, timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,weather_code,is_day',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
  });
  const res = await fetch(`${API}?${q}`);
  if (!res.ok) throw new Error(`météo indisponible (${res.status})`);
  return res.json();
}

// Recherche d'une ville : renvoie { city, lat, lon } ou null.
export async function findCity(name) {
  const q = new URLSearchParams({ name, count: '1', language: 'fr', format: 'json' });
  const res = await fetch(`${GEO}?${q}`);
  if (!res.ok) throw new Error(`recherche impossible (${res.status})`);
  const r = (await res.json()).results?.[0];
  return r ? { city: r.name, lat: Math.round(r.latitude * 100) / 100, lon: Math.round(r.longitude * 100) / 100 } : null;
}

async function refresh({ force = false } = {}) {
  const w = store.get().weather;
  const key = placeKey(w);
  const cached = readCache();
  if (!force && cached?.key === key && Date.now() - cached.at < MAX_AGE) {
    data = cached.data;
  } else {
    if (cached?.key === key) data = cached.data; // affiche l'ancienne en attendant
    try {
      data = await fetchForecast(w);
      writeCache({ key, at: Date.now(), data });
    } catch (e) {
      console.warn('Météo', e);
      if (cached?.key !== key) data = null;
    }
  }
  loadedFor = key;
  render();
}

function render() {
  const w = store.get().weather;
  btn.hidden = !w.enabled;
  if (!w.enabled) { closePop(); return; }
  if (!data?.current) {
    btn.replaceChildren(h('span', { class: 'wx-icon' }, '🌡️'), h('span', { class: 'wx-city' }, w.city));
    btn.title = 'Météo indisponible pour le moment';
    return;
  }
  const [icon, label] = describe(data.current.weather_code);
  const d = data.daily;
  btn.replaceChildren(
    h('span', { class: 'wx-icon' }, data.current.is_day === 0 && data.current.weather_code <= 1 ? '🌙' : icon),
    h('span', { class: 'wx-main' },
      h('span', { class: 'wx-temp' }, deg(data.current.temperature_2m)),
      h('span', { class: 'wx-range' }, `${deg(d.temperature_2m_min[0])} / ${deg(d.temperature_2m_max[0])}`),
    ),
    h('span', { class: 'wx-city' }, w.city),
  );
  btn.title = `${w.city} : ${label}. Cliquer pour la météo de la semaine.`;
  if (!pop.hidden) renderWeek();
}

function renderWeek() {
  const d = data?.daily;
  const w = store.get().weather;
  if (!d) { pop.replaceChildren(h('p', { class: 'muted small' }, 'Météo indisponible pour le moment.')); return; }
  const dayName = (iso, i) => {
    if (i === 0) return 'Aujourd’hui';
    if (i === 1) return 'Demain';
    const s = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  pop.replaceChildren(
    h('h2', { class: 'wx-pop-title' }, `Météo de la semaine — ${w.city}`),
    h('ul', { class: 'wx-week' }, d.time.map((iso, i) => {
      const [icon, label] = describe(d.weather_code[i]);
      const rain = d.precipitation_probability_max?.[i];
      return h('li', { class: `wx-day${i === 0 ? ' today' : ''}` },
        h('span', { class: 'wx-day-name' }, dayName(iso, i)),
        h('span', { class: 'wx-day-icon', title: label }, icon),
        h('span', { class: 'wx-day-label' }, label),
        h('span', { class: 'wx-day-rain', title: 'Risque de pluie' }, rain != null ? `💧 ${rain} %` : ''),
        h('span', { class: 'wx-day-temps' },
          h('span', { class: 'wx-min' }, deg(d.temperature_2m_min[i])),
          h('span', { class: 'wx-max' }, deg(d.temperature_2m_max[i])),
        ),
      );
    })),
    h('p', { class: 'wx-source muted' }, 'Source : Open-Meteo'),
  );
}

function openPop() {
  renderWeek();
  pop.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}
function closePop() {
  if (!pop || pop.hidden) return;
  pop.hidden = true;
  btn.setAttribute('aria-expanded', 'false');
}

export function initWeather() {
  btn = document.getElementById('weather-btn');
  pop = document.getElementById('weather-pop');
  btn.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
  document.addEventListener('pointerdown', e => {
    if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) closePop();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });
  // Ville changée (ici ou sur un autre ordinateur) : nouvelles prévisions.
  store.subscribe(() => {
    const w = store.get().weather;
    if (w.enabled && placeKey(w) !== loadedFor) refresh(); else render();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && store.get().weather.enabled) refresh();
  });
  setInterval(() => { if (store.get().weather.enabled) refresh(); }, MAX_AGE);
  if (store.get().weather.enabled) refresh(); else render();
}
