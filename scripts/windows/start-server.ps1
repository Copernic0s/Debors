[CmdletBinding()]
param(
  [string]$ApiBaseUrl = 'http://127.0.0.1:3001',
  [int]$StartupTimeoutSeconds = 30,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$serverScript = Join-Path $projectRoot 'server\server.js'
$logsDirectory = Join-Path $projectRoot 'logs'
$healthUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/health"
. (Join-Path $PSScriptRoot 'sync-helpers.ps1')
if (-not $EnvFile) { $EnvFile = [Environment]::GetEnvironmentVariable('DEBORS_ENV_FILE', 'Process') }
if (-not $EnvFile) { $EnvFile = Join-Path $projectRoot '.env' }
if (-not [System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile = Join-Path $projectRoot $EnvFile }
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)

function Test-DeborsServerHealth {
  try {
    $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 2
    return $health.ok -eq $true
  } catch {
    return $false
  }
}

if (Test-DeborsServerHealth) {
  Write-Output 'Debors API is already healthy.'
  exit 0
}

New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
$mutex = New-Object System.Threading.Mutex($false, 'Local\DeborsServerStart')
$lockTaken = $false
try {
  $lockTaken = $mutex.WaitOne([TimeSpan]::FromSeconds(15))
  if (-not $lockTaken) { throw 'Timed out waiting for the Debors server startup lock.' }

  if (Test-DeborsServerHealth) {
    Write-Output 'Debors API became healthy while waiting for startup lock.'
    exit 0
  }

  [void](Import-DeborsEnvironment -EnvFile $EnvFile)

  $existing = @()
  try {
    $existing = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction Stop |
      Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($serverScript, [StringComparison]::OrdinalIgnoreCase) -ge 0 }
  } catch {
    $existing = @()
  }
  if ($existing.Count -gt 0) {
    Write-Output 'Debors server process already exists; waiting for health without starting a duplicate.'
  } else {
    try {
      $port = ([Uri]$ApiBaseUrl).Port
      $listener = Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue
      if ($listener) { throw "Port $port is already owned by another listener; refusing to start a duplicate server." }
    } catch {
      if ($_.Exception.Message -like 'Port * is already owned*') { throw }
    }

    $node = Get-Command node.exe -ErrorAction Stop
    if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) {
      throw "Debors server entrypoint not found: $serverScript"
    }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $stdoutLog = Join-Path $logsDirectory "server-$stamp.log"
    $stderrLog = Join-Path $logsDirectory "server-$stamp-error.log"
    $serverArguments = '"' + $serverScript + '"'
    Start-Process -FilePath $node.Source `
      -ArgumentList $serverArguments `
      -WorkingDirectory $projectRoot `
      -WindowStyle Hidden `
      -RedirectStandardOutput $stdoutLog `
      -RedirectStandardError $stderrLog | Out-Null
    Write-Output "Started Debors server. Log: $stdoutLog"
  }
} finally {
  if ($lockTaken) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}

$deadline = [DateTime]::UtcNow.AddSeconds($StartupTimeoutSeconds)
while ([DateTime]::UtcNow -lt $deadline) {
  if (Test-DeborsServerHealth) {
    Write-Output 'Debors API is healthy.'
    exit 0
  }
  Start-Sleep -Seconds 1
}
throw "Debors API did not become healthy within $StartupTimeoutSeconds seconds. Check logs/server-*.log."
