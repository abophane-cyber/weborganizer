// Météo : le temps du jour dans l'en-tête ; un clic ouvre les prévisions de la semaine.
// Données Open-Meteo (gratuit, sans clé). La ville se règle dans Paramètres > Général.
import { h } from './util.js';
import { store } from './store.js';

const API = 'https://api.open-meteo.com/v1/forecast';
const GEO = 'https://geocoding-api.open-meteo.com/v1/search';
const CACHE_KEY = 'wo.weather.3';
const MAX_AGE = 15 * 60 * 1000; // relecture toutes les 15 minutes
// Tranches horaires des prévisions (heures locales, fin exclue).
const PERIODS = { matin: [7, 12], aprem: [13, 19] };

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
    hourly: 'temperature_2m,weather_code,precipitation_probability',
    // Météo-France (AROME/ARPEGE) en priorité ; le modèle automatique complète ce
    // qu'il ne fournit pas (jours 5 à 7, risque de pluie).
    models: `${MODELS.main},${MODELS.backup}`,
  });
  const res = await fetch(`${API}?${q}`);
  if (!res.ok) throw new Error(`météo indisponible (${res.status})`);
  const raw = await res.json();
  return { ...raw, daily: mergeModels(raw.daily), hourly: mergeModels(raw.hourly) };
}

const MODELS = { main: 'meteofrance_seamless', backup: 'best_match' };

// { x_meteofrance_seamless: [...], x_best_match: [...] } -> { x: [...] } :
// la valeur Météo-France si elle existe, sinon celle du modèle automatique.
function mergeModels(block) {
  if (!block) return block;
  const out = { time: block.time };
  const names = new Set(Object.keys(block).filter(k => k !== 'time')
    .map(k => k.replace(new RegExp(`_(${MODELS.main}|${MODELS.backup})$`), '')));
  for (const name of names) {
    const a = block[`${name}_${MODELS.main}`] || [];
    const b = block[`${name}_${MODELS.backup}`] || block[name] || [];
    out[name] = block.time.map((_, i) => a[i] ?? b[i] ?? null);
  }
  return out;
}

// Liens vers Météo-France : la ville (prévisions détaillées) et la carte des vigilances.
const mfCityUrl = city => `https://meteofrance.com/recherche/${encodeURIComponent(city.toLowerCase())}`;
const MF_VIGILANCE = 'https://vigilance.meteofrance.fr/fr';

// Recherche d'une ville : renvoie { city, lat, lon } ou null.
export async function findCity(name) {
  const q = new URLSearchParams({ name, count: '1', language: 'fr', format: 'json' });
  const res = await fetch(`${GEO}?${q}`);
  if (!res.ok) throw new Error(`recherche impossible (${res.status})`);
  const r = (await res.json()).results?.[0];
  return r ? { city: r.name, lat: Math.round(r.latitude * 100) / 100, lon: Math.round(r.longitude * 100) / 100 } : null;
}

// Résumé d'une tranche horaire d'un jour : temps le plus fréquent (le plus marqué en cas
// d'égalité), température moyenne, risque de pluie maximal.
function periodOf(dayIso, [from, to]) {
  const hr = data?.hourly;
  if (!hr) return null;
  const idx = [];
  hr.time.forEach((t, i) => {
    const hour = Number(t.slice(11, 13));
    if (t.startsWith(dayIso) && hour >= from && hour < to) idx.push(i);
  });
  if (!idx.length) return null;
  const count = {};
  for (const i of idx) count[hr.weather_code[i]] = (count[hr.weather_code[i]] || 0) + 1;
  const code = Number(Object.keys(count).sort((a, b) => count[b] - count[a] || b - a)[0]);
  const temps = idx.map(i => hr.temperature_2m[i]);
  const rains = idx.map(i => hr.precipitation_probability?.[i]).filter(v => v != null);
  return {
    code,
    temp: temps.reduce((a, b) => a + b, 0) / temps.length,
    rain: rains.length ? Math.max(...rains) : null,
  };
}

