@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo [1/2] Building Yuimi Lab...
call npm run build
if errorlevel 1 (
  echo.
  echo Build failed. The development server was not started.
  pause
  exit /b 1
)

echo.
echo [2/2] Starting the local development server...
echo Home:   http://127.0.0.1:4321/
echo Kisara: http://127.0.0.1:4321/themes/kisara/
echo Press Ctrl+C to stop the server.
echo.

call npm run dev -- --host 127.0.0.1
set "EXIT_CODE=%ERRORLEVEL%"
endlocal & exit /b %EXIT_CODE%
