$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$cmpUrl = $env:CMP_COMPANY_URL
if ([string]::IsNullOrWhiteSpace($cmpUrl)) {
  $cmpUrl = "https://cmp-front.production.united-fuel.com/company"
}

$env:CMP_INPUT_MODE = "zoho_sheet"
$env:CMP_ZOHO_SHEET_NAME = "CS by Agent"
$env:CMP_USER_DATA_DIR = "C:\Users\AndresMendez\AppData\Local\Google\Chrome\User Data"
$env:CMP_PROFILE_DIR = "Profile 8"
$env:CMP_CLONE_PROFILE = "false"
$env:CMP_HEADLESS = "false"
$env:CMP_REQUIRE_EXACT_PROFILE = "false"
$env:CMP_DEBUGGER_ADDRESS = ""
$env:CMP_HEADLESS = "false"
$env:CMP_SEARCH_SETTLE_SECONDS = "3.5"
$env:CMP_SEARCH_MAX_WAIT_SECONDS = "16"
$env:CMP_SEARCH_KEYSTROKE_DELAY = "0.08"
$env:CMP_DEBUG_NOT_FOUND = "true"
$env:CMP_ATTACH_TIMEOUT_SECONDS = "60"

# Auto-launch a dedicated Chrome window with remote debugging enabled so Selenium can attach reliably.
# This keeps the browser visible (and interactive) but we start it minimized so it doesn't steal focus.
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
if (-not (Test-Path $chromePath)) {
  $chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
}

if (Test-Path $chromePath) {
  $args = @(
    "--remote-debugging-port=9222",
    "--user-data-dir=$env:CMP_USER_DATA_DIR",
    "--profile-directory=$env:CMP_PROFILE_DIR",
    "--no-first-run",
    "--no-default-browser-check",
    $cmpUrl
  )
  try {
    Start-Process -FilePath $chromePath -ArgumentList $args -WindowStyle Minimized | Out-Null
    Start-Sleep -Seconds 3
  } catch {
    Write-Host "WARNING: Failed to launch Chrome for debugging. Will try to attach if an existing session is available."
  }
} else {
  Write-Host "WARNING: Chrome executable not found. Will try to attach if an existing session is available."
}

$env:CMP_DEBUGGER_ADDRESS = "localhost:9222"
python .\automation\cmp_invoice_extractor.py

# If the first attempt failed to attach (port not ready), wait a bit and retry once.
if ($LASTEXITCODE -ne 0) {
  Start-Sleep -Seconds 5
  python .\automation\cmp_invoice_extractor.py
}
