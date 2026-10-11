@echo off
cd /d "%~dp0"
call "%~dp0Run_ImmBiz_Books.bat"
if errorlevel 1 (
    echo.
    pause
)
