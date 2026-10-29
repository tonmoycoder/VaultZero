param(
    [Parameter(Mandatory=$false)]
    [string]$TagName = ""
)

$ErrorActionPreference = "Stop"

if (-not $TagName) {
    $latestTag = git describe --tags --abbrev=0
    if (-not $latestTag) {
        Write-Error "No git tags found to rollback to."
        exit 1
    }
    $TagName = $latestTag
}

Write-Host "Rolling back to tag: $TagName"
git reset --hard "$TagName"
git clean -fd
Write-Host "Rolled back to $TagName cleanly."
