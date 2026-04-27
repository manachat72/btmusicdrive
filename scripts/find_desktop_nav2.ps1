$f = 'C:\Users\manac\.windsurf\worktrees\btmusicdrive\btmusicdrive-0cd42f8a\components.min.js'
$c = [System.IO.File]::ReadAllText($f)

# Find the _renderNavMenus function - look for where desktop variable is set and innerHTML assigned
# In source: desktop.innerHTML = menus.map(...).join('')
# Then: if (_IS_LIVE_SERVER && desktop) _patchLinks(desktop);
# Then: if (mobile) {

# Look for the pattern where desktop nav innerHTML ends and mobile starts
# Search for the pattern: e.join("") or similar followed by mobile section
$pat = 'getElementById("desktop-nav")'
$i = $c.IndexOf($pat)
Write-Host "=== desktop-nav getElementById context ==="
Write-Host $c.Substring([Math]::Max(0,$i-10), 500)
