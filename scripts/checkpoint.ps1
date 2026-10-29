param(
    [Parameter(Mandatory=$true)]
    [string]$TagName,
    [Parameter(Mandatory=$true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"

Write-Host "Creating checkpoint: $TagName - $Message"
git add -A
git commit -m "$Message"
git tag -f "$TagName"
Write-Host "Checkpoint $TagName created successfully."

