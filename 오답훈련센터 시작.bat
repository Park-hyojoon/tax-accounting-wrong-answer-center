@echo off
chcp 65001 >nul
setlocal
set "HERE=%~dp0"

rem 1) PC 동기화 도우미를 숨김 창으로 켠다.
rem    일반 Python이 없어도 Codex에 포함된 Python을 자동으로 찾는다.
powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HERE%동기화도우미 시작.ps1"
if errorlevel 1 (
    echo PC 동기화 도우미를 켜지 못했습니다. 잠시 후 다시 실행해 주세요.
    timeout /t 5 >nul
)

rem 2) 오답 훈련센터 홈을 연다. Chrome이 없으면 기본 브라우저로 연다.
start "" chrome.exe "%HERE%오답_훈련센터.html" 2>nul || start "" "%HERE%오답_훈련센터.html"

endlocal
exit /b
