function Test-CmpSessionExpiredFlag {
  param([Parameter(Mandatory = $true)][string]$FlagPath)
  return Test-Path -LiteralPath $FlagPath -PathType Leaf
}

function Test-CmpScheduledRunBlocked {
  param([Parameter(Mandatory = $true)][string]$FlagPath)
  return Test-CmpSessionExpiredFlag -FlagPath $FlagPath
}

function Import-DeborsEnvironment {
  param([Parameter(Mandatory = $true)][string]$EnvFile)
  if (-not (Test-Path -LiteralPath $EnvFile -PathType Leaf)) { return $false }
  foreach ($line in [System.IO.File]::ReadAllLines($EnvFile)) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
    $separator = $trimmed.IndexOf('=')
    if ($separator -le 0) { continue }
    $name = $trimmed.Substring(0, $separator).Trim()
    if ($name -notmatch '^[A-Za-z_][A-Za-z0-9_]*$') { continue }
    if ([Environment]::GetEnvironmentVariable($name, 'Process')) { continue }
    $value = $trimmed.Substring($separator + 1).Trim().Trim('"').Trim("'")
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
  return $true
}

function Write-CmpSessionExpiredFlag {
  param(
    [Parameter(Mandatory = $true)][string]$FlagPath,
    [Parameter(Mandatory = $true)][string]$Reason
  )
  $directory = Split-Path -Parent $FlagPath
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
  $content = "reason=$Reason`r`ncreated_at=$([DateTime]::UtcNow.ToString('o'))`r`n"
  $temporaryPath = "$FlagPath.tmp"
  [System.IO.File]::WriteAllText($temporaryPath, $content, [System.Text.Encoding]::UTF8)
  Move-Item -LiteralPath $temporaryPath -Destination $FlagPath -Force
}

function Get-CmpFailureReason {
  param([Parameter(Mandatory = $true)]$Status)
  if ($Status.failureReason) { return [string]$Status.failureReason }
  if ($Status.lastRunError.runId -eq $Status.runId -and $Status.lastRunError.failureReason) {
    return [string]$Status.lastRunError.failureReason
  }
  if ($Status.error) { return 'sync_failed' }
  return 'sync_incomplete'
}

function Test-CmpRunComplete {
  param(
    [Parameter(Mandatory = $true)]$Status,
    [Parameter(Mandatory = $true)][string]$ExpectedRunId
  )
  return (-not $Status.running) -and
    ([string]$Status.runId -eq $ExpectedRunId) -and
    ([string]$Status.phase -eq 'done') -and
    ([string]$Status.runStatus -eq 'complete') -and
    ($Status.persisted -eq $true)
}
