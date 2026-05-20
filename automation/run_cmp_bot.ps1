$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$ErrorActionPreference = "Stop"

$env:CMP_INVOICING_URL = "https://cmp-front.production.united-fuel.com/invoicing?page=1&limit=500"
$env:CMP_ZOHO_SHEET_NAME = "Client BY agent"
$env:CMP_USER_DATA_DIR = "C:\Users\AndresMendez\AppData\Local\Google\Chrome\User Data"
$env:CMP_PROFILE_DIR = "Profile 8"
$env:CMP_CLONE_PROFILE = "false"
$env:CMP_HEADLESS = "false"
$env:CMP_REQUIRE_EXACT_PROFILE = "true"
$env:CMP_HISTORY_DAYS = "60"
$env:CMP_MAX_PAGES = "40"
$env:CMP_ATTACH_TIMEOUT_SECONDS = "60"
# Set to "true" if you want to see the Chrome window while scraping (debug).
# Default is hidden/minimized so you can keep working.
if (-not $env:CMP_SHOW_BROWSER) { $env:CMP_SHOW_BROWSER = "false" }

if (-not $env:CMP_INGEST_URL) {
  $env:CMP_INGEST_URL = "http://127.0.0.1:3001/api/cmp/ingest"
}

# If Chrome is already running, launching a new window will be attached to the existing
# process and Chrome will ignore flags like --remote-debugging-port. That makes Selenium
# unable to attach (9222 not reachable). We aggressively close Chrome first.
try {
  Get-Process chrome -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
} catch {
  # ignore
}

$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (Test-Path $chromePath) {
  # IMPORTANT: Start-Process ultimately receives a single command-line string.
  # If we pass args that contain spaces without quoting (e.g. "User Data", "Profile 8"),
  # Chrome will parse them incorrectly and may open the wrong profile (which looks logged out).
  $args = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=`"$env:CMP_USER_DATA_DIR`"",
    "--profile-directory=`"$env:CMP_PROFILE_DIR`"",
    "--no-first-run",
    "--no-default-browser-check",
    ($(if ($env:CMP_SHOW_BROWSER -eq "true") { "--window-position=20,20" } else { "--window-position=2000,2000" })),
    "`"$env:CMP_INVOICING_URL`""
  ) -join " "
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
