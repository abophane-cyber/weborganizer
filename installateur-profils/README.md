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
