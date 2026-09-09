@echo off
setlocal
chcp 65001 >nul

where python.exe >nul 2>nul
if not errorlevel 1 (
  python.exe "%~dp0training-tool.py" %*
  exit /b %errorlevel%
)

set "TRAINING_CODEX_PY=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if exist "%TRAINING_CODEX_PY%" (
  "%TRAINING_CODEX_PY%" "%~dp0training-tool.py" %*
  exit /b %errorlevel%
)

echo [ERROR] Python runtime was not found. 1>&2
exit /b 1
