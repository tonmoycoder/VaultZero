@echo off
chcp 65001 >nul
title VaultZero Launcher
cd /d "%~dp0"

echo ========================================================
echo    Starting VaultZero - 100%% Offline Password Manager
echo ========================================================

:: 0. Instant Standalone Native Executable Launch (< 0.5s cold-start)
if exist "%~dp0target\release\vaultzero-app.exe" (
    start "" "%~dp0target\release\vaultzero-app.exe"
    exit /b 0
)
if exist "%~dp0src-tauri\target\release\vaultzero-app.exe" (
    start "" "%~dp0src-tauri\target\release\vaultzero-app.exe"
    exit /b 0
)

:: 0b. Published native build sitting next to this launcher (no dev server needed)
if exist "%~dp0VaultZero-Windows-x64-Portable.exe" (
    start "" "%~dp0VaultZero-Windows-x64-Portable.exe"
    exit /b 0
)

:: 1. Fallback: Ensure local engine is running and ready on port 1420 before opening browser
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$port = 1420; " ^
  "$ready = $false; " ^
  "if (-not (Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue)) { " ^
  "    Write-Host 'Starting VaultZero local engine on port 1420...'; " ^
  "    Start-Process powershell -ArgumentList '-WindowStyle Hidden -Command npm run dev' -WindowStyle Hidden " ^
  "}; " ^
  "Write-Host 'Connecting to local secure vault...'; " ^
  "for ($i = 0; $i -lt 40; $i++) { " ^
  "    try { " ^
  "        $r = Invoke-WebRequest -Uri 'http://localhost:1420/' -UseBasicParsing -TimeoutSec 1; " ^
  "        if ($r.StatusCode -eq 200) { $ready = $true; break } " ^
  "    } catch { Start-Sleep -Milliseconds 400 } " ^
  "}; " ^
  "if (-not $ready) { Write-Host 'VaultZero local engine did not start on port 1420.'; exit 1 }"

if %ERRORLEVEL% neq 0 (
    echo VaultZero could not start; no browser window will be opened.
    exit /b 1
)

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
