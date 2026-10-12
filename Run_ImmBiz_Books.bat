@echo off
setlocal EnableExtensions EnableDelayedExpansion
title ImmBiz Books - Enterprise Accounting Platform

color 0A

echo =====================================================================
echo           ImmBiz Books - 1-Click Fullstack Launcher (Windows)
echo =====================================================================
echo.

:: Navigate to folder
cd /d "%~dp0"

:check_python
echo [*] Checking Python installation...
set "PY_CMD="

:: 1. Check Python Launcher
where py >nul 2>&1
if !errorlevel! equ 0 (
    set "PY_CMD=py"
    goto :found_python
)

:: 2. Check if python is in PATH and functional
where python >nul 2>&1
if !errorlevel! equ 0 (
    python -c "import sys" >nul 2>&1
    if !errorlevel! equ 0 (
        set "PY_CMD=python"
        goto :found_python
    )
)

:: 3. Check AppData user install locations (winget and python.org defaults)
if exist "%LOCALAPPDATA%\Programs\Python\Python313\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python313\python.exe" & goto :found_python
if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python312\python.exe" & goto :found_python
if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe" & goto :found_python
if exist "%LOCALAPPDATA%\Programs\Python\Python310\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python310\python.exe" & goto :found_python
if exist "%LOCALAPPDATA%\Programs\Python\Python39\python.exe" set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python39\python.exe" & goto :found_python

:: 4. Check Program Files locations
if exist "%ProgramFiles%\Python313\python.exe" set "PY_CMD=%ProgramFiles%\Python313\python.exe" & goto :found_python
if exist "%ProgramFiles%\Python312\python.exe" set "PY_CMD=%ProgramFiles%\Python312\python.exe" & goto :found_python
if exist "%ProgramFiles%\Python311\python.exe" set "PY_CMD=%ProgramFiles%\Python311\python.exe" & goto :found_python
if exist "%ProgramFiles%\Python310\python.exe" set "PY_CMD=%ProgramFiles%\Python310\python.exe" & goto :found_python
if exist "%ProgramFiles(x86)%\Python313\python.exe" set "PY_CMD=%ProgramFiles(x86)%\Python313\python.exe" & goto :found_python
if exist "%ProgramFiles(x86)%\Python312\python.exe" set "PY_CMD=%ProgramFiles(x86)%\Python312\python.exe" & goto :found_python
if exist "%ProgramFiles(x86)%\Python311\python.exe" set "PY_CMD=%ProgramFiles(x86)%\Python311\python.exe" & goto :found_python
if exist "%ProgramFiles(x86)%\Python310\python.exe" set "PY_CMD=%ProgramFiles(x86)%\Python310\python.exe" & goto :found_python
if exist "C:\Python313\python.exe" set "PY_CMD=C:\Python313\python.exe" & goto :found_python
if exist "C:\Python312\python.exe" set "PY_CMD=C:\Python312\python.exe" & goto :found_python
if exist "C:\Python311\python.exe" set "PY_CMD=C:\Python311\python.exe" & goto :found_python
if exist "C:\Python310\python.exe" set "PY_CMD=C:\Python310\python.exe" & goto :found_python

:: Python not found
echo.
echo =====================================================================
echo  [NOTICE] Python is not installed or not in PATH!
echo  ImmBiz Books requires Python to run locally.
echo =====================================================================
echo.
echo   Press [1] to Install Python automatically (via Windows winget)
echo   Press [2] to Open python.org in your browser to download manually
echo   Press [3] to Exit
echo.
set /p "choice=Please enter [1, 2, or 3]: "
if "!choice!"=="1" (
    echo.
    echo [*] Installing Python 3.12 via winget...
    winget install -e --id Python.Python.3.12 --override "/quiet InstallAllUsers=0 PrependPath=1 Include_pip=1"
    echo.
    echo [*] Checking for installed Python...
    goto :check_python
)
if "!choice!"=="2" (
    start https://www.python.org/downloads/
    echo Please install Python - make sure to check Add python.exe to PATH - and run this file again.
    pause
    goto :check_python
)
echo.
pause
exit /b 1

:found_python
echo [OK] Using Python: !PY_CMD!

:: Virtual Environment setup
echo.
echo [*] Checking Python Virtual Environment (backend\.venv)...
if exist "backend\.venv" (
    if not exist "backend\.venv\Scripts\python.exe" (
        echo [INFO] Rebuilding virtual environment...
        rmdir /s /q "backend\.venv"
    )
)

if not exist "backend\.venv\Scripts\python.exe" (
    echo [*] Creating virtual environment - first run only, please wait...
    !PY_CMD! -m venv "backend\.venv"
)

if exist "backend\.venv\Scripts\python.exe" (
    set "RUN_PY=%~dp0backend\.venv\Scripts\python.exe"
) else (
    echo [WARN] Virtual environment could not be created. Using system Python directly.
    set "RUN_PY=!PY_CMD!"
)

:: Dependencies check and install
echo [*] Checking dependencies...
"!RUN_PY!" -c "import fastapi, uvicorn, sqlalchemy" >nul 2>&1
if errorlevel 1 (
    echo [*] Installing required packages - first run only, please wait...
    "!RUN_PY!" -m pip install --no-warn-script-location -r "backend\requirements.txt"
)
echo [OK] Dependencies ready.

:: Database check
echo.
echo [*] Checking database...
if not exist "backend\immbiz.db" (
    if exist "backups\immbiz-starter.db" (
        echo [*] Restoring starter database...
        copy "backups\immbiz-starter.db" "backend\immbiz.db" >nul
        echo [OK] Offline database ready.
    ) else (
        echo [*] Initializing database...
        set "DATABASE_URL=sqlite:///./immbiz.db"
        "!RUN_PY!" -c "import sys; sys.path.insert(0, 'backend'); from app.core.init_db import init_db; init_db()"
        echo [OK] Database initialized.
    )
) else (
    echo [OK] Database found: backend\immbiz.db
)

:: Launch Server
echo.
echo =====================================================================
echo   ImmBiz Books Server is starting...
echo   Local URL: http://localhost:8000
echo =====================================================================
echo.
echo   ADMIN LOGIN CREDENTIALS:
echo     * Username : admin   (or admin@immbiz.local)
echo     * Password : Admin@123  (or ImmBizAdmin2026!)
echo.
echo   Alternative Admin:
echo     * Username : Nirmal
echo     * Password : Admin@123
echo =====================================================================
echo.

:: Automatically open default browser after 3 seconds
start "" powershell -NoProfile -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:8000'" >nul 2>&1

set "DATABASE_URL=sqlite:///./immbiz.db"
set "BACKEND_HOST=127.0.0.1"
set "BACKEND_PORT=8000"
set "FRONTEND_DIST=%~dp0frontend-react\dist"
set "PYTHONPATH=%~dp0backend"

cd /d "%~dp0backend"
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
) else (
    "!RUN_PY!" -m uvicorn app.main:app --host 127.0.0.1 --port 8000
)

echo.
echo =====================================================================
echo   ImmBiz Books stopped.
echo =====================================================================
pause
