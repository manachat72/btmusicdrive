$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

$pat = 'getElementById("desktop-nav"),n=document.getElementById("mobile-nav")'
$i = $c.IndexOf($pat)
# Get 2000 chars to find the full desktop nav assignment
Write-Host $c.Substring($i, 2000)
