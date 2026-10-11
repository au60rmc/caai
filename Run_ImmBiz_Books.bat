@echo off
setlocal enabledelayedexpansion
title ImmBiz Books - Enterprise Accounting Platform

color 0A

echo =====================================================================
echo           ImmBiz Books - 1-Click Fullstack Launcher (Windows)
echo =====================================================================
echo.

:: 1. Navigate to directory where this batch file is located
cd /d "%~dp0"

:: 2. Check for Python installation
echo [*] Checking Python installation...
set "PY_CMD="

where python >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=python"
) else (
    where py >nul 2>&1
    if !errorlevel! equ 0 (
        set "PY_CMD=py"
    ) else (
        where python3 >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=python3"
        )
    )
)

if "!PY_CMD!"=="" (
    echo [ERROR] Python is not installed or not in PATH!
    echo.
    echo Would you like to automatically install Python via Windows Package Manager?
    echo   Press [1] to Install Python automatically (via winget)
    echo   Press [2] to Open python.org in your browser to download manually
    echo   Press [3] to Exit
    echo.
    set /p choice="Enter choice [1, 2, or 3]: "
    if "!choice!"=="1" (
        echo [*] Installing Python 3.12 via winget...
        winget install -e --id Python.Python.3.12
        echo.
        echo [INFO] Python installation completed. Please close and re-open this file.
        pause
        exit /b 0
    )
    if "!choice!"=="2" (
        start https://www.python.org/downloads/
        echo Please install Python (make sure to check "Add python.exe to PATH") and run this file again.
        pause
        exit /b 0
    )
    exit /b 1
)

echo [OK] Found Python: !PY_CMD!

:: 3. Check / Setup Python Virtual Environment
echo.
echo [*] Checking Python Virtual Environment (backend\.venv)...

:: Detect and clean macOS/Linux virtualenv if copied across operating systems
if exist "backend\.venv" (
    if not exist "backend\.venv\Scripts\python.exe" (
        echo [INFO] Detected non-Windows virtualenv copied from Mac/Linux.
        echo [INFO] Automatically re-creating Windows-native virtual environment...
        rmdir /s /q "backend\.venv"
    )
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [*] Creating fresh Windows virtual environment...
    !PY_CMD! -m venv "backend\.venv"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to create virtual environment. Please ensure Python 3.10+ is installed.
        pause
        exit /b 1
    )
    echo [OK] Virtual environment created.
    echo [*] Installing dependencies from backend\requirements.txt (first run only)...
    "backend\.venv\Scripts\python.exe" -m pip install --upgrade pip
    "backend\.venv\Scripts\pip.exe" install -r "backend\requirements.txt"
    if !errorlevel! neq 0 (
        echo [ERROR] Failed to install dependencies.
        pause
        exit /b 1
    )
    echo [OK] All dependencies successfully installed.
) else (
    echo [OK] Virtual environment is ready.
)

:: 4. Verify Embedded Offline Database (immbiz.db)
echo.
echo [*] Checking Embedded Offline Database...
if not exist "backend\immbiz.db" (
    if exist "backups\immbiz-starter.db" (
        echo [*] Restoring pre-seeded offline database from backups...
        copy "backups\immbiz-starter.db" "backend\immbiz.db" >nul
        echo [OK] Offline database ready (backend\immbiz.db).
    ) else (
        echo [*] Initializing database schema...
        set "DATABASE_URL=sqlite:///./immbiz.db"
        "backend\.venv\Scripts\python.exe" -c "import sys; sys.path.insert(0, 'backend'); from app.core.init_db import init_db; init_db()"
        echo [OK] Database initialized.
    )
) else (
    echo [OK] Embedded database found (backend\immbiz.db).
)

:: 5. Launch Fullstack Server
echo.
echo =====================================================================
echo   ImmBiz Books Server is starting...
echo   Local URL: http://localhost:8000
echo =====================================================================
echo.
echo   ADMIN LOGIN CREDENTIALS (Unrestricted Access):
echo     * Username : admin   (or admin@immbiz.local)
echo     * Password : ImmBizAdmin2026!
echo     * Access   : Corporate Tier (1,000 Companies, 1,000 Users, No Limits)
echo.
echo   Alternative Admin:
echo     * Username : Nirmal
echo     * Password : Admin@123
echo =====================================================================
echo.

:: Automatically open default browser after a 3-second delay
start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:8000"

:: Run FastAPI server (serves both React Frontend and Backend API)
set "DATABASE_URL=sqlite:///./immbiz.db"
set "BACKEND_HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "PYTHONPATH=%cd%\backend"

cd backend
".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000

pause
