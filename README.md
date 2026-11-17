# WebOrganizer

Page d'accueil personnelle : catégories, cartes de liens, cartes « Profils Chrome »,
fond d'écran image ou vidéo. Site 100 % statique publié sur GitHub Pages ; les données
sont dans **un dossier synchronisé par pCloud Drive** (ex. `P:\WebOrganizer`) et en cache
local dans le navigateur.

➡️ **Installation : [GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md)**

## Fonctionnement

| Élément | Où ? |
|---|---|
| Titre, description, couleurs, catégories, cartes, réglages | `config.json` du dossier synchronisé |
| Copie de la version précédente | `config.backup.json` (écrite avant chaque enregistrement) |
| Fonds, photos de profil, icônes, autres fichiers | `media/` du dossier synchronisé |
| Cache local (affichage instantané, hors connexion) | IndexedDB du navigateur |

- **Local d'abord** : la page fonctionne sans dossier relié. Les données restent dans le
  navigateur tant qu'aucun dossier n'est choisi.
- **Enregistrement automatique** 1,5 s après la dernière modification (les changements
  rapprochés sont regroupés en un seul envoi).
- **Plusieurs ordinateurs** : si `config.json` a été modifié ailleurs, la version la plus
  récente l'emporte. Si une version locale non envoyée est écrasée, elle est gardée dans
  le cache (`configAvantConflit`).
- **Indicateur** dans ⚙ Paramètres : *Enregistré*, *Synchronisation…*, *Hors ligne*,
  *Local uniquement*, *Accès au dossier à autoriser*.
- **Exporter / Importer** : une archive `.zip` contient `config.json` et tous les médias.
- **Mode édition** : les boutons modifier / supprimer / déplacer n'apparaissent que
  lorsque le panneau Paramètres est ouvert. On y ajoute catégories, **sous-catégories**
  et cartes ; le champ « Emplacement » d'une carte permet de la déplacer ailleurs.
- **Recherche** : la barre sous le titre filtre les cartes (nom, adresse, e-mail,
  dossier de profil, badge, catégorie), sans tenir compte des accents. Touche `/`
  pour y aller, Entrée pour ouvrir la première carte, Échap pour effacer.
- **Repli** : la flèche à gauche du titre replie une catégorie ou une sous-catégorie.
- **Logo** : image ronde au-dessus du titre (Paramètres → Général).
- Les médias qui ne sont plus utilisés depuis plus d'une heure sont retirés du dossier
  (pCloud Drive les place dans la corbeille pCloud, récupérables).

## Structure

```
index.html              page unique
css/style.css           styles
js/app-config.js        réglages publics (lien installateur, délai d'enregistrement)
js/main.js              démarrage
js/store.js             configuration et valeurs par défaut
js/db.js                cache IndexedDB
js/folder.js            dossier de synchronisation (File System Access, pCloud Drive)
js/sync.js              synchronisation cache <-> dossier
js/media.js             médias (cache local + dossier)
js/board.js             affichage des catégories et cartes
js/actions.js           édition (catégories, cartes)
js/settings.js          panneau Paramètres
js/background.js        fond image / vidéo
js/chrome-profiles.js   ouverture des profils Chrome (chromeprofile://)
js/transfer.js, zip.js  export / import .zip
sw.js                   service worker (fonctionnement hors connexion)
installateur-profils/   protocole Windows chromeprofile:// (.reg + .vbs)
tests/                  tests de synchronisation avec un faux dossier
scripts/stamp-version.mjs   numérotation des fichiers à la publication
.github/workflows/deploy.yml publication automatique sur GitHub Pages
```

La page se publie automatiquement à chaque `git push` (GitHub Actions). Le workflow
copie le site et numérote les fichiers (`?v=<commit>`) pour qu'un navigateur ne
mélange jamais deux versions.

Le dépôt est public : il ne contient aucune donnée personnelle ni aucune clé secrète.

Après l'ajout d'un nouveau fichier JS, ajoutez-le à la liste `ASSETS` de `sw.js`
(la version du cache est mise à jour automatiquement à la publication).

Créé par Sillonphane
