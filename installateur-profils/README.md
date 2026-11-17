# Installateur « Profils Chrome »

Ce petit installateur permet aux cartes de profils du WebOrganizer d'ouvrir Chrome
**directement dans le bon profil** (Abophane, Randophane, Sillonphane, Hypnophane…).

Il ajoute à Windows un protocole `chromeprofile://`. Quand vous cliquez sur une carte,
la page appelle par exemple `chromeprofile://Profile%201`, et Windows lance :

```
chrome.exe --profile-directory="Profile 1"
```

À installer **une fois sur chaque ordinateur** (pas besoin d'être administrateur).

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

Le script `chromeprofile.vbs` vérifie le paramètre reçu : il n'accepte **que des lettres,
des chiffres et des espaces** (64 caractères maximum). Tout le reste est refusé, ce qui
empêche un site malveillant d'ajouter des options à la ligne de commande de Chrome.

## Désinstallation

Double-cliquez sur **`desinstaller.reg`**, puis supprimez `C:\WebOrganizer\chromeprofile.vbs`.
