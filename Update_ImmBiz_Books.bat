@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ImmBiz Books - Software Updater (Windows)

color 0B

echo =====================================================================
echo           ImmBiz Books - 1-Click Update Tool (Windows)
echo =====================================================================
echo.

cd /d "%~dp0"

echo [*] Checking internet connection...
ping -n 1 8.8.8.8 >nul 2>&1
if !errorlevel! neq 0 (
    echo.
    echo [ERROR] No internet connection detected.
    echo Please connect your computer to Wi-Fi and try running this again.
    echo.
    pause
    exit /b 1
)
echo [OK] Internet connected.
echo.

:: Method 1: Git Repository Pull
if exist ".git" (
    where git >nul 2>&1
    if !errorlevel! equ 0 (
        echo [*] Pulling latest updates from GitHub...
        git pull origin main
        if !errorlevel! equ 0 (
            goto :update_success
        )
        echo [WARN] Git pull encountered an issue. Trying direct download fallback...
    )
)

:: Method 2: Direct Archive Download via PowerShell (No Git Required)
echo [*] Downloading latest software update package from GitHub...
set "ZIP_URL=https://github.com/kumarimmbizsoft-dev/local_audit/archive/refs/heads/main.zip"
set "TMP_ZIP=%TEMP%\immbiz_update.zip"
set "TMP_DIR=%TEMP%\immbiz_extracted"

if exist "%TMP_ZIP%" del /f /q "%TMP_ZIP%"
if exist "%TMP_DIR%" rmdir /s /q "%TMP_DIR%"

powershell -NoProfile -Command "Invoke-WebRequest -Uri '%ZIP_URL%' -OutFile '%TMP_ZIP%'"
if !errorlevel! neq 0 (
    echo [ERROR] Failed to download update from GitHub.
    pause
    exit /b 1
)

echo [*] Extracting update files...
powershell -NoProfile -Command "Expand-Archive -Path '%TMP_ZIP%' -DestinationPath '%TMP_DIR%' -Force"
if !errorlevel! neq 0 (
    echo [ERROR] Failed to extract update archive.
    pause
    exit /b 1
)

echo [*] Applying update (preserving your database immbiz.db)...
set "SOURCE_DIR="
for /d %%D in ("%TMP_DIR%\*") do (
    set "SOURCE_DIR=%%D"
)

if not defined SOURCE_DIR set "SOURCE_DIR=%TMP_DIR%"

:: Copy all updated files while excluding database and virtualenv
robocopy "%SOURCE_DIR%" "%~dp0." /E /XF "immbiz.db" "immbiz.db-wal" "immbiz.db-shm" ".env" /XD ".venv" "__pycache__" "scratch" >nul

:: Cleanup temporary files
del /f /q "%TMP_ZIP%" 2>nul
rmdir /s /q "%TMP_DIR%" 2>nul

:update_success
echo.
echo =====================================================================
echo   [OK] ImmBiz Books is now up to date!
echo   All new accounting features and updates have been installed.
echo   Your offline database (immbiz.db) is preserved safely.
echo =====================================================================
echo.
echo Press any key to start ImmBiz Books...
pause >nul
call "%~dp0Run_ImmBiz_Books.bat"
