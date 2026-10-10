$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "===================================================" -ForegroundColor DarkGray
Write-Host "  gng-mfr-api - connects to alm.Menu on GNG_AI_Dev" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor DarkGray

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "`n[!] Created .env - open it and fill in DB_USER / DB_PASSWORD" -ForegroundColor Yellow
    Write-Host "    (use the same values you configured for the mssql-GNG database)." -ForegroundColor Yellow
    Write-Host "    Then run this file again.`n" -ForegroundColor Yellow
    Read-Host "Press Enter to close"
    exit 0
}

if (-not (Test-Path "node_modules")) {
    Write-Host "`n[1/3] First run - installing dependencies (npm install)..." -ForegroundColor Yellow
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "`nERROR: npm install failed. Check the output above." -ForegroundColor Red
        exit 1
    }
}

<#
  The .env connection is no longer the only database this API can reach - the
  user picks the server/database on the Login page instead, and .env is only
  the fallback for a request without a session. So a failed .env connection is
  worth reporting but must not stop the launcher: refusing to start would leave
  the user with no way to even reach the Login page and pick a server that
  *does* work.
#>
Write-Host "`n[2/3] Checking the fallback connection in .env..." -ForegroundColor DarkGray
$probe = & node (Join-Path $PSScriptRoot "db-check.js")

if ($probe -like "OK*") {
    Write-Host "      $probe" -ForegroundColor Green
} else {
    Write-Host "      $probe" -ForegroundColor Yellow
    Write-Host "      That is only the fallback connection; choose your server on the" -ForegroundColor Yellow
    Write-Host "      Login page once the app opens." -ForegroundColor Yellow
}

function Test-Port($port) {
    return [bool](Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

<#
  Stop whatever is listening on the API port, and wait for it to let go.

  This backend does not reload its own code, so leaving a previous run alone
  quietly meant "answering with yesterday's build". Restarting every time is
  what makes running this file after a change reliable.
#>
function Stop-Port($port, $label) {
    $ids = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
           Select-Object -ExpandProperty OwningProcess -Unique
    if (-not $ids) { return $true }

    Write-Host "      Stopping the $label already on port $port..." -ForegroundColor DarkGray
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

$apiFree = Stop-Port 4311 "gng-mfr-api"
if (-not $apiFree) {
    Write-Host ""
    Write-Host "  A previous gng-mfr-api could not be stopped from here." -ForegroundColor Red
    Write-Host "  Close its console window yourself, then run this file again." -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to close"
    exit 1
}

Write-Host "`n[3/3] Starting API at http://localhost:4311`n" -ForegroundColor Green
Write-Host "      (listens on all network interfaces, port 4311 - used by the frontend on 4400)`n" -ForegroundColor DarkGray
npm start
