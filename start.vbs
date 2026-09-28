Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

dir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = dir

' Build only once, when dist is missing - rebuilding on every launch is slow
If Not fso.FileExists(dir & "\dist\main\index.js") Then
  WshShell.Run "cmd /c cd /d """ & dir & """ && npm run build", 0, True
End If

WshShell.Run "cmd /c cd /d """ & dir & """ && npx electron .", 0, False

Set WshShell = Nothing
Set fso = Nothing
