' ============================================================
'  WebOrganizer - ouverture d'une application locale
'  Recoit :  weborgapp:<chemin encode>   (ex. weborgapp:C%3A%5CDossier%5CAppli.lnk)
'  et ouvre ce raccourci / programme comme un double-clic dans l'Explorateur.
'
'  Securite : un site web peut appeler ce protocole. Le script n'ouvre donc
'  qu'un fichier local (lecteur C:, D:...) existant, de type .lnk, .exe,
'  .url ou .appref-ms, SANS aucun argument, et SEULEMENT s'il figure dans
'  applis-autorisees.txt (a cote de ce script) : liste que vous remplissez
'  vous-meme dans le Bloc-notes. Aucun site ne peut y ajouter un fichier.
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

' ---- Journal : chaque appel est note dans journal-applis.txt (a cote du script) ----
Dim target, journalFile
target = ""

Sub LogEvent(status, detail)
  Dim ts, d, oldFile
  On Error Resume Next
  ' Au-dela de 1 Mo, l'ancien journal est renomme journal-applis.ancien.txt
  If fso.FileExists(journalFile) Then
    If fso.GetFile(journalFile).Size > 1048576 Then
      oldFile = fso.BuildPath(fso.GetParentFolderName(journalFile), "journal-applis.ancien.txt")
      If fso.FileExists(oldFile) Then fso.DeleteFile oldFile, True
      fso.MoveFile journalFile, oldFile
    End If
  End If
  ' Plusieurs appels simultanes : on reessaie si le fichier est deja ouvert (jusqu'a 2 s)
  Dim tries
  Set ts = Nothing
  For tries = 1 To 20
    Err.Clear
    If fso.FileExists(journalFile) Then
      Set ts = fso.OpenTextFile(journalFile, 8, False, -1)
    Else
      Set ts = fso.CreateTextFile(journalFile, False, True)
      If Err.Number = 0 Then ts.WriteLine "; Journal du WebOrganizer : chaque demande d'ouverture d'application."
    End If
    If Err.Number = 0 Then Exit For
    Set ts = Nothing
    WScript.Sleep 100
  Next
  If ts Is Nothing Then Exit Sub
  d = Now
  ' Pas de retour a la ligne dans le texte enregistre (un site ne peut pas fausser le journal)
  detail = Left(Replace(Replace(Replace(detail, vbCr, " "), vbLf, " "), vbTab, " "), 400)
  ts.WriteLine Year(d) & "-" & Right("0" & Month(d), 2) & "-" & Right("0" & Day(d), 2) & " " & _
               Right("0" & Hour(d), 2) & ":" & Right("0" & Minute(d), 2) & ":" & Right("0" & Second(d), 2) & _
               "  " & status & "  " & detail
  ts.Close
  On Error GoTo 0
End Sub

' Message d'alerte commun a tous les refus
Function AlertText(reason)
  AlertText = ChrW(&H26A0) & "  TENTATIVE BLOQUEE - rien n'a ete lance." & vbCrLf & vbCrLf & _
    reason & vbCrLf & vbCrLf & _
    "Si vous n'avez PAS clique sur une carte du WebOrganizer juste avant, un site a peut-etre " & _
    "essaye d'ouvrir un programme sur votre ordinateur : fermez l'onglet suspect." & vbCrLf & vbCrLf & _
    "Journal des demandes : " & journalFile
End Function

Sub Refuse(message)
  LogEvent "BLOQUE ", message & " : " & target
  MsgBox AlertText(message & vbCrLf & target), vbCritical, TITRE & " - tentative bloquee"
  WScript.Quit 2
End Sub

Set fso = CreateObject("Scripting.FileSystemObject")
listFile = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "applis-autorisees.txt")
journalFile = fso.BuildPath(fso.GetParentFolderName(WScript.ScriptFullName), "journal-applis.txt")

Set args = WScript.Arguments
If args.Count < 1 Then WScript.Quit 1
raw = args(0)
target = Left(raw, 400)

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

