$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$ErrorActionPreference = "Stop"

if (-not $env:CMP_INVOICING_URL) { $env:CMP_INVOICING_URL = "https://cmp-front.production.united-fuel.com/invoicing?page=1&limit=500" }
if (-not $env:CMP_ZOHO_SHEET_NAME) { $env:CMP_ZOHO_SHEET_NAME = "Client BY agent" }
if (-not $env:CMP_USER_DATA_DIR) { $env:CMP_USER_DATA_DIR = Join-Path $root "automation\chrome_user_data" }
if (-not $env:CMP_PROFILE_DIR) { $env:CMP_PROFILE_DIR = "Default" }
if (-not $env:CMP_CLONE_PROFILE) { $env:CMP_CLONE_PROFILE = "false" }
if (-not $env:CMP_HEADLESS) { $env:CMP_HEADLESS = "false" }
if (-not $env:CMP_REQUIRE_EXACT_PROFILE) { $env:CMP_REQUIRE_EXACT_PROFILE = "true" }
if (-not $env:CMP_HISTORY_DAYS) { $env:CMP_HISTORY_DAYS = "60" }
if (-not $env:CMP_MAX_PAGES) { $env:CMP_MAX_PAGES = "40" }
if (-not $env:CMP_ATTACH_TIMEOUT_SECONDS) { $env:CMP_ATTACH_TIMEOUT_SECONDS = "60" }
# Set to "true" if you want to see the Chrome window while scraping (debug).
# Default is hidden/minimized so you can keep working.
if (-not $env:CMP_SHOW_BROWSER) { $env:CMP_SHOW_BROWSER = "true" }

if (-not $env:CMP_INGEST_URL) {
  $env:CMP_INGEST_URL = "http://127.0.0.1:3001/api/cmp/ingest"
}

# No longer killing all chrome processes to avoid disrupting the user.
# Chrome will run in an isolated user data directory, so it won't conflict with existing sessions.

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (Test-Path $chromePath) {
  # PASSING ARGUMENTS AS AN ARRAY:
  # PowerShell's Start-Process automatically quotes arguments with spaces when passed as an array.
  # This prevents quoting bugs when passing to Windows API.
  $args = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$env:CMP_USER_DATA_DIR",
    "--profile-directory=$env:CMP_PROFILE_DIR",
    "--no-first-run",
    "--no-default-browser-check",
    ($(if ($env:CMP_SHOW_BROWSER -eq "true") { "--window-position=20,20" } else { "--window-position=2000,2000" })),
    $env:CMP_INVOICING_URL
  )
  try {
    $winStyle = if ($env:CMP_SHOW_BROWSER -eq "true") { "Normal" } else { "Minimized" }
    Start-Process -FilePath $chromePath -ArgumentList $args -WindowStyle $winStyle | Out-Null
    Start-Sleep -Seconds 5
  } catch {
    Write-Host "WARNING: Could not launch Chrome. Will try attaching to an existing session."
  }
} else {
  Write-Host "WARNING: Chrome not found. Will try attaching to port 9222."
}

$env:CMP_DEBUGGER_ADDRESS = "localhost:9222"

# Wait until Chrome remote debugging is reachable
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
  try {
    Invoke-WebRequest -Uri "http://127.0.0.1:9222/json/version" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $ready = $true
    break
  } catch {
    Start-Sleep -Seconds 1
  }
}
if (-not $ready) {
  Write-Host "ERROR: Chrome debugger on port 9222 is not ready."
  Write-Host "Tip: Make sure Chrome is fully closed and that Profile 8 can launch. Then run Sync All again."
  exit 2
}

python .\automation\cmp_invoice_extractor.py

if ($LASTEXITCODE -ne 0) {
  Start-Sleep -Seconds 5
  python .\automation\cmp_invoice_extractor.py
}

exit $LASTEXITCODE
