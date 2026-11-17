// Horloge en haut à gauche : heure (heures:minutes, secondes en petit) et date du jour.
// Mise à jour calée sur le changement de seconde, en heure locale de l'ordinateur.

const pad = n => String(n).padStart(2, '0');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

export function initClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const hm = document.createElement('span'); hm.className = 'clock-time';
  const sec = document.createElement('span'); sec.className = 'clock-sec';
  const date = document.createElement('span'); date.className = 'clock-date';
  const line = document.createElement('span'); line.className = 'clock-line';
  line.append(hm, sec);
  el.append(line, date);

  const tick = () => {
    const now = new Date();
    hm.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    sec.textContent = pad(now.getSeconds());
    const d = dateFmt.format(now);
    date.textContent = d.charAt(0).toUpperCase() + d.slice(1);
    el.setAttribute('aria-label', `${hm.textContent}, ${date.textContent}`);
    setTimeout(tick, 1000 - (Date.now() % 1000) + 5);
  };
  tick();
  el.hidden = false;
}
