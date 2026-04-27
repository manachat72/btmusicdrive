$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)
$i = $c.IndexOf('admin-nav-link-mobile')
Write-Host "=== admin-nav-link-mobile context ==="
Write-Host $c.Substring([Math]::Max(0,$i-80), 350)
Write-Host ""
$i2 = $c.IndexOf('_subMenuBound')
Write-Host "=== _subMenuBound context ==="
Write-Host $c.Substring([Math]::Max(0,$i2-40), 250)
