[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
  [switch]$Unregister,
  [string]$EnvFile
)

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $EnvFile) { $EnvFile = [Environment]::GetEnvironmentVariable('DEBORS_ENV_FILE', 'Process') }
if (-not $EnvFile) { $EnvFile = Join-Path $projectRoot '.env' }
if (-not [System.IO.Path]::IsPathRooted($EnvFile)) { $EnvFile = Join-Path $projectRoot $EnvFile }
$EnvFile = [System.IO.Path]::GetFullPath($EnvFile)
$powerShellExe = Join-Path $PSHOME 'powershell.exe'
$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -MultipleInstances IgnoreNew `
  -StartWhenAvailable `
  -WakeToRun `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1) `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries
$localDate = (Get-Date).Date

$taskDefinitions = @(
  @{ Name = 'Debors-Server'; Script = 'start-server.ps1'; Trigger = (New-ScheduledTaskTrigger -AtLogOn -User $principal.UserId); Arguments = '' },
  @{ Name = 'Debors-CmpSync-0800'; Script = 'run-cmp-sync.ps1'; Trigger = (New-ScheduledTaskTrigger -Daily -At ($localDate.AddHours(8))); Arguments = '-Depth fast' },
  @{ Name = 'Debors-CmpSync-1200'; Script = 'run-cmp-sync.ps1'; Trigger = (New-ScheduledTaskTrigger -Daily -At ($localDate.AddHours(12))); Arguments = '-Depth fast' },
  @{ Name = 'Debors-CmpSync-1600'; Script = 'run-cmp-sync.ps1'; Trigger = (New-ScheduledTaskTrigger -Daily -At ($localDate.AddHours(16))); Arguments = '-Depth fast' },
  @{ Name = 'Debors-CmpSync-1900'; Script = 'run-cmp-sync.ps1'; Trigger = (New-ScheduledTaskTrigger -Daily -At ($localDate.AddHours(19))); Arguments = '-Depth normal' }
)

if ($Unregister) {
  foreach ($task in $taskDefinitions) {
    $existing = Get-ScheduledTask -TaskName $task.Name -ErrorAction SilentlyContinue
    if ($existing -and $PSCmdlet.ShouldProcess($task.Name, 'Unregister scheduled task')) {
      Unregister-ScheduledTask -TaskName $task.Name -Confirm:$false
      Write-Output "Removed $($task.Name)."
    }
  }
  return
}

foreach ($task in $taskDefinitions) {
  $scriptPath = Join-Path $PSScriptRoot $task.Script
  $arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$scriptPath`" $($task.Arguments) -EnvFile `"$EnvFile`"".Trim()
  $action = New-ScheduledTaskAction -Execute $powerShellExe -Argument $arguments -WorkingDirectory $projectRoot
  if ($PSCmdlet.ShouldProcess($task.Name, 'Register or update scheduled task')) {
    Register-ScheduledTask `
      -TaskName $task.Name `
      -Description 'Debors local CMP sync automation. Runs only in the signed-in Windows session.' `
      -Action $action `
      -Trigger $task.Trigger `
      -Principal $principal `
      -Settings $settings `
      -Force | Out-Null
    Write-Output "Registered $($task.Name)."
  }
}
