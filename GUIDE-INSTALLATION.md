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
2. *Build and deployment* → *Source* : **Deploy from a branch**.
3. *Branch* : **main**, dossier **/ (root)** → **Save**.
4. Patientez 1 à 2 minutes, puis rechargez la page **Settings → Pages** : le lien
   **https://abophane-cyber.github.io/weborganizer/** apparaît en haut.

Pour publier une modification plus tard : `git add .`, puis `git commit -m "…"`, puis `git push`.

---

## 2. Créer l'application pCloud

L'application a besoin d'un **Client ID** pCloud. Il n'est pas secret : il peut figurer
dans le code public. **N'utilisez jamais le « Client secret »**, la page n'en a pas besoin.

1. Connectez-vous à pCloud dans votre navigateur, puis ouvrez
   <https://docs.pcloud.com/my_apps/> (*My applications*).
2. **Create new app** (*Nouvelle application*) :
   - *Name* : `WebOrganizer`
   - *Access* : si on vous propose un **dossier privé** (« Private folder » / dossier
     dans *Applications*), choisissez-le : l'application n'aura alors accès qu'à son
     propre dossier, et pas au reste de votre pCloud. Sinon, choisissez l'accès aux fichiers.
3. Dans les réglages de l'application, ajoutez ces deux **Redirect URIs** (exactement,
   avec la barre oblique finale) :
   - `https://abophane-cyber.github.io/weborganizer/`
   - `http://localhost:8080/`  (pour les tests sur votre ordinateur)
4. Copiez le **Client ID**.
5. Ouvrez `js/app-config.js` et remplacez `COLLER_ICI_VOTRE_CLIENT_ID` par ce Client ID.
6. Publiez : `git add .`, puis `git commit -m "Client ID pCloud"`, puis `git push`.

### Première connexion

1. Ouvrez **https://abophane-cyber.github.io/weborganizer/**.
2. Cliquez sur **Se connecter à pCloud** (bandeau en haut, ou ⚙ Paramètres → Synchronisation).
3. pCloud demande d'autoriser *WebOrganizer* : **Autoriser**. Vous revenez sur la page.
4. Le dossier **WebOrganizer** est créé dans votre pCloud avec `config.json`,
   `config.backup.json` et `media/`. Si vous avez choisi le dossier privé, il se trouve
   dans le dossier **Applications** de pCloud.

Le jeton pCloud n'expire pas : vous restez connecté d'une visite à l'autre sur cet
ordinateur. Pour couper l'accès : ⚙ → **Déconnecter pCloud**, ou retirez l'application
dans les réglages de votre compte pCloud.

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