// Prochaine tranche à afficher dans l'en-tête, selon l'heure qu'il est.
function upcoming() {
  const d = data?.daily;
  if (!d) return null;
  const hour = new Date().getHours();
  if (hour < PERIODS.aprem[0]) return { label: 'Cet après-midi', p: periodOf(d.time[0], PERIODS.aprem) };
  if (d.time[1]) return { label: 'Demain matin', p: periodOf(d.time[1], PERIODS.matin) };
  return null;
}

async function refresh({ force = false } = {}) {
  const w = store.get().weather;
  const key = placeKey(w);
  const cached = readCache();
  if (!force && cached?.key === key && cached.data?.hourly && Date.now() - cached.at < MAX_AGE) {
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
    nextEl(),
    h('span', { class: 'wx-city' }, w.city),
  );
  btn.title = `${w.city} : ${label}. Cliquer pour la météo de la semaine.`;
  if (!pop.hidden) renderWeek();
}

function nextEl() {
  const n = upcoming();
  if (!n?.p) return null;
  const [icon, label] = describe(n.p.code);
  return h('span', { class: 'wx-next', title: `${n.label} : ${label}` },
    h('span', { class: 'wx-next-label' }, n.label),
    h('span', { class: 'wx-next-val' }, h('span', { class: 'wx-next-icon' }, icon), deg(n.p.temp)),
  );
}

// Cellule matin / après-midi d'un jour de la semaine.
function periodCell(iso, range, name) {
  const p = periodOf(iso, range);
  if (!p) return h('span', { class: 'wx-per empty' }, '—');
  const [icon, label] = describe(p.code);
  return h('span', { class: 'wx-per', title: `${name} : ${label}${p.rain != null ? `, pluie ${p.rain} %` : ''}` },
    h('span', { class: 'wx-per-icon' }, icon),
    h('span', { class: 'wx-per-temp' }, deg(p.temp)),
  );
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
    h('div', { class: 'wx-day wx-head' },
      h('span', {}, ''), h('span', {}, 'Matin'), h('span', {}, 'Après-midi'),
      h('span', {}, 'Pluie'), h('span', {}, 'Min / max'),
    ),
    h('ul', { class: 'wx-week' }, d.time.map((iso, i) => {
      const rain = d.precipitation_probability_max?.[i];
      return h('li', { class: `wx-day${i === 0 ? ' today' : ''}` },
        h('span', { class: 'wx-day-name' }, dayName(iso, i)),
        periodCell(iso, PERIODS.matin, 'Matin'),
        periodCell(iso, PERIODS.aprem, 'Après-midi'),
        h('span', { class: 'wx-day-rain', title: 'Risque de pluie sur la journée' }, rain != null ? `💧 ${rain} %` : ''),
        h('span', { class: 'wx-day-temps' },
          h('span', { class: 'wx-min' }, deg(d.temperature_2m_min[i])),
          h('span', { class: 'wx-max' }, deg(d.temperature_2m_max[i])),
        ),
      );
    })),
    h('div', { class: 'wx-links' },
      h('a', { class: 'btn small', href: mfCityUrl(w.city), target: '_blank', rel: 'noopener noreferrer' },
        `Détail sur Météo-France — ${w.city}`),
      h('a', { class: 'btn small', href: MF_VIGILANCE, target: '_blank', rel: 'noopener noreferrer' }, 'Vigilances'),
    ),
    h('p', { class: 'wx-source muted' }, 'Prévisions Météo-France (AROME, ARPEGE) via Open-Meteo'),
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
  // Chaque minute : l'en-tête suit l'heure (après-midi -> demain matin) et les
  // prévisions sont relues dès qu'elles ont plus de 15 minutes.
  let lastHour = new Date().getHours();
  setInterval(() => {
    if (!store.get().weather.enabled) return;
    const hour = new Date().getHours();
    const cached = readCache();
    if (hour !== lastHour || !cached || Date.now() - cached.at >= MAX_AGE) refresh();
    lastHour = hour;
  }, 60 * 1000);
  if (store.get().weather.enabled) refresh(); else render();
}
