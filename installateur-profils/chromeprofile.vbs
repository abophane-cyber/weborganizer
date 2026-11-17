' ============================================================
'  WebOrganizer - ouverture d'un profil Chrome
'  Recoit une adresse du type  chromeprofile://Profile%201
'  et lance :  chrome.exe --profile-directory="Profile 1"
'  (script .vbs : aucune fenetre noire ne s'affiche)
' ============================================================
Option Explicit

Dim args, raw, prof, re, sh, fso, chrome, candidates, c

Set args = WScript.Arguments
If args.Count < 1 Then WScript.Quit 1
raw = args(0)

' 1. Retirer le prefixe du protocole
If LCase(Left(raw, 16)) = "chromeprofile://" Then
  raw = Mid(raw, 17)
ElseIf LCase(Left(raw, 14)) = "chromeprofile:" Then
  raw = Mid(raw, 15)
End If

' 2. Retirer les barres obliques de fin ajoutees par certains navigateurs
Do While Len(raw) > 0 And Right(raw, 1) = "/"
  raw = Left(raw, Len(raw) - 1)
Loop

' 3. Decoder uniquement les espaces (%20)
prof = Replace(raw, "%20", " ")

' 4. Verification : uniquement lettres, chiffres et espaces (1 a 64 caracteres)
Set re = New RegExp
re.Pattern = "^[A-Za-z0-9 ]{1,64}$"
If Not re.Test(prof) Then
  MsgBox "Nom de dossier de profil refuse." & vbCrLf & _
         "Seuls les lettres, chiffres et espaces sont acceptes (ex. Default, Profile 1).", _
         vbExclamation, "Profils Chrome"
  WScript.Quit 2
End If

' 5. Trouver chrome.exe
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
chrome = ""
candidates = Array( _
  sh.ExpandEnvironmentStrings("%ProgramFiles%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%ProgramFiles(x86)%") & "\Google\Chrome\Application\chrome.exe", _
  sh.ExpandEnvironmentStrings("%LocalAppData%") & "\Google\Chrome\Application\chrome.exe")
For Each c In candidates
  If chrome = "" Then
    If fso.FileExists(c) Then chrome = c
  End If
Next
If chrome = "" Then
  On Error Resume Next
  chrome = sh.RegRead("HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
  If chrome = "" Then chrome = sh.RegRead("HKCU\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\chrome.exe\")
  On Error GoTo 0
End If
If chrome = "" Then
  MsgBox "Google Chrome est introuvable sur cet ordinateur.", vbExclamation, "Profils Chrome"
  WScript.Quit 3
End If

' 6. Lancer Chrome dans le profil demande
sh.Run """" & chrome & """ --profile-directory=""" & prof & """", 1, False
