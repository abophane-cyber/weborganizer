# Installateur « Profils Chrome »

Ce petit installateur permet aux cartes de profils du WebOrganizer d'ouvrir Chrome
**directement dans le bon profil** (Abophane, Randophane, Sillonphane, Hypnophane…).

Il ajoute à Windows un protocole `chromeprofile://`. Quand vous cliquez sur une carte,
la page appelle par exemple `chromeprofile://Profile%201`, et Windows lance :

```
chrome.exe --profile-directory="Profile 1"
```

Le protocole sait aussi **ouvrir une adresse dans un profil précis** :
`chromeprofile://Profile%201/<adresse>` lance
`chrome.exe --profile-directory="Profile 1" "https://…"`. C'est ce qui permet à une carte
Gmail d'ouvrir **la boîte du bon compte**, dans le profil où ce compte est connecté
(fenêtre de la carte → « Ouvrir dans le profil Chrome »).

À installer **une fois sur chaque ordinateur** (pas besoin d'être administrateur).

> **Mise à jour** : si vous aviez déjà installé une version précédente, recopiez simplement
> le nouveau `chromeprofile.vbs` dans `C:\WebOrganizer\` (le `.reg` ne change pas).

## Installation

1. Téléchargez ce dossier : sur GitHub, ouvrez chaque fichier puis cliquez sur
   l'icône « Download raw file » (ou téléchargez tout le dépôt avec *Code → Download ZIP*).
2. Créez le dossier **`C:\WebOrganizer`**.
3. Copiez **`chromeprofile.vbs`** dans `C:\WebOrganizer\`.
4. Double-cliquez sur **`installer.reg`**, puis acceptez les messages de Windows.
5. Dans la page WebOrganizer, cliquez sur une carte de profil. La première fois, Chrome
   demande « Ouvrir wscript.exe ? » : cochez **« Toujours autoriser »** puis **Ouvrir**.

> Vous préférez un autre emplacement que `C:\WebOrganizer` ? Ouvrez `installer.reg` avec
> le Bloc-notes et modifiez le chemin (en doublant les `\`).

## Trouver le « Dossier du profil » d'une carte

1. Ouvrez Chrome **dans le profil voulu**.
2. Tapez `chrome://version` dans la barre d'adresse.
3. À la ligne **« Chemin d'accès au profil »**, prenez le **dernier dossier** :
   `…\User Data\Default` → `Default`, `…\User Data\Profile 1` → `Profile 1`.
4. Dans le WebOrganizer : ouvrez les **Paramètres**, cliquez sur le crayon de la carte,
   et saisissez cette valeur dans **« Dossier du profil »**.

## Sécurité

Le script `chromeprofile.vbs` vérifie le paramètre reçu :
- le **nom du profil** n'accepte que des lettres, des chiffres et des espaces (64 caractères
  maximum) ;
- l'**adresse** facultative doit commencer par `https://` et ne contenir que des caractères
  simples (ni guillemets, ni espaces).

Tout le reste est refusé, ce qui empêche un site malveillant d'ajouter des options à la
ligne de commande de Chrome.

## Désinstallation

Double-cliquez sur **`desinstaller.reg`**, puis supprimez `C:\WebOrganizer\chromeprofile.vbs`.

---

# Cartes « Application de l'ordinateur »

Une carte peut aussi **ouvrir une application installée** (raccourci `.lnk`, programme
`.exe`, raccourci `.url` ou `.appref-ms`), par exemple `C:\Users\…\PMU Placé.lnk`.
Cela passe par un second protocole, `weborgapp:`, installé de la même façon.

## Installation (une fois par ordinateur)

1. Copiez **`applilocale.vbs`** dans `C:\WebOrganizer\` (à côté de `chromeprofile.vbs`).
2. Double-cliquez sur **`installer-applis.reg`**, puis acceptez les messages de Windows.
3. Copiez le chemin de l'application : dans l'Explorateur, **Maj + clic droit** sur le
   raccourci → **« Copier en tant que chemin d'accès »**.
4. **Autorisez-la** : ouvrez `C:\WebOrganizer\applis-autorisees.txt` dans le Bloc-notes
   (créez-le s'il n'existe pas), collez le chemin sur une nouvelle ligne et enregistrez.
   Les guillemets sont acceptés ; une ligne qui commence par `;` est un commentaire.
5. Dans le WebOrganizer, créez une carte de type **« Application de l'ordinateur »** et
   collez le même chemin.
6. Au premier clic, Chrome demande « Ouvrir wscript.exe ? » : cochez **« Toujours
   autoriser »** puis **Ouvrir**.

Raccourci pour l'étape 4 : dans le formulaire de la carte, le bouton **« Autoriser sur cet
ordinateur »** copie le chemin et ouvre la liste dans le Bloc-notes ; il ne reste qu'à faire
**Ctrl+V** sur une nouvelle ligne puis **Ctrl+S**. (La page n'écrit jamais elle-même dans la
liste : sinon n'importe quel site pourrait le faire aussi.)

Si vous oubliez l'étape 4, un message l'indique au clic et propose d'ouvrir la liste dans
le Bloc-notes.

## Sécurité

N'importe quel site peut tenter d'appeler `weborgapp:`. Le script `applilocale.vbs` :
- n'ouvre **que les fichiers que vous avez écrits vous-même** dans
  `C:\WebOrganizer\applis-autorisees.txt`. Il n'y a **aucun bouton « Autoriser »** : un
  site ne peut donc rien ajouter à cette liste, même si vous cliquez par erreur ;
- n'accepte qu'un **fichier existant sur un lecteur de cet ordinateur** (`C:\…`, pas de
  chemin réseau `\\serveur\…`) de type `.lnk`, `.exe`, `.url` ou `.appref-ms` ;
- l'ouvre **sans aucun argument** (comme un double-clic).

Au pire, un site malveillant pourrait donc ouvrir l'une des applications de votre liste.
Supprimez une ligne de la liste pour retirer l'accord.

### Alerte et journal

- Toute demande refusée (application hors de la liste, fichier introuvable, chemin réseau,
  mauvais type de fichier) affiche une **alerte « ⚠ TENTATIVE BLOQUÉE »** : rien n'est lancé.
  Si vous n'avez pas cliqué sur une carte juste avant, un site a peut-être essayé : fermez
  l'onglet suspect.
- Chaque demande est notée dans **`C:\WebOrganizer\journal-applis.txt`** (date, heure,
  `OUVERT`, `BLOQUE` ou `LISTE`, et le fichier demandé). Ouvrez-le dans le Bloc-notes pour
  vérifier après coup. Au-delà de 1 Mo, il est renommé `journal-applis.ancien.txt`.

## Désinstallation

Double-cliquez sur **`desinstaller-applis.reg`**, puis supprimez
`C:\WebOrganizer\applilocale.vbs`, `applis-autorisees.txt` et `journal-applis.txt`.
