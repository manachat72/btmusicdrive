$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Look for where desktop innerHTML ends - find the join('') after the map for desktop
# In minified: something like e.innerHTML=menus.map(...).join("")
# Then "if(n)" starts the mobile section
$patterns = @(
    '.join("")',
    'join("")',
    'join(``)',
    'e.innerHTML'
)
foreach ($p in $patterns) {
    $idx = $c.IndexOf($p)
    if ($idx -gt 0) {
        Write-Host "=== Found '$p' at $idx ==="
        Write-Host $c.Substring([Math]::Max(0,$idx-20), 200)
        Write-Host ""
    }
}

# Find the desktop nav variable assignment context more specifically
# Look for "if(n)" which follows the desktop nav rendering
$i = $c.IndexOf('if(n){n.innerHTML')
Write-Host "=== if(n){n.innerHTML context ==="
Write-Host $c.Substring([Math]::Max(0,$i-100), 300)
