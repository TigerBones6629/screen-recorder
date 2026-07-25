@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies, this may take a minute...
    call npm install
)

echo Starting screen-recorder...
start "" http://localhost:5173
call npm run dev

pause
