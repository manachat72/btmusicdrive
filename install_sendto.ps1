# install_sendto.ps1
# ติดตั้ง shortcut "btmusicdrive" ใน Send To menu ของ Windows
# วิธีใช้: คลิกขวาที่ไฟล์นี้ใน Explorer -> Run with PowerShell
#         หรือ:  powershell -ExecutionPolicy Bypass -File install_sendto.ps1

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$UploadScript = Join-Path $ProjectRoot "upload_images.py"
$SendToDir = [Environment]::GetFolderPath("SendTo")  # %APPDATA%\Microsoft\Windows\SendTo
$ShortcutPath = Join-Path $SendToDir "btmusicdrive (เพิ่มรูปสินค้า).lnk"

# หา pythonw.exe (ใช้ pythonw แทน python เพื่อไม่ให้มีหน้าต่าง CMD ค้าง)
$PythonW = $null
$candidates = @("pythonw.exe", "python.exe")
foreach ($name in $candidates) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd) { $PythonW = $cmd.Source; break }
}
if (-not $PythonW) {
    Write-Host "ไม่พบ Python ใน PATH — โปรดติดตั้ง Python ก่อน" -ForegroundColor Red
    exit 1
}

# สร้าง shortcut ผ่าน WScript.Shell COM object
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($ShortcutPath)
$sc.TargetPath = $PythonW
$sc.Arguments = "`"$UploadScript`""
$sc.WorkingDirectory = $ProjectRoot
$sc.IconLocation = "$env:SystemRoot\System32\imageres.dll,108"  # ไอคอนรูปภาพ
$sc.Description = "อัปโหลดรูปสินค้าไป btmusicdrive"
$sc.Save()

Write-Host ""
Write-Host "ติดตั้งสำเร็จ!" -ForegroundColor Green
Write-Host "Shortcut: $ShortcutPath"
Write-Host ""
Write-Host "วิธีใช้:" -ForegroundColor Yellow
Write-Host "  1. เลือกไฟล์รูปใน Windows Explorer (เลือกหลายไฟล์ได้ ด้วย Ctrl/Shift)"
Write-Host "  2. คลิกขวา -> Send To -> btmusicdrive (เพิ่มรูปสินค้า)"
Write-Host "  3. หน้าโปรแกรมจะเปิดพร้อมรูปที่เลือก — แค่เลือกสินค้าแล้วกดอัปโหลด"
Write-Host ""
Write-Host "ลบ shortcut: ลบไฟล์ที่ $ShortcutPath" -ForegroundColor Gray
