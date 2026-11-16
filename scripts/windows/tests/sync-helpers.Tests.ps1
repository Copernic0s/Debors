. (Join-Path $PSScriptRoot '..\sync-helpers.ps1')
$script:testRoot = Join-Path $env:TEMP ('debors-sync-tests-' + [Guid]::NewGuid().ToString('N'))
$script:flag = Join-Path $script:testRoot 'logs\cmp-session-expired.flag'

Describe 'CMP scheduled sync circuit breaker' {
  It 'allows a scheduled run when the session flag is absent' {
    (Test-CmpScheduledRunBlocked -FlagPath $script:flag) | Should Be $false
  }

  It 'blocks scheduled runs while the session flag exists' {
    Write-CmpSessionExpiredFlag -FlagPath $script:flag -Reason 'mfa_required'
    (Test-CmpScheduledRunBlocked -FlagPath $script:flag) | Should Be $true
    [System.IO.File]::ReadAllText($script:flag) | Should Match 'reason=mfa_required'
  }

  It 'allows scheduling again after the operator removes the flag' {
    Remove-Item -LiteralPath $script:flag -Force
    (Test-CmpScheduledRunBlocked -FlagPath $script:flag) | Should Be $false
  }

  It 'accepts only the expected run when it completed and persisted' {
    $status = [pscustomobject]@{ runId = 'run-1'; running = $false; phase = 'done'; runStatus = 'complete'; persisted = $true }
    (Test-CmpRunComplete -Status $status -ExpectedRunId 'run-1') | Should Be $true
    (Test-CmpRunComplete -Status $status -ExpectedRunId 'run-2') | Should Be $false
  }

  It 'does not reuse an old run failure reason for the current scheduled run' {
    $status = [pscustomobject]@{
      runId = 'new-run'; running = $false; phase = 'done'; runStatus = 'incomplete';
      persisted = $true; failureReason = $null;
      lastRunError = [pscustomobject]@{ runId = 'old-run'; failureReason = 'mfa_required' }
    }
    (Get-CmpFailureReason -Status $status) | Should Be 'sync_incomplete'
  }

  It 'loads config values into process scope without producing their contents' {
    $envFile = Join-Path $script:testRoot 'test.env'
    New-Item -ItemType Directory -Path $script:testRoot -Force | Out-Null
    [System.IO.File]::WriteAllText($envFile, "CMP_INGEST_SECRET=synthetic-test-only`r`n")
    $previousValue = [Environment]::GetEnvironmentVariable('CMP_INGEST_SECRET', 'Process')
    try {
      [Environment]::SetEnvironmentVariable('CMP_INGEST_SECRET', $null, 'Process')
      (Import-DeborsEnvironment -EnvFile $envFile) | Should Be $true
      [bool][Environment]::GetEnvironmentVariable('CMP_INGEST_SECRET', 'Process') | Should Be $true
    } finally {
      [Environment]::SetEnvironmentVariable('CMP_INGEST_SECRET', $previousValue, 'Process')
    }
  }

  AfterAll {
    if (Test-Path -LiteralPath $script:testRoot) { Remove-Item -LiteralPath $script:testRoot -Recurse -Force }
  }
}
