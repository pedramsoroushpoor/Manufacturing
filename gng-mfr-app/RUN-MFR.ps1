$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "===================================================" -ForegroundColor DarkGray
Write-Host "  GNG Production Management System - dev prototype" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor DarkGray

if (-not (Test-Path "node_modules")) {
    Write-Host "`n[1/2] First run - installing dependencies (npm install)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: npm install failed. Check the output above." -ForegroundColor Red
        exit 1
    }
}

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

<#
  Stop whatever is listening on the front-end port, and wait for it to let go.

  A previous "ng serve" left running quietly meant this file opening a browser
  tab against yesterday's build (or failing outright with "port already in
  use"). Restarting every time is what makes double-clicking this file
  reliable after a change.
#>
function Stop-Port($port, $label) {
    $ids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
           Select-Object -ExpandProperty OwningProcess -Unique
    if (-not $ids) { return $true }

    Write-Host "`nStopping the $label already on port $port..." -ForegroundColor DarkGray
    foreach ($processId in $ids) {
        # taskkill writes refusals to stderr, which $ErrorActionPreference='Stop'
        # would turn into a thrown error and end the launcher. A process we are
        # not allowed to kill is a message to the user, not a crash.
        $previous = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & taskkill.exe /PID $processId /T /F 2>&1 | Out-Null
        $ErrorActionPreference = $previous
    }
    for ($i = 0; $i -lt 20; $i++) {
        if (-not (Test-Port $port)) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

$frontendFree = Stop-Port 4400 "GNG frontend"
if (-not $frontendFree) {
    Write-Host ""
    Write-Host "  A previous GNG frontend could not be stopped from here." -ForegroundColor Red
    Write-Host "  Close its console window yourself, then run this file again." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "`n[2/2] Starting app..." -ForegroundColor Green
Write-Host "      On this computer:  http://localhost:4400"
Write-Host "      From other computers on the same network: http://$($env:COMPUTERNAME):4400"
Write-Host "      (or use this computer's IP address instead of the name - run 'ipconfig' to find it)"
Write-Host "      (port 4200 is reserved for the ALM app, not used here)"
Write-Host "      A Login page opens first - choose the SQL Server and database yourself there.`n"

npm start
