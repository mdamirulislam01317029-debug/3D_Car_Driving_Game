@echo off
setlocal
cd /d "%~dp0"
title HIGHWAY RUSH - 3D CAR DRIVING GAME
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required.
  echo Download and install Node.js from https://nodejs.org/ then run this file again.
  pause
  exit /b 1
)
if not exist node_modules\express (
  echo Installing game server packages for first run. Internet is required once...
  call npm install
  if errorlevel 1 (
    echo Package installation failed. Check internet connection and try again.
    pause
    exit /b 1
  )
)
if not exist node_modules\socket.io (
  echo Checking Socket.IO package...
  call npm install
  if errorlevel 1 (
    echo Package installation failed. Check internet connection and try again.
    pause
    exit /b 1
  )
)
start "HIGHWAY RUSH SERVER" /D "%~dp0" cmd /k npm start
timeout /t 3 /nobreak >nul
start "" http://localhost:3001
exit /b 0
