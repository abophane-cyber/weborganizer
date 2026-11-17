// Numérote les fichiers du site pour une publication : ./util.js -> ./util.js?v=<version>.
// Chaque version publiée a ainsi ses propres adresses : le navigateur ne peut pas
// mélanger des fichiers anciens (en cache) et nouveaux, ce qui casserait la page.
//
// Utilisé par .github/workflows/deploy.yml sur une COPIE du site (jamais sur vos fichiers).
// Usage : node scripts/stamp-version.mjs <dossier du site> <version>

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const [dir, version] = process.argv.slice(2);
if (!dir || !/^[0-9a-z]{4,40}$/i.test(version || '')) {
  console.error('Usage : node scripts/stamp-version.mjs <dossier> <version>');
  process.exit(1);
}
const q = `?v=${version}`;

function edit(file, transform, minimum) {
  const path = join(dir, file);
  let count = 0;
  const out = transform(readFileSync(path, 'utf8'), () => { count++; });
  if (count < minimum) throw new Error(`${file} : ${count} remplacement(s), ${minimum} attendu(s) au minimum`);
  writeFileSync(path, out);
  console.log(`${file} : ${count} remplacement(s)`);
}

// 1. Imports entre modules : from './x.js'  et  import('./x.js')
for (const f of readdirSync(join(dir, 'js')).filter(n => n.endsWith('.js'))) {
  edit(join('js', f), (s, hit) => s
    .replace(/(\bfrom\s+['"]\.\/[\w-]+\.js)(['"])/g, (_, a, b) => { hit(); return a + q + b; })
    .replace(/(\bimport\(\s*['"]\.\/[\w-]+\.js)(['"])/g, (_, a, b) => { hit(); return a + q + b; }), 0);
}

// 2. Page : script principal et feuille de style
edit('index.html', (s, hit) => s
  .replace(/(src="js\/main\.js)(")/, (_, a, b) => { hit(); return a + q + b; })
  .replace(/(href="css\/style\.css)(")/, (_, a, b) => { hit(); return a + q + b; }), 2);

// 3. Service worker : nom du cache et liste des fichiers mis en cache
edit('sw.js', (s, hit) => s
  .replace(/const CACHE = '[^']+'/, () => { hit(); return `const CACHE = 'weborganizer-${version}'`; })
  .replace(/('\.\/(?:js\/[\w-]+\.js|css\/style\.css))'/g, (_, a) => { hit(); return `${a}${q}'`; }), 2);
