@echo off
setlocal
cd /d "%~dp0"

echo Creating Desktop Shortcut for ImmBiz Books...

set "TARGET=%~dp0Run_ImmBiz_Books.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\ImmBiz Books.lnk"

powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut('%SHORTCUT%'); $s.TargetPath = '%TARGET%'; $s.WorkingDirectory = '%~dp0'; $s.Description = 'ImmBiz Books Fullstack Application'; $s.Save()"

if exist "%SHORTCUT%" (
    echo [OK] Shortcut created successfully on your Desktop: "ImmBiz Books"
) else (
    echo [INFO] Could not create desktop shortcut automatically. You can right-click Run_ImmBiz_Books.bat and choose "Send to -> Desktop".
)

echo.
pause