' Ouvre la liste dans le Bloc-notes (la cree avec une explication si besoin).
' Sans danger : le script n'y ecrit jamais de chemin, c'est a vous de le coller.
Sub OpenList()
  Dim ts2
  If Not fso.FileExists(listFile) Then
    Set ts2 = fso.CreateTextFile(listFile, False, True)
    ts2.WriteLine "; Applications que le WebOrganizer peut ouvrir : un chemin complet par ligne."
    ts2.WriteLine "; (Maj + clic droit sur le raccourci > Copier en tant que chemin d'acces, puis coller)"
    ts2.Close
  End If
  CreateObject("WScript.Shell").Run "notepad.exe """ & listFile & """", 1, False
End Sub

' Bouton "Autoriser sur cet ordinateur" de la page : weborgapp:liste
If LCase(raw) = "liste" Then
  LogEvent "LISTE  ", "ouverture de la liste des applications autorisees"
  OpenList
  WScript.Quit 0
End If

' 2. Decoder puis verifier le chemin
path = Utf8UrlDecode(raw)
target = Left(path, 400)
Set re = New RegExp
re.IgnoreCase = True
' Lecteur local (pas de chemin reseau \\...), sans guillemets ni caracteres interdits
re.Pattern = "^[A-Za-z]:\\[^""<>|?*\r\n\t]+$"
If Len(path) > 260 Or Not re.Test(path) Or InStr(path, "\..\") > 0 Then
  Refuse "Chemin refuse (seul un fichier de cet ordinateur, ex. C:\Dossier\Appli.lnk, est accepte)"
End If
re.Pattern = "\.(lnk|exe|url|appref-ms)$"
If Not re.Test(path) Then
  Refuse "Type de fichier refuse (seuls .lnk, .url, .appref-ms et .exe sont acceptes)"
End If

If Not fso.FileExists(path) Then
  Refuse "Fichier introuvable sur cet ordinateur"
End If

' 3. Liste des fichiers autorises (un chemin par ligne, ecrite par vous)

' Lit la liste : UTF-16 (avec BOM) ou UTF-8 (format du Bloc-notes)
Function ReadList()
  Dim st, bom, charset
  ReadList = ""
  If Not fso.FileExists(listFile) Then Exit Function
  Set st = CreateObject("ADODB.Stream")
  st.Type = 1
  st.Open
  st.LoadFromFile listFile
  charset = "utf-8"
  If st.Size >= 2 Then
    bom = st.Read(2)
    If AscB(MidB(bom, 1, 1)) = &HFF And AscB(MidB(bom, 2, 1)) = &HFE Then charset = "unicode"
  End If
  st.Close
  Set st = CreateObject("ADODB.Stream")
  st.Type = 2
  st.Charset = charset
  st.Open
  st.LoadFromFile listFile
  ReadList = st.ReadText
  st.Close
End Function

' Le chemin est-il dans la liste ? (un chemin par ligne, guillemets acceptes,
' lignes commencant par ; ignorees, majuscules indifferentes)
Function IsAllowed(p)
  Dim lines, line
  IsAllowed = False
  lines = Split(Replace(ReadList(), vbCr, ""), vbLf)
  For Each line In lines
    line = Trim(line)
    If Len(line) > 0 Then
      If AscW(Left(line, 1)) = &HFEFF Then line = Mid(line, 2)
    End If
    If Len(line) >= 2 Then
      If Left(line, 1) = """" And Right(line, 1) = """" Then line = Trim(Mid(line, 2, Len(line) - 2))
    End If
    If line <> "" And Left(line, 1) <> ";" And LCase(line) = LCase(p) Then IsAllowed = True
  Next
End Function

If Not IsAllowed(path) Then
  ' Volontairement aucun bouton "Autoriser" : un site ne doit pas pouvoir obtenir
  ' un accord d'un simple clic. On propose seulement d'ouvrir la liste.
  LogEvent "BLOQUE ", "hors de la liste : " & path
  If MsgBox(AlertText("Cette application n'est pas dans votre liste :" & vbCrLf & path) & vbCrLf & vbCrLf & _
            "C'est bien vous ? Pour l'autoriser, ajoutez vous-meme ce chemin sur une ligne de :" & vbCrLf & _
            listFile & vbCrLf & vbCrLf & _
            "Ouvrir la liste dans le Bloc-notes ?", _
            vbYesNo + vbCritical + vbDefaultButton2, TITRE & " - tentative bloquee") = vbYes Then OpenList
  WScript.Quit 4
End If

LogEvent "OUVERT ", path

' 4. Ouvrir le fichier comme un double-clic (sans argument)
folder = fso.GetParentFolderName(path)
CreateObject("Shell.Application").ShellExecute path, "", folder, "open", 1
