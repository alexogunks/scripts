@echo off
set SCRIPT=ws-automated-v3.3.3.js

echo Killing existing node process...
taskkill /F /IM node.exe >nul 2>&1

timeout /t 2 >nul

echo Restarting %SCRIPT%...
start "" node %SCRIPT%

echo ✅ Restarted %SCRIPT%