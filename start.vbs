Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c cd /d ""%~dp0"" && npm run build >nul 2>&1 && npx electron .", 0, False
Set WshShell = Nothing
