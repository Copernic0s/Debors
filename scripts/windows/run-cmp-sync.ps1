[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('fast', 'normal', 'deep')][string]$Depth,
  [int]$TimeoutMinutes = 55,
  [string]$ApiBaseUrl = 'http://127.0.0.1:3001',
  [int]$PollSeconds = 10,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$logsDirectory = Join-Path $projectRoot 'logs'
$flagPath = Join-Path $logsDirectory 'cmp-session-expired.flag'
. (Join-Path $PSScriptRoot 'sync-helpers.ps1')

New-Item -ItemType Directory -Path $logsDirectory -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$script:RunLog = Join-Path $logsDirectory "cmp-sync-$stamp.log"

function Write-RunLog {
  param([string]$Message)
  $line = "[$([DateTime]::Now.ToString('s'))] $Message"
  Add-Content -LiteralPath $script:RunLog -Value $line -Encoding UTF8
  Write-Output $line
}

function Send-FailureNotification {
  param([string]$Reason)
  $webhook = [Environment]::GetEnvironmentVariable('NOTIFY_WEBHOOK_URL', 'Process')
  if (-not $webhook) { return }

  $payload = @{ event = 'cmp_sync_failed'; reason = $Reason; depth = $Depth; at = [DateTime]::UtcNow.ToString('o') } |
    ConvertTo-Json -Compress
  try {
    Invoke-RestMethod -Uri $webhook -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 10 | Out-Null
    Write-RunLog 'Failure notification sent.'
  } catch {
    Write-RunLog 'Failure notification could not be delivered.'
  }
}

function Stop-WithFailure {
  param([string]$Reason, [string]$Message, [switch]$SessionFailure)
  if ($SessionFailure) { Write-CmpSessionExpiredFlag -FlagPath $flagPath -Reason $Reason }
  Write-RunLog "$Message (reason=$Reason)."
  Send-FailureNotification -Reason $Reason
  exit 1
}

if (Test-CmpScheduledRunBlocked -FlagPath $flagPath) {
  Write-RunLog 'Scheduled CMP sync blocked by cmp-session-expired.flag. Complete a manual Sync All or remove the flag to resume.'
  exit 2
}

if (-not $EnvFile) { $EnvFile = [Environment]::GetEnvironmentVariable('DEBORS_ENV_FILE', 'Process') }
if (-not $EnvFile) {
  $candidate = Join-Path $projectRoot '.env'
  if (Test-Path -LiteralPath $candidate -PathType Leaf) {
    $EnvFile = $candidate
  } else {
    $fallback = Join-Path (Split-Path -Parent $projectRoot) 'Debors\.env'
    if (Test-Path -LiteralPath $fallback -PathType Leaf) {
      $EnvFile = $fallback
    } else {
      $EnvFile = $candidate
    }
  }
}
if (-not [System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile = Join-Path $projectRoot $EnvFile }
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)
[void](Import-DeborsEnvironment -EnvFile $EnvFile)

$healthUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/health"
$statusUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/cmp/status"
$runUrl = "$($ApiBaseUrl.TrimEnd('/'))/api/cmp/run"

try {
  $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3
} catch {
  Write-RunLog 'API is unavailable; invoking start-server.ps1.'
  try {
  & (Join-Path $PSScriptRoot 'start-server.ps1') -ApiBaseUrl $ApiBaseUrl -EnvFile $EnvFile
  } catch {
    Stop-WithFailure -Reason 'server_unavailable' -Message 'Could not start the Debors API'
  }
  $health = $null
  $healthDeadline = [DateTime]::UtcNow.AddSeconds(45)
  while ([DateTime]::UtcNow -lt $healthDeadline) {
    try { $health = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 3; break } catch { Start-Sleep -Seconds 2 }
  }
}

if (-not $health -or $health.ok -ne $true) {
  Stop-WithFailure -Reason 'server_unavailable' -Message 'Debors API did not become healthy'
}
if ($health.cmpIngestSecret -ne $true) {
  Stop-WithFailure -Reason 'cmp_secret_missing' -Message 'CMP ingest secret is not configured in the server environment'
}

try {
  $status = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 5
} catch {
  Stop-WithFailure -Reason 'status_unavailable' -Message 'Could not read CMP runner status'
}
if ($status.running -eq $true) {
  Write-RunLog "CMP run already active (run_id=$($status.runId)); not starting another run."
  exit 3
}

try {
  $body = @{ depth = $Depth; trigger = 'scheduled' } | ConvertTo-Json -Compress
  $started = Invoke-RestMethod -Uri $runUrl -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 10
} catch {
  Stop-WithFailure -Reason 'start_request_failed' -Message 'CMP run request was rejected'
}
$runId = [string]$started.runId
if (-not $runId) {
  Stop-WithFailure -Reason 'missing_run_id' -Message 'CMP start response did not include a run id'
}
Write-RunLog "Started scheduled CMP run (depth=$Depth, run_id=$runId)."

$deadline = [DateTime]::UtcNow.AddMinutes($TimeoutMinutes)
while ([DateTime]::UtcNow -lt $deadline) {
  Start-Sleep -Seconds ([Math]::Max(1, $PollSeconds))
  try {
    $status = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 5
  } catch {
    continue
  }
  if ([string]$status.runId -ne $runId) {
    Stop-WithFailure -Reason 'run_status_mismatch' -Message 'CMP status belongs to a different run'
  }
  if ($status.running -eq $true) { continue }

  if (Test-CmpRunComplete -Status $status -ExpectedRunId $runId) {
    Write-RunLog "CMP sync complete (depth=$Depth, pages=$($status.pagesScraped), invoices=$($status.invoicesFound))."
    exit 0
  }

  $reason = Get-CmpFailureReason -Status $status
  $isSessionFailure = $reason -in @('session_expired', 'mfa_required')
  Stop-WithFailure -Reason $reason -Message "CMP sync ended without a complete persisted run" -SessionFailure:$isSessionFailure
}

Stop-WithFailure -Reason 'sync_timeout' -Message "CMP sync exceeded timeout of $TimeoutMinutes minutes"
