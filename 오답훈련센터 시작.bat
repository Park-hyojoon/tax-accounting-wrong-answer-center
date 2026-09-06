@echo off
chcp 65001 >nul
setlocal
set "HERE=%~dp0"

rem 1) PC 동기화 도우미를 켠다. 이미 켜져 있으면 조용히 끝난다.
where pythonw.exe >nul 2>&1
if not errorlevel 1 (
    start "" /min pythonw.exe "%HERE%sync-helper.py"
) else (
    where pyw.exe >nul 2>&1
    if not errorlevel 1 (
        start "" /min pyw.exe -3 "%HERE%sync-helper.py"
    ) else (
        echo Python을 찾지 못해 PC 동기화 도우미를 켜지 못했습니다. 학습 화면은 그대로 열립니다.
        timeout /t 4 >nul
    )
)

rem 2) 오답 훈련센터 홈을 연다. Chrome이 없으면 기본 브라우저로 연다.
start "" chrome.exe "%HERE%오답_훈련센터.html" 2>nul || start "" "%HERE%오답_훈련센터.html"

endlocal
exit /b
