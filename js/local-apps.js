// Ouverture d'une application de l'ordinateur via le protocole personnalisé weborgapp:
// (installé par installateur-profils/installer-applis.reg + applilocale.vbs).
import { h, toast } from './util.js';
import { INSTALLER_URL } from './app-config.js';

// Fichier local (C:\…) : raccourci .lnk/.url/.appref-ms ou programme .exe, sans guillemets.
export const APP_PATH_RE = /^[a-z]:\\[^"<>|?*\r\n\t]+\.(lnk|exe|url|appref-ms)$/i;

// Accepte le chemin tel que copié par « Copier en tant que chemin d'accès » (avec guillemets).
export function cleanAppPath(value) {
  return (value || '').trim().replace(/^"(.*)"$/, '$1').trim().replace(/\//g, '\\');
}

export const appUrl = path => 'weborgapp:' + encodeURIComponent(path);

// Nom du fichier sans son extension (« PMU Placé » pour …\PMU Placé.lnk).
export const appName = path => (path.split('\\').pop() || '').replace(/\.[^.]+$/, '');

export function openLocalApp(card) {
  const path = cleanAppPath(card.appPath);
  if (!APP_PATH_RE.test(path)) {
    toast(`La carte « ${card.title} » n'a pas de chemin d'application valide (ex. C:\\Dossier\\Appli.lnk). Modifiez la carte.`, { kind: 'warn', timeout: 7000 });
    return;
  }

  // Comme pour les profils Chrome : si la page garde le focus 2,5 s après le lancement,
  // rien ne s'est ouvert (protocole non installé).
  let left = false;
  const onLeave = () => { left = true; };
  window.addEventListener('blur', onLeave, { once: true });
  document.addEventListener('visibilitychange', onLeave, { once: true });

  window.location.href = appUrl(path);

  setTimeout(() => {
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onLeave);
    if (!left && document.hasFocus()) {
      toast(h('span', {},
        'L’application ne s’est pas ouverte ? Le protocole ', h('code', {}, 'weborgapp:'),
        ' n’est probablement pas installé sur cet ordinateur. ',
        h('a', { href: INSTALLER_URL, target: '_blank', rel: 'noopener' }, 'Voir l’installateur'),
      ), { kind: 'warn', timeout: 12000 });
    }
  }, 2500);
}
