$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Find the end of desktop nav map - after t.innerHTML=...join("") for desktop
# t is desktop-nav, find what comes right after the desktop innerHTML assignment ends
$pat = 'getElementById("desktop-nav"),n=document.getElementById("mobile-nav")'
$i = $c.IndexOf($pat)
# Now find the next occurrence of 'if(n)' after this position
$i2 = $c.IndexOf('if(n)', $i)
Write-Host "=== Around if(n) (mobile check) ==="
Write-Host $c.Substring([Math]::Max(0,$i2-100), 200)
