$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Find desktop nav end (after desktop innerHTML is set)
$i = $c.IndexOf('desktop-nav')
Write-Host "=== desktop-nav context (first 400 chars) ==="
Write-Host $c.Substring([Math]::Max(0,$i-10), 400)
Write-Host ""

# Find logout navigation
$i2 = $c.IndexOf("location.href='/'")
if ($i2 -lt 0) { $i2 = $c.IndexOf('location.href="/"') }
Write-Host "=== logout href context ==="
Write-Host $c.Substring([Math]::Max(0,$i2-60), 200)
Write-Host ""

# Find search navigation
$i3 = $c.IndexOf('/shop?search=')
Write-Host "=== search nav context ==="
Write-Host $c.Substring([Math]::Max(0,$i3-80), 200)
