@echo off
cd /d "%~dp0"

if not exist node_modules (
    echo Installing dependencies, this may take a minute...
    call npm install
)

echo Starting Step Recorder...
call npm start

pause
