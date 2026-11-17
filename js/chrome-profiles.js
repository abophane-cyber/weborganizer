// Ouverture d'un profil Chrome via le protocole personnalisé chromeprofile://
import { h, toast } from './util.js';
import { INSTALLER_URL } from './app-config.js';

export const PROFILE_DIR_RE = /^[A-Za-z0-9 ]{1,64}$/;

export function profileUrl(dir) {
  return 'chromeprofile://' + encodeURIComponent(dir.trim());
}

export function openChromeProfile(card) {
  const dir = (card.profileDir || '').trim();
  if (!PROFILE_DIR_RE.test(dir)) {
    toast(`La carte « ${card.title} » n'a pas de dossier de profil valide (ex. Default, Profile 1). Ouvrez les Paramètres puis modifiez la carte.`, { kind: 'warn', timeout: 7000 });
    return;
  }

  // Un navigateur ne peut pas savoir si un protocole est installé. Si la page garde
  // le focus 2,5 s après le lancement, on en déduit que rien ne s'est ouvert.
  let left = false;
  const onLeave = () => { left = true; };
  window.addEventListener('blur', onLeave, { once: true });
  document.addEventListener('visibilitychange', onLeave, { once: true });

  window.location.href = profileUrl(dir);

  setTimeout(() => {
    window.removeEventListener('blur', onLeave);
    document.removeEventListener('visibilitychange', onLeave);
    if (!left && document.hasFocus()) {
      toast(h('span', {},
        'Chrome ne s’est pas ouvert ? Le protocole ', h('code', {}, 'chromeprofile://'),
        ' n’est probablement pas installé sur cet ordinateur. ',
        h('a', { href: INSTALLER_URL, target: '_blank', rel: 'noopener' }, 'Installer le protocole'),
      ), { kind: 'warn', timeout: 12000 });
    }
  }, 2500);
}
