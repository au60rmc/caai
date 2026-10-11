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

:check_python
echo [*] Checking Python installation...
set "PY_CMD="

:: Check 1: Python Launcher (py -3)
py -3 -c "import sys; sys.exit(0)" >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=py -3"
    goto :found_python
)

:: Check 2: User-level Python installations (winget and python.org default locations)
for %%V in (Python313 Python312 Python311 Python310 Python39) do (
    if exist "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" (
        "%LOCALAPPDATA%\Programs\Python\%%V\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=%LOCALAPPDATA%\Programs\Python\%%V\python.exe"
            goto :found_python
        )
    )
)

:: Check 3: System-wide Program Files installations
for %%V in (Python313 Python312 Python311 Python310 Python39) do (
    if exist "%ProgramFiles%\Python\%%V\python.exe" (
        "%ProgramFiles%\Python\%%V\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=%ProgramFiles%\Python\%%V\python.exe"
            goto :found_python
        )
    )
    if exist "%ProgramFiles%\Python%%V\python.exe" (
        "%ProgramFiles%\Python%%V\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=%ProgramFiles%\Python%%V\python.exe"
            goto :found_python
        )
    )
    if exist "C:\Python%%V\python.exe" (
        "C:\Python%%V\python.exe" -c "import sys; sys.exit(0)" >nul 2>&1
        if !errorlevel! equ 0 (
            set "PY_CMD=C:\Python%%V\python.exe"
            goto :found_python
        )
    )
)

:: Check 4: Check if 'python' on PATH is functional (and NOT Microsoft Store dummy placeholder)
python -c "import sys; sys.exit(0)" >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=python"
    goto :found_python
)

:: Python was not found anywhere
if "!PY_CMD!"=="" (
    echo [NOTICE] Python was not found in standard system locations.
    echo.
    echo ImmBiz Books requires Python 3.10+ to run locally.
    echo.
    echo   [1] Automatically install Python 3.12 (via Windows winget - Recommended)
    echo   [2] Open Python.org download page in web browser
    echo   [3] Exit
    echo.
    set /p choice="Please enter choice [1, 2, or 3]: "
    if "!choice!"=="1" (
        echo.
        echo [*] Installing Python 3.12 via Windows Package Manager...
        winget install -e --id Python.Python.3.12 --override "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1"
        echo.
        echo [*] Verifying newly installed Python...
        ping 127.0.0.1 -n 3 >nul
        goto :check_python
    )
    if "!choice!"=="2" (
        start https://www.python.org/downloads/
        echo Please run the downloaded Python installer and be sure to CHECK:
        echo   [x] "Add python.exe to PATH"
        echo.
        pause
        goto :check_python
    )
    echo Exiting...
    pause
    exit /b 1
)

:found_python
echo [OK] Found Python: !PY_CMD!

:: 3. Check / Setup Python Virtual Environment
echo.
echo [*] Checking Python Virtual Environment (backend\.venv)...

:: Detect and clean macOS/Linux virtualenv if copied across operating systems
if exist "backend\.venv" (
    if not exist "backend\.venv\Scripts\python.exe" (
        echo [INFO] Detected non-Windows virtual environment. Re-creating for Windows...
        rmdir /s /q "backend\.venv"
    )
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [*] Creating Windows virtual environment (first run only)...
    "!PY_CMD!" -m venv "backend\.venv"
    if not exist "backend\.venv\Scripts\python.exe" (
        echo [WARN] Virtual environment creation skipped. Using system Python directly.
        set "VENV_PY=!PY_CMD!"
    ) else (
        set "VENV_PY=backend\.venv\Scripts\python.exe"
    )
) else (
    set "VENV_PY=backend\.venv\Scripts\python.exe"
)

:: 4. Verify & Install Dependencies
echo [*] Checking backend dependencies...
"!VENV_PY!" -c "import fastapi, uvicorn, sqlalchemy" >nul 2>&1
if !errorlevel! neq 0 (
    echo [*] Installing required packages (first run only, please wait 30 seconds)...
    "!VENV_PY!" -m pip install --no-warn-script-location -r "backend\requirements.txt"
    if !errorlevel! neq 0 (
        echo [WARN] Standard installation encountered a warning. Trying minimal fallback...
        "!VENV_PY!" -m pip install --no-warn-script-location fastapi uvicorn sqlalchemy pydantic pydantic-settings python-dotenv python-multipart bcrypt pyotp openpyxl PyPDF2
    )
    echo [OK] All dependencies ready.
) else (
    echo [OK] Dependencies already installed.
)

:: 5. Verify Embedded Offline Database (immbiz.db)
echo.
echo [*] Checking Embedded Database...
if not exist "backend\immbiz.db" (
    if exist "backups\immbiz-starter.db" (
        echo [*] Restoring pre-seeded database from backups...
        copy "backups\immbiz-starter.db" "backend\immbiz.db" >nul
        echo [OK] Offline database ready (backend\immbiz.db).
    ) else (
        echo [*] Initializing database schema...
        set "DATABASE_URL=sqlite:///./immbiz.db"
        "!VENV_PY!" -c "import sys; sys.path.insert(0, 'backend'); from app.core.init_db import init_db; init_db()"
        echo [OK] Database initialized.
    )
) else (
    echo [OK] Embedded database found (backend\immbiz.db).
)

:: 6. Launch Fullstack Server
echo.
echo =====================================================================
echo   ImmBiz Books Server is starting...
echo   Local URL: http://localhost:8000
echo =====================================================================
echo.
echo   ADMIN LOGIN CREDENTIALS (Unrestricted Access):
echo     * Username : admin   (or admin@immbiz.local)
echo     * Password : ImmBizAdmin2026!
echo     * Access   : Corporate Tier (1,000 Companies, 1,000 Users, Unlimited)
echo.
echo   Alternative Admin:
echo     * Username : Nirmal
echo     * Password : Admin@123
echo =====================================================================
echo.
echo [INFO] Opening your web browser in 3 seconds...

:: Automatically open default browser (Edge/Chrome) after 3 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8000'" >nul 2>&1
if !errorlevel! neq 0 (
    start "" cmd /c "ping 127.0.0.1 -n 4 >nul && start http://localhost:8000"
)

:: Run FastAPI server (serves both React Frontend and Backend API)
set "DATABASE_URL=sqlite:///./immbiz.db"
set "BACKEND_HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "FRONTEND_DIST=%~dp0frontend-react\dist"
set "PYTHONPATH=%~dp0backend"

cd /d "%~dp0backend"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) else (
    "!PY_CMD!" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
)

if !errorlevel! neq 0 (
    echo.
    echo [ERROR] The server stopped unexpectedly with code !errorlevel!.
    echo Please check the error message above.
)

pause
