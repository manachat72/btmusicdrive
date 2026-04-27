$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\script.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Find /product/ URL building
$i = $c.IndexOf('/product/')
if ($i -gt 0) {
    Write-Host "=== /product/ context ==="
    Write-Host $c.Substring([Math]::Max(0,$i-80), 300)
} else {
    Write-Host "No /product/ found"
}

# Find slug usage
$i2 = $c.IndexOf('.slug')
if ($i2 -gt 0) {
    Write-Host "=== .slug context ==="
    Write-Host $c.Substring([Math]::Max(0,$i2-80), 300)
} else {
    Write-Host "No .slug found"
}
