' ============================================================
'  WebOrganizer - ouverture d'un profil Chrome
'  Recoit :  chromeprofile://Profile%201
'       ou   chromeprofile://Profile%201/<adresse https encodee>
'  et lance : chrome.exe --profile-directory="Profile 1" ["https://..."]
'  (script .vbs : aucune fenetre noire ne s'affiche)
' ============================================================
Option Explicit

Dim args, raw, rest, slash, prof, url, re, reUrl, sh, fso, chrome, candidates, c

' Decode les sequences %XX d'une chaine (ex. %3A -> :)
Function UrlDecode(s)
  Dim i, out, ch, hx, reHex
  Set reHex = New RegExp
  reHex.Pattern = "^[0-9A-Fa-f]{2}$"
  out = ""
  i = 1
  Do While i <= Len(s)
    ch = Mid(s, i, 1)
    hx = Mid(s, i + 1, 2)
    If ch = "%" And reHex.Test(hx) Then
      out = out & Chr(CLng("&H" & hx))
      i = i + 3
    Else
      out = out & ch
      i = i + 1
    End If
  Loop
  UrlDecode = out
End Function

Sub Refuse(message)
  MsgBox message, vbExclamation, "Profils Chrome"
  WScript.Quit 2
End Sub

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

' 3. Separer le profil et l'adresse eventuelle (avant / apres la premiere "/")
slash = InStr(raw, "/")
If slash > 0 Then
  rest = Mid(raw, slash + 1)
  raw = Left(raw, slash - 1)
Else
  rest = ""
End If

' 4. Profil : decoder uniquement les espaces, puis verifier
'    (uniquement lettres, chiffres et espaces, 1 a 64 caracteres)
prof = Replace(raw, "%20", " ")
Set re = New RegExp
re.Pattern = "^[A-Za-z0-9 ]{1,64}$"
If Not re.Test(prof) Then
  Refuse "Nom de dossier de profil refuse." & vbCrLf & _
         "Seuls les lettres, chiffres et espaces sont acceptes (ex. Default, Profile 1)."
End If

' 5. Adresse eventuelle : uniquement https://, sans guillemets ni espaces
url = ""
If rest <> "" Then
  url = UrlDecode(rest)
  Set reUrl = New RegExp
  reUrl.Pattern = "^https://[A-Za-z0-9.-]+(:[0-9]{1,5})?(/[A-Za-z0-9._~%/?=&+,;:@#!-]*)?$"
  If Len(url) > 2000 Or Not reUrl.Test(url) Then
    Refuse "Adresse refusee : seules les adresses https:// simples sont acceptees."
  End If
End If

' 6. Trouver chrome.exe
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

' 7. Lancer Chrome dans le profil demande (et ouvrir l'adresse s'il y en a une)
If url = "" Then
  sh.Run """" & chrome & """ --profile-directory=""" & prof & """", 1, False
Else
  sh.Run """" & chrome & """ --profile-directory=""" & prof & """ """ & url & """", 1, False
End If
