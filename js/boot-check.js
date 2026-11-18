// Filet de sécurité (script classique, chargé avant main.js) : si un fichier du site
// ne se charge pas ou plante avant que la page démarre, on l'affiche au lieu
// de laisser une page vide.
(function () {
  var errors = [];
  function show() {
    var banner = document.getElementById('banner');
    if (!banner || banner.querySelector('.banner-error')) return;
    var box = document.createElement('div');
    box.className = 'banner banner-error';
    var span = document.createElement('span');
    span.textContent = 'La page n’a pas pu démarrer' + (errors.length ? ' — ' + errors.join(' · ') : '') +
      '. Essayez Ctrl+Maj+R pour recharger.';
    box.appendChild(span);
    banner.replaceChildren(box);
  }
  window.addEventListener('error', function (e) {
    var where = e.filename ? ' (' + e.filename.split('/').pop() + (e.lineno ? ':' + e.lineno : '') + ')' : '';
    errors.push((e.message || (e.target && e.target.src) || 'erreur') + where);
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    errors.push(String((e.reason && e.reason.message) || e.reason));
  });
  // main.js affiche l'horloge une fois démarré : sans elle après 6 s, le démarrage a échoué.
  setTimeout(function () {
    var clock = document.getElementById('clock');
    if (clock && clock.hidden && !document.getElementById('board').children.length) show();
  }, 6000);
})();
