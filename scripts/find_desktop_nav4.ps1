$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Find the desktop nav map join and what follows it
$pat = 'getElementById("desktop-nav"),n=document.getElementById("mobile-nav")'
$i = $c.IndexOf($pat)
# Get a bigger chunk to find where desktop innerHTML assignment ends
Write-Host "=== 800 chars starting from desktop-nav getElement ==="
Write-Host $c.Substring($i, 800)
