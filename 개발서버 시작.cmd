@echo off
title 국어 스튜디오 개발 서버
cd /d "%~dp0"
set "NODE="
where node >nul 2>nul && set "NODE=node"
if not defined NODE if exist "%USERPROFILE%\.aside\runtime\node\node.exe" set "NODE=%USERPROFILE%\.aside\runtime\node\node.exe"
if not defined NODE if exist "C:\Program Files\nodejs\node.exe" set "NODE=C:\Program Files\nodejs\node.exe"
if not defined NODE (
  echo [오류] Node.js를 찾지 못했습니다.
  echo https://nodejs.org 에서 LTS 버전을 설치한 뒤 다시 실행하세요.
  echo 서버 없이 보려면 같은 폴더의 국어스튜디오.html 을 더블클릭하세요.
  pause
  exit /b 1
)
echo 사용하는 Node: %NODE%
echo 서버를 켜는 중입니다. 2초 뒤 브라우저가 열립니다.
echo 이 창을 닫으면 서버가 꺼집니다.
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:5178/"
"%NODE%" dev-server.js
echo.
echo 서버가 종료되었습니다. 위 메시지를 확인하세요. (기록: dev-server.log)
pause