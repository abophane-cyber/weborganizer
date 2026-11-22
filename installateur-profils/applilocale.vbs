' ============================================================
'  WebOrganizer - ouverture d'une application locale
'  Recoit :  weborgapp:<chemin encode>   (ex. weborgapp:C%3A%5CDossier%5CAppli.lnk)
'  et ouvre ce raccourci / programme comme un double-clic dans l'Explorateur.
'
'  Securite : un site web peut appeler ce protocole. Le script n'ouvre donc
'  qu'un fichier local (lecteur C:, D:...) existant, de type .lnk, .exe,
'  .url ou .appref-ms, SANS aucun argument. La premiere fois qu'un fichier est
'  demande, Windows demande votre accord ; il est ensuite memorise dans
'  applis-autorisees.txt (a cote de ce script).
'  (script .vbs : aucune fenetre noire ne s'affiche)
' ============================================================
Option Explicit

Const TITRE = "WebOrganizer - applications"

Dim args, raw, path, re, fso, listFile, allowed, ext, folder

' Decode les sequences %XX (octets UTF-8) en texte Unicode (ex. %C3%A9 -> e accent aigu)
Function Utf8UrlDecode(s)
  Dim i, out, ch, hx, b, b2, b3, b4, cp, reHex
  Set reHex = New RegExp
  reHex.Pattern = "^[0-9A-Fa-f]{2}$"
  out = ""
  i = 1
  Do While i <= Len(s)
    ch = Mid(s, i, 1)
    If ch = "%" And reHex.Test(Mid(s, i + 1, 2)) Then
      b = CLng("&H" & Mid(s, i + 1, 2))
      i = i + 3
      If b < &H80 Then
        out = out & Chr(b)
      ElseIf (b And &HE0) = &HC0 Then
        b2 = NextByte(s, i)
        out = out & ChrW(((b And &H1F) * 64) Or (b2 And &H3F))
      ElseIf (b And &HF0) = &HE0 Then
        b2 = NextByte(s, i)
        b3 = NextByte(s, i)
        cp = ((b And &H0F) * 4096) Or ((b2 And &H3F) * 64) Or (b3 And &H3F)
        out = out & ChrW(cp)
      ElseIf (b And &HF8) = &HF0 Then
        b2 = NextByte(s, i)
        b3 = NextByte(s, i)
        b4 = NextByte(s, i)
        cp = ((b And &H07) * 262144) Or ((b2 And &H3F) * 4096) Or ((b3 And &H3F) * 64) Or (b4 And &H3F)
        cp = cp - 65536
        out = out & ChrW(&HD800& + (cp \ 1024)) & ChrW(&HDC00& + (cp Mod 1024))
      Else
        Refuse "Chemin mal encode."
      End If
    Else
      out = out & ch
      i = i + 1
    End If
  Loop
  Utf8UrlDecode = out
End Function

' Octet de continuation UTF-8 suivant (%XX), sinon refus
Function NextByte(s, ByRef i)
  Dim hx, v
  If Mid(s, i, 1) <> "%" Then Refuse "Chemin mal encode."
  hx = Mid(s, i + 1, 2)
  v = CLng("&H" & hx)
  If (v And &HC0) <> &H80 Then Refuse "Chemin mal encode."
  i = i + 3
  NextByte = v
End Function

Sub Refuse(message)
  MsgBox message, vbExclamation, TITRE
  WScript.Quit 2
End Sub

Set args = WScript.Arguments
If args.Count < 1 Then WScript.Quit 1
raw = args(0)

' 1. Retirer le prefixe du protocole (avec ou sans //) et les / de fin
If LCase(Left(raw, 12)) = "weborgapp://" Then
  raw = Mid(raw, 13)
ElseIf LCase(Left(raw, 10)) = "weborgapp:" Then
  raw = Mid(raw, 11)
End If
Do While Len(raw) > 0 And Right(raw, 1) = "/"
  raw = Left(raw, Len(raw) - 1)
Loop
If Len(raw) > 3000 Then Refuse "Chemin trop long."

' 2. Decoder puis verifier le chemin
path = Utf8UrlDecode(raw)
Set re = New RegExp
re.IgnoreCase = True
' Lecteur local (pas de chemin reseau \\...), sans guillemets ni caracteres interdits
re.Pattern = "^[A-Za-z]:\\[^""<>|?*\r\n\t]+$"
If Len(path) > 260 Or Not re.Test(path) Or InStr(path, "\..\") > 0 Then
  Refuse "Chemin refuse : seul un fichier de cet ordinateur (ex. C:\Dossier\Appli.lnk) peut etre ouvert."
End If
re.Pattern = "\.(lnk|exe|url|appref-ms)$"
If Not re.Test(path) Then
  Refuse "Type de fichier refuse :" & vbCrLf & path & vbCrLf & vbCrLf & _
         "Seuls les raccourcis (.lnk, .url, .appref-ms) et programmes (.exe) sont acceptes."
End If

Set fso = CreateObject("Scripting.FileSystemObject")
If Not fso.FileExists(path) Then
  Refuse "Fichier introuvable sur cet ordinateur :" & vbCrLf & path
End If

' 3. Liste des fichiers deja autorises (un chemin par ligne)
listFile = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "applis-autorisees.txt")

Function IsAllowed(p)
  Dim ts, line
  IsAllowed = False
  If Not fso.FileExists(listFile) Then Exit Function
  Set ts = fso.OpenTextFile(listFile, 1, False, -1)
  Do While Not ts.AtEndOfStream
    line = Trim(ts.ReadLine)
    If LCase(line) = LCase(p) Then IsAllowed = True
  Loop
  ts.Close
End Function

If Not IsAllowed(path) Then
  If MsgBox("Le WebOrganizer demande a ouvrir :" & vbCrLf & vbCrLf & path & vbCrLf & vbCrLf & _
            "Autoriser cette application ? (votre choix sera memorise)" & vbCrLf & _
            "Si vous n'avez pas clique sur une carte du WebOrganizer, repondez Non.", _
            vbYesNo + vbQuestion + vbDefaultButton2, TITRE) <> vbYes Then
    WScript.Quit 4
  End If
  Dim ts2
  If fso.FileExists(listFile) Then
    Set ts2 = fso.OpenTextFile(listFile, 8, False, -1)
  Else
    Set ts2 = fso.CreateTextFile(listFile, False, True)
  End If
  ts2.WriteLine path
  ts2.Close
End If

' 4. Ouvrir le fichier comme un double-clic (sans argument)
folder = fso.GetParentFolderName(path)
CreateObject("Shell.Application").ShellExecute path, "", folder, "open", 1
