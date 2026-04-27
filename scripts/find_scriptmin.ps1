$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\script.min.js'
$c = [System.IO.File]::ReadAllText($f)
$i = $c.IndexOf('product')
Write-Host $c.Substring([Math]::Max(0,$i-50), 300)
