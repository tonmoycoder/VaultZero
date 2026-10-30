@echo off
title VaultZero Launcher
cd /d "%~dp0"

echo ========================================================
echo    Starting VaultZero — 100% Offline Password Manager
echo ========================================================

:: Check if server is listening on port 1420, if not start it silently
powershell -NoProfile -ExecutionPolicy Bypass -Command "if (-not (Get-NetTCPConnection -LocalPort 1420 -ErrorAction SilentlyContinue)) { Start-Process powershell -ArgumentList '-WindowStyle Hidden -Command npm run dev' -WindowStyle Hidden; Start-Sleep -Seconds 3 }"

:: Launch in native Standalone App Window (Chromeless Desktop Window)
where msedge >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start msedge.exe --app="http://localhost:1420" --window-size=1200,800 --window-position=100,100
    exit
)

where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start chrome.exe --app="http://localhost:1420" --window-size=1200,800 --window-position=100,100
    exit
)

:: Fallback to default browser
start http://localhost:1420
exit
