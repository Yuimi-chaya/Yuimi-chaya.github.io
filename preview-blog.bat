@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

node "node_modules\astro\bin\astro.mjs" dev status | findstr /C:"Dev server running at" >nul
if not errorlevel 1 (
  echo A preview for this project is already running:
  node "node_modules\astro\bin\astro.mjs" dev status
  echo.
  pause
  endlocal & exit /b 0
)

echo Starting the local development server...
echo Use the Local URL printed by Astro below.
echo.

call npm run dev -- --host 127.0.0.1 --port 4321
set "EXIT_CODE=%ERRORLEVEL%"
echo.
if not "%EXIT_CODE%"=="0" echo The preview stopped with exit code %EXIT_CODE%.
if "%EXIT_CODE%"=="0" echo The preview has stopped.
pause
endlocal & exit /b %EXIT_CODE%
