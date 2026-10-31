@echo off
title VaultZero Launcher
cd /d "%~dp0"

echo ========================================================
echo    Starting VaultZero — 100%% Offline Password Manager
echo ========================================================

:: 1. Check if local engine is already listening on port 1420
netstat -ano | findstr /R /C:":1420 .*LISTENING" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Starting VaultZero local engine on port 1420...
    start "" /b npm run dev
    timeout /t 2 /nobreak >nul
)

:: 2. Wait until port 1420 is listening and ready
echo Connecting to local secure vault...
for /l %%i in (1,1,30) do (
    netstat -ano | findstr /R /C:":1420 .*LISTENING" >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        goto :LAUNCH
    )
    timeout /t 1 /nobreak >nul
)

:LAUNCH
echo VaultZero Engine is ready on port 1420! Launching app...

:: 3. Launch in standalone chromeless app window (Brave -> Edge -> Chrome -> Default)
if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://localhost:1420" --window-size=1200,800
    exit /b 0
)
if exist "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://localhost:1420" --window-size=1200,800
    exit /b 0
)

where msedge >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start "" msedge.exe --app="http://localhost:1420" --window-size=1200,800
    exit /b 0
)

where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start "" chrome.exe --app="http://localhost:1420" --window-size=1200,800
    exit /b 0
)

:: Fallback to default browser
start http://localhost:1420
exit /b 0
