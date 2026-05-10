$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$env:CMP_INPUT_MODE = "zoho_sheet"
$env:CMP_ZOHO_SHEET_NAME = "CS by Agent"
$env:CMP_USER_DATA_DIR = "C:\Users\AndresMendez\AppData\Local\Google\Chrome\User Data"
$env:CMP_PROFILE_DIR = "Profile 8"
$env:CMP_CLONE_PROFILE = "false"
$env:CMP_REQUIRE_EXACT_PROFILE = "true"
$env:CMP_HEADLESS = "false"
$env:CMP_SEARCH_SETTLE_SECONDS = "3.5"
$env:CMP_SEARCH_MAX_WAIT_SECONDS = "16"
$env:CMP_SEARCH_KEYSTROKE_DELAY = "0.08"
$env:CMP_DEBUG_NOT_FOUND = "true"

Write-Host "Running CMP extractor with Profile 8..."
Write-Host "Closing Chrome processes to avoid profile lock..."
taskkill /IM chrome.exe /F | Out-Null
Start-Sleep -Seconds 1
python .\automation\cmp_invoice_extractor.py
