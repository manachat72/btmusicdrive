@echo off
REM ASCII only on purpose (see start-studio.bat).
REM LINE bot on Vercel -> https://ai.btmusicdrive.com -> Cloudflare Tunnel "bt-ai"
REM   -> scripts\ollama-gateway.js (127.0.0.1:11435) -> llama.cpp (127.0.0.1:8080)
REM Started hidden at logon by Task Scheduler task "BT AI Gateway".
REM Logs: %LOCALAPPDATA%\bt-ai\gateway.log + tunnel.log and %USERPROFILE%\llama.cpp\logs\hermes-router.log
cd /d "%~dp0"
set LOGDIR=%LOCALAPPDATA%\bt-ai
if not exist "%LOGDIR%" mkdir "%LOGDIR%"

REM Start the llama.cpp router first. It remains localhost-only for the bot path.
set LLAMA_HOME=%USERPROFILE%\llama.cpp
netstat -an | findstr /c:"LISTENING" | findstr /c:"127.0.0.1:8080 " >nul
if errorlevel 1 start "" /b cmd.exe /c call "%LLAMA_HOME%\start-hermes-router-background.bat"

REM Already running? Don't start a second gateway copy.
netstat -an | findstr /c:"LISTENING" | findstr /c:"127.0.0.1:11435 " >nul
if not errorlevel 1 exit /b 0

set "CF=%ProgramFiles(x86)%\cloudflared\cloudflared.exe"
if not exist "%CF%" set "CF=cloudflared"

REM Tunnel reconnects by itself; run it in this same (hidden) console.
start "" /b "%CF%" tunnel --loglevel warn --logfile "%LOGDIR%\tunnel.log" run bt-ai

REM Restart the gateway if it ever exits.
:loop
node scripts\ollama-gateway.js >> "%LOGDIR%\gateway.log" 2>&1
timeout /t 5 /nobreak >nul
goto loop
