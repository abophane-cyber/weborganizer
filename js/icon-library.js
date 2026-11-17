// Bibliothèque d'icônes au trait (24×24), dessinées pour l'application.
// Une icône est référencée dans la config par "icon:<nom>".

// Cercle en chemin SVG (deux arcs).
const c = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;

// Pétales disposés en rosace autour du centre (n pétales, du rayon r1 au rayon r2).
const petals = (n, r1, r2, w = 0.38, cx = 12, cy = 12) => {
  const pt = (a, r) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  const rm = (r1 + r2) / 2 + 1;
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    d += `M${pt(a, r1)}Q${pt(a - w, rm)} ${pt(a, r2)}Q${pt(a + w, rm)} ${pt(a, r1)}`;
  }
  return d;
};

// Icônes en lien avec la charte « Nature » : proposées en premier dans le choix d'icône.
export const NATURE_ICONS = [
  'leaf', 'sprout', 'plant', 'tree', 'pine', 'branch', 'daisy', 'flower', 'lotus', 'mushroom', 'acorn', 'apple',
  'sun', 'moon', 'rainbow', 'drop', 'wave', 'snowflake', 'feather', 'paw', 'fish', 'hive', 'fire', 'coffee',
];

export const ICONS = {
  leaf: ['Feuille nature', 'M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l9-9'],
  sprout: ['Pousse nature jardin', 'M12 21v-9M12 12c0-4-3-6-7-6 0 4 3 6 7 6zM12 10c0-4 3-6 7-6 0 4-3 6-7 6z'],
  plant: ['Plante en pot jardin', 'M7 14h10l-1.5 7h-7zM12 14V9M12 9c0-3-2-5-5-5 0 3 2 5 5 5zM12 11c0-3 2-5 5-5 0 3-2 5-5 5z'],
  tree: ['Arbre forêt nature', 'M12 21v-6M12 17l-2.5-2M12 16l2.5-2.5M8 15a4.5 4.5 0 0 1-1.5-8.5 5.5 5.5 0 0 1 11 0A4.5 4.5 0 0 1 16 15z'],
  pine: ['Sapin forêt montagne', 'M12 3l-5 7h3l-4 6h12l-4-6h3zM12 16v5'],
  branch: ['Rameau feuillage', 'M5 19L19 5M8 16c-3 0-4-2-4-2s2-2 5-1M11 13c-1-3 0-5 0-5s2 1 2 4M12 12c3 0 4 2 4 2s-2 2-5 1M15 9c-1-3 0-5 0-5s2 1 2 4'],
  daisy: ['Marguerite fleur', `${c(12, 12, 2.5)}${petals(8, 3.6, 9.6, 0.32)}`],
  flower: ['Fleur jardin', `${c(12, 9, 2)}${petals(5, 2.6, 7.2, 0.55, 12, 9)}M12 16v5M12 19c-2-2-4-2-5-1M12 19c2-2 4-2 5-1`],
  lotus: ['Lotus zen bien-être', 'M12 19c-2.5-2-3.5-6.5 0-12 3.5 5.5 2.5 10 0 12zM12 19c-4 0-8-2.5-9-7 3-.5 6 1 7.6 3.5M12 19c4 0 8-2.5 9-7-3-.5-6 1-7.6 3.5'],
  mushroom: ['Champignon forêt', 'M4 12a8 7 0 0 1 16 0zM10 12v6a2 2 0 0 0 4 0v-6M9 8h.01M14 6.5h.01'],
  acorn: ['Gland automne', 'M5 10c0-3 3-5 7-5s7 2 7 5zM6 10c0 5 3 9 6 11 3-2 6-6 6-11M12 5V3'],
  apple: ['Pomme fruit', 'M12 7c-3-2-8-1-8 5 0 5 3 9 5 9 1 0 2-1 3-1s2 1 3 1c2 0 5-4 5-9 0-6-5-7-8-5zM12 7c0-2 1-4 3-4'],
  sun: ['Soleil météo été', `${c(12, 12, 4)}M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4`],
  moon: ['Lune nuit', 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z'],
  rainbow: ['Arc-en-ciel', 'M3 18a9 9 0 0 1 18 0M6.5 18a5.5 5.5 0 0 1 11 0M10 18a2 2 0 0 1 4 0'],
  drop: ['Goutte eau pluie', 'M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z'],
  wave: ['Vague mer eau', 'M3 9c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 15c2-2 4-2 6 0s4 2 6 0 4-2 6 0'],
  snowflake: ['Flocon neige hiver', 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6l2.5-1.5M9.5 19.5L12 18l2.5 1.5'],
  feather: ['Plume écriture', 'M20 4C11 4 6 9 6 18M6 18l-2 3M6 18c7 0 12-5 14-14M8 14h6M10 10h6'],
  paw: ['Patte animal', `${c(8, 6.5, 1.8)}${c(16, 6.5, 1.8)}${c(4.8, 11.5, 1.8)}${c(19.2, 11.5, 1.8)}M12 11c-3 0-5 4-5 6.5 0 2 2 2.5 5 1.5 3 1 5 .5 5-1.5 0-2.5-2-6.5-5-6.5z`],
  fish: ['Poisson pêche mer', 'M3 12c3-4 8-6 13-3l5-3v12l-5-3c-5 3-10 1-13-3zM8 11h.01'],
  hive: ['Ruche hexagone miel', 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM8.5 10h7M8.5 12.5h7M8.5 15h7'],
  fire: ['Feu de camp', 'M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-7.5zM5 21l14-2M5 19l14 2'],
  coffee: ['Café boisson', 'M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 3c-1 1.5 1 2.5 0 4M12 3c-1 1.5 1 2.5 0 4'],
  folder: ['Dossier', 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  'folder-open': ['Dossier ouvert', 'M5 19h13l3-9H8l-3 9zM5 19V6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v2'],
  file: ['Document', 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6'],
  archive: ['Archive', 'M3 4h18v4H3zM5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4'],
  clipboard: ['Presse-papiers', 'M9 3h6v3H9zM9 4.5H6a1 1 0 0 0-1 1V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V5.5a1 1 0 0 0-1-1h-3M9 12h6M9 16h6'],
  book: ['Livre', 'M4 4h6a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4zM20 4h-6a2 2 0 0 0-2 2v14a2 2 0 0 1 2-2h6z'],
  newspaper: ['Journal', 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M7 9h7M7 13h7M7 16h4'],
  mail: ['E-mail', 'M3 6h18v12H3zM3 7l9 6 9-6'],
  phone: ['Téléphone', 'M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z'],
  share: ['Partage', `${c(6, 12, 2.5)}${c(18, 6, 2.5)}${c(18, 18, 2.5)}M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6`],
  megaphone: ['Annonce', 'M3 10v4h4l7 4V6L7 10zM17 9a4 4 0 0 1 0 6M7 14l1 5h3l-1-4'],
  target: ['Objectif', `${c(12, 12, 9)}${c(12, 12, 5)}${c(12, 12, 1)}`],
  trending: ['Tendance', 'M3 17l6-6 4 4 8-8M15 7h6v6'],
  'bar-chart': ['Histogramme', 'M4 20h16M7 16v-4M12 16V8M17 16V9'],
  'line-chart': ['Courbe', 'M4 4v16h16M7 15l4-4 3 3 5-6'],
  pie: ['Camembert', 'M21 12a9 9 0 1 1-9-9v9zM14 3.2A9 9 0 0 1 20.8 10H14z'],
  bulb: ['Idée', 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z'],
  presentation: ['Présentation', 'M3 4h18M5 4v10h14V4M12 14v4M9 21l3-3 3 3'],
  euro: ['Euro', 'M17 6a7 7 0 1 0 0 12M4 10h9M4 14h9'],
  banknote: ['Billet', `M3 7h18v10H3z${c(12, 12, 2.5)}M6 12h.01M18 12h.01`],
  wallet: ['Portefeuille', 'M4 6h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4zM4 6a2 2 0 0 1 2-2h10v2M16 13h.01'],
  bank: ['Banque', 'M3 10l9-6 9 6M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18'],
  card: ['Carte bancaire', 'M3 6h18v12H3zM3 10h18M7 15h4'],
  receipt: ['Reçu', 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h4'],
  cart: ['Panier', `M3 4h2l2.5 11h11L21 8H6.2${c(9, 19, 1.5)}${c(17, 19, 1.5)}`],
  tag: ['Étiquette', 'M3 12V4h8l9 9-8 8zM7.5 7.5h.01'],
  gift: ['Cadeau', 'M3 8h18v4H3zM5 12v9h14v-9M12 8v13M12 8c-2-4-5-4-5-2s3 2 5 2c2 0 5 0 5-2s-3-2-5 2'],
  briefcase: ['Travail', 'M3 7h18v13H3zM8 7V4h8v3M3 12h18'],
  home: ['Maison', 'M3 11l9-8 9 8M5 9v11h14V9M10 20v-6h4v6'],
  utensils: ['Cuisine', 'M6 3v8M4 3v5a2 2 0 0 0 4 0V3M6 11v10M17 3c-2 2-2 6 0 8M17 3v18'],
  heart: ['Cœur', 'M12 20s-7-4.4-9-9a4.5 4.5 0 0 1 9-3 4.5 4.5 0 0 1 9 3c-2 4.6-9 9-9 9z'],
  health: ['Santé', 'M3 12h4l2-4 3 8 2-4h7'],
  star: ['Étoile', 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z'],
  calendar: ['Calendrier', 'M4 5h16v15H4zM4 10h16M8 3v4M16 3v4'],
  music: ['Musique', `M9 18V5l11-2v13${c(6.5, 18, 2.5)}${c(17.5, 16, 2.5)}`],
  headphones: ['Casque', 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H4zM17 15h3v5h-3z'],
  video: ['Vidéo', 'M3 6h12v12H3zM15 10l6-3v10l-6-3'],
  tv: ['Télévision', 'M3 6h18v12H3zM8 21h8M8 3l4 3 4-3'],
  image: ['Image', `M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6${c(16, 9, 1.5)}`],
  camera: ['Appareil photo', `M3 7h4l2-3h6l2 3h4v13H3z${c(12, 13, 4)}`],
  gamepad: ['Jeux', 'M6 8h12a4 4 0 0 1 4 4v1a4 4 0 0 1-7 2.6L14 15h-4l-1 .6A4 4 0 0 1 2 13v-1a4 4 0 0 1 4-4zM7 11v3M5.5 12.5h3M16 12h.01M18 13.5h.01'],
  globe: ['Internet', `${c(12, 12, 9)}M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18`],
  cloud: ['Nuage', 'M7 18h10a4 4 0 0 0 .5-8A6 6 0 0 0 6 9a4.5 4.5 0 0 0 1 9z'],
  link: ['Lien', 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'],
  download: ['Téléchargement', 'M12 3v12M7 10l5 5 5-5M4 19h16'],
  code: ['Code', 'M8 7l-5 5 5 5M16 7l5 5-5 5M13 5l-2 14'],
  tool: ['Outil', 'M14.5 6.5a4 4 0 0 0-5.3 5.3L3 18l3 3 6.2-6.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-.5-.5-2.5z'],
  lock: ['Cadenas', 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4'],
  shield: ['Sécurité', 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z'],
  user: ['Personne', `${c(12, 8, 4)}M4 21a8 8 0 0 1 16 0`],
  users: ['Groupe', `${c(9, 8, 3.5)}M2 20a7 7 0 0 1 14 0M16 4.5a3.5 3.5 0 0 1 0 7M18 13.5a6 6 0 0 1 4 6.5`],
  graduation: ['École', 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6'],
  pin: ['Lieu', `M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12z${c(12, 9, 2.5)}`],
  map: ['Carte', 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14'],
  mountain: ['Montagne', 'M3 20l6-10 4 6 2-3 6 7z'],
  bike: ['Vélo', `${c(6, 16, 3.5)}${c(18, 16, 3.5)}M6 16l4-7h5l3 7M9 6h3`],
  car: ['Voiture', 'M5 11l2-5h10l2 5M3 11h18v6H3zM6 17v2M18 17v2M7 14h.01M17 14h.01'],
  plane: ['Voyage', 'M10 4.5L12 3l2 1.5V10l7 4v2l-7-2v4l2 2v1l-4-1-4 1v-1l2-2v-4l-7 2v-2l7-4z'],
  search: ['Recherche', `${c(11, 11, 7)}M20 20l-3.5-3.5`],
};

// Nom affiché : la partie avant les mots-clés de recherche (« Arc-en-ciel », « Plante en pot » → « Plante »).
export const iconLabel = name => {
  const lbl = ICONS[name]?.[0] || name;
  return NATURE_ICONS.includes(name) ? lbl.split(' ')[0] : lbl;
};

export const isIconRef =s => typeof s === 'string' && s.startsWith('icon:');

export function glyph(name, size = 18) {
  const entry = ICONS[name];
  if (!entry) return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  for (const [k, v] of Object.entries({
    viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor',
    'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true',
  })) svg.setAttribute(k, v);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', entry[1]);
  svg.append(p);
  return svg;
}
