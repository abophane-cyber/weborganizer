# Guide d'installation pas à pas

Trois étapes, à faire une seule fois :

1. [Publier le site sur GitHub Pages](#1-publier-le-site-sur-github-pages) (≈ 10 min)
2. [Créer l'application pCloud et coller son Client ID](#2-créer-lapplication-pcloud) (≈ 5 min)
3. [Installer le protocole des profils Chrome](#3-profils-chrome) sur chaque ordinateur (≈ 2 min)

Adresse finale du site : **https://abophane-cyber.github.io/weborganizer/**

---

## 1. Publier le site sur GitHub Pages

Le site est 100 % statique (HTML/CSS/JS, sans étape de build) : GitHub Pages publie
directement les fichiers. Aucun workflow n'est nécessaire.

### 1.1 Créer le dépôt

1. Connectez-vous sur <https://github.com> avec le compte **abophane-cyber**.
2. En haut à droite : **+** → **New repository**.
3. *Repository name* : `weborganizer`.
4. Choisissez **Public**. Ne cochez **rien** (ni README, ni .gitignore, ni licence).
5. **Create repository**.

### 1.2 Envoyer les fichiers

Ouvrez un terminal (PowerShell) dans le dossier `C:\Users\hypno\Desktop\MonWebOrga`, puis :

```bash
git init
```

```bash
git add .
```

```bash
git commit -m "WebOrganizer : première version"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/abophane-cyber/weborganizer.git
```

```bash
git push -u origin main
```

Lors du premier `git push`, une fenêtre GitHub demande de vous connecter : acceptez.

> Le fichier `.gitignore` empêche d'envoyer le dossier `CafeMeteo/` (votre vidéo) et
> `.claude/`. Vos médias doivent passer par la page (ils vont dans pCloud), pas par GitHub.

### 1.3 Activer GitHub Pages

1. Sur la page du dépôt : **Settings** → menu de gauche **Pages**.
2. *Build and deployment* → *Source* : **GitHub Actions**.
3. C'est tout : à chaque `git push`, le workflow `.github/workflows/deploy.yml`
   publie le site (onglet **Actions** du dépôt pour suivre la publication, ≈ 1 minute).
4. Le lien **https://abophane-cyber.github.io/weborganizer/** apparaît en haut de
   **Settings → Pages**.

> Pourquoi un workflow ? Il numérote les fichiers à chaque publication
> (`util.js?v=…`). Sans ça, juste après une mise à jour, le navigateur pourrait
> mélanger anciens et nouveaux fichiers en cache, et la page resterait blanche
> jusqu'à 10 minutes. Vos fichiers dans le dépôt ne sont pas modifiés.

Pour publier une modification plus tard : `git add .`, puis `git commit -m "…"`, puis `git push`.

---

## 2. Synchroniser avec pCloud Drive

La page enregistre ses données dans **un dossier de l'ordinateur** que vous choisissez une
fois. En le plaçant dans **pCloud Drive** (lecteur `P:`), c'est le logiciel pCloud Drive qui
le synchronise avec pCloud et avec vos autres ordinateurs. La page n'utilise pas l'API
pCloud (qui interdit à une page web de relire les fichiers) : aucun Client ID n'est nécessaire.

Navigateur requis : **Chrome ou Edge sur ordinateur**.

### Sur le premier ordinateur (celui qui contient votre page)

1. Installez **pCloud Drive** si ce n'est pas fait, et connectez-vous.
2. Dans l'Explorateur, créez le dossier **`P:\WebOrganizer`**.
3. Ouvrez le site → ⚙ → **Synchronisation** → **Choisir le dossier de synchronisation…**
4. Sélectionnez `P:\WebOrganizer` → **Sélectionner le dossier**, puis acceptez quand Chrome
   demande l'autorisation de **modifier** les fichiers (cochez « Autoriser à chaque visite »
   si Chrome le propose).
5. Le témoin passe à **« Enregistré »** : `config.json` et `media/` apparaissent dans le dossier.

### Sur les autres ordinateurs / profils Chrome

1. Attendez que pCloud Drive ait synchronisé `P:\WebOrganizer`.
2. Ouvrez le site → ⚙ → **Choisir le dossier de synchronisation…** → `P:\WebOrganizer`.
3. La page enregistrée apparaît (une page de départ jamais modifiée n'écrase jamais
   une vraie page ; une page locale remplacée reste récupérable avec **« Restaurer »**).

Ensuite, chaque modification est écrite dans le dossier 1,5 s après, et chaque ordinateur
relit le dossier à l'ouverture, au retour sur l'onglet et toutes les minutes.

Si Chrome affiche **« Accès au dossier à autoriser »**, cliquez simplement sur
**« Autoriser l'accès au dossier »** (un clic).

---

## 3. Profils Chrome

Voir [installateur-profils/README.md](installateur-profils/README.md) : copier
`chromeprofile.vbs` dans `C:\WebOrganizer\`, puis double-cliquer sur `installer.reg`.
Ensuite, pour chaque carte de profil, renseignez le **Dossier du profil** (lu dans
`chrome://version`).

---

## Tester sur votre ordinateur (facultatif)

Dans le dossier du projet :

```bash
python -m http.server 8080 --bind 127.0.0.1
```

Puis ouvrez <http://localhost:8080/>. Une page de tests automatiques de la synchronisation,
avec un faux pCloud, est disponible sur <http://localhost:8080/tests/sync-test.html>.
Attention : elle efface les données locales de `localhost` (pas celles du site en ligne).
