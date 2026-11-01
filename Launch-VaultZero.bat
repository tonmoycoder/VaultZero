@echo off
title VaultZero Launcher
cd /d "%~dp0"

echo ========================================================
echo    Starting VaultZero — 100% Offline Password Manager
echo ========================================================

:: 1. Ensure local engine is running and ready on port 1420 before opening browser
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 1420; " ^
  "if (-not (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)) { " ^
  "    Write-Host 'Starting VaultZero local engine on port 1420...'; " ^
  "    Start-Process powershell -ArgumentList '-WindowStyle Hidden -Command npm run dev' -WindowStyle Hidden " ^
  "}; " ^
  "Write-Host 'Connecting to local secure vault...'; " ^
  "for ($i = 0; $i -lt 40; $i++) { " ^
  "    try { " ^
  "        $r = Invoke-WebRequest -Uri 'http://localhost:1420/' -UseBasicParsing -TimeoutSec 1; " ^
  "        if ($r.StatusCode -eq 200) { break } " ^
  "    } catch { Start-Sleep -Milliseconds 400 } " ^
  "}"

:: 2. Launch in native Standalone Chromeless App Window (Brave -> Edge -> Chrome -> Default Browser)
if exist "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://localhost:1420" --window-size=1200,800
    exit
)
if exist "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe" (
    start "" "C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe" --app="http://localhost:1420" --window-size=1200,800
    exit
)

where msedge >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start msedge.exe --app="http://localhost:1420" --window-size=1200,800
    exit
)

where chrome >nul 2>nul
if %ERRORLEVEL% equ 0 (
    start chrome.exe --app="http://localhost:1420" --window-size=1200,800
    exit
)

:: Fallback to default browser
start http://localhost:1420
exit
