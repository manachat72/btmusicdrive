@echo off
chcp 65001 >nul
title Product Studio - BT Music Drive
cd /d "%~dp0"

if "%PORT%"=="" set PORT=4777

REM เปิดอยู่แล้ว? เด้งไปหน้าเดิมเลย ไม่ต้องเปิดซ้ำ (กัน EADDRINUSE)
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
echo   กำลังเปิดเซิร์ฟเวอร์... เบราว์เซอร์จะเด้งขึ้นมาเอง
echo   ปิดหน้าต่างนี้ = ปิด Studio
echo.

REM รอเซิร์ฟเวอร์ตั้งตัวแล้วค่อยเด้งเบราว์เซอร์
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start """" http://localhost:%PORT%"

call npm run mkt:studio

echo.
echo   Studio ปิดแล้ว - กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง
pause >nul
