@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
 echo Install Node.js LTS from https://nodejs.org/
 pause
 exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<20)process.exit(1)"
if errorlevel 1 (
 echo Node.js 20 or later is required.
 pause
 exit /b 1
)
set IMAGE_OPEN_PANEL=1
node app.mjs
pause
