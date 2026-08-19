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
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start "" http://localhost:%PORT%"

call npm run mkt:studio

echo.
echo   Product Studio stopped - press any key to close.
pause >nul
