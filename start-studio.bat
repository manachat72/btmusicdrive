@echo off
REM ASCII only on purpose: cmd.exe tracks batch files by byte offset, so Thai
REM text (multibyte) plus a mid-file "chcp" corrupts parsing of later lines.
title Product Studio - BT Music Drive
cd /d "%~dp0"

if "%PORT%"=="" set PORT=4777

REM Already running? Just open the browser instead of a second server.
netstat -an | findstr /c:"LISTENING" | findstr /c:":%PORT% " >nul
if not errorlevel 1 (
    start "" http://localhost:%PORT%
    exit /b 0
)

echo.
echo   ==========================================
echo    Product Studio  -  BT Music Drive
echo   ==========================================
echo.
echo   Starting server... the browser will open automatically.
echo   Close this window to stop Product Studio.
echo.

REM Give the server a moment before opening the browser.
REM No nested quotes here: the URL has no spaces, so "start <url>" is unambiguous.
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%"

REM Run node directly (not via "npm run"): npm.cmd adds an extra process layer,
REM so closing this window could leave an orphan node holding the port.
REM As a direct child, node dies with the console when you click the X.
node scripts\listing-studio.js

echo.
echo   Product Studio stopped - press any key to close.
pause >nul
