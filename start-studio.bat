@echo off
chcp 65001 >nul
title Product Studio - BT Music Drive
cd /d "%~dp0"

echo.
echo   ==========================================
echo    Product Studio  -  BT Music Drive
echo   ==========================================
echo.
echo   กำลังเปิดเซิร์ฟเวอร์... เบราว์เซอร์จะเด้งขึ้นมาเอง
echo   ปิดหน้าต่างนี้ = ปิด Studio
echo.

REM เปิดเบราว์เซอร์หลังเซิร์ฟเวอร์ตั้งตัวได้ (พอร์ตแก้ได้ด้วย set PORT=4788)
if "%PORT%"=="" set PORT=4777
start "" /b cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:%PORT%"

call npm run mkt:studio

echo.
echo   Studio ปิดแล้ว - กดปุ่มใดก็ได้เพื่อปิดหน้าต่าง
pause >nul
