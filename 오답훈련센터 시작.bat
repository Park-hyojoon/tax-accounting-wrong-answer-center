@echo off
setlocal
set "HERE=%~dp0"

rem Start the local sync helper without relying on Korean command text.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HERE%start-sync-helper.ps1"
if errorlevel 1 (
    echo Could not start the local sync helper. Please try again.
    timeout /t 5 >nul
)

rem Open the ASCII-named redirect page in the default browser.
if /I not "%~1"=="--helper-only" start "" "%HERE%index.html"

endlocal
exit /b
