@echo off
rem Fast launcher: runs the already-built app.
rem After changing source code, run "npm run build" first.
cd /d "%~dp0"
if not exist "dist\main\index.js" (
  echo Building for the first time...
  call npm run build
  if errorlevel 1 (
    echo Build failed.
    pause
    exit /b 1
  )
)
npx electron .
