# WebOrganizer

Page d'accueil personnelle : catégories, cartes de liens, cartes « Profils Chrome »,
fond d'écran image ou vidéo. Site 100 % statique publié sur GitHub Pages ; les données
sont sur **pCloud** (dossier `WebOrganizer/`) et en cache local dans le navigateur.

➡️ **Installation : [GUIDE-INSTALLATION.md](GUIDE-INSTALLATION.md)**

## Fonctionnement

| Élément | Où ? |
|---|---|
| Titre, description, couleurs, catégories, cartes, réglages | `WebOrganizer/config.json` sur pCloud |
| Copie de la version précédente | `WebOrganizer/config.backup.json` (écrite avant chaque envoi) |
| Fonds, photos de profil, icônes, autres fichiers | `WebOrganizer/media/` sur pCloud |
| Cache local (affichage instantané, hors connexion) | IndexedDB du navigateur |

- **Local d'abord** : la page fonctionne sans pCloud. Les données restent sur l'ordinateur
  tant que pCloud n'est pas connecté.
- **Enregistrement automatique** 1,5 s après la dernière modification (les changements
  rapprochés sont regroupés en un seul envoi).
- **Plusieurs ordinateurs** : si `config.json` a été modifié ailleurs, la version la plus
  récente l'emporte. Si une version locale non envoyée est écrasée, elle est gardée dans
  le cache (`configAvantConflit`).
- **Indicateur** dans ⚙ Paramètres : *Enregistré*, *Synchronisation…*, *Hors ligne*,
  *Local uniquement*, *Reconnexion à pCloud nécessaire*.
- **Exporter / Importer** : une archive `.zip` contient `config.json` et tous les médias.
- **Mode édition** : les boutons modifier / supprimer / déplacer n'apparaissent que
  lorsque le panneau Paramètres est ouvert. On y ajoute catégories, **sous-catégories**
  et cartes ; le champ « Emplacement » d'une carte permet de la déplacer ailleurs.
- Les médias qui ne sont plus utilisés depuis plus d'une heure sont mis à la **corbeille
  pCloud** (récupérables).

## Structure

```
index.html              page unique
css/style.css           styles
js/app-config.js        réglages publics (Client ID pCloud, dossier, lien installateur)
js/main.js              démarrage
js/store.js             configuration et valeurs par défaut
js/db.js                cache IndexedDB
js/pcloud.js            connexion OAuth pCloud + API
js/sync.js              synchronisation cache <-> pCloud
js/media.js             médias (cache local + pCloud)
js/board.js             affichage des catégories et cartes
js/actions.js           édition (catégories, cartes)
js/settings.js          panneau Paramètres
js/background.js        fond image / vidéo
js/chrome-profiles.js   ouverture des profils Chrome (chromeprofile://)
js/transfer.js, zip.js  export / import .zip
sw.js                   service worker (fonctionnement hors connexion)
installateur-profils/   protocole Windows chromeprofile:// (.reg + .vbs)
tests/                  tests de synchronisation avec un faux pCloud
```

Le dépôt est public : il ne contient aucune donnée personnelle ni aucune clé secrète.
Le Client ID pCloud n'est pas secret.

Après l'ajout d'un nouveau fichier JS, ajoutez-le à la liste `ASSETS` de `sw.js` et
augmentez la version `CACHE`.

Créé par Sillonphane
