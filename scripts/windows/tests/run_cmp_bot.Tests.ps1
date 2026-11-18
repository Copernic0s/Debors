$script:projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..\..')).Path
$script:botScript = Join-Path $script:projectRoot 'automation\run_cmp_bot.ps1'

Describe 'CMP bot configuration resolution' {
  BeforeEach {
    $env:CMP_DEPTH = $null
    $env:CMP_HISTORY_DAYS = $null
    $env:CMP_MAX_PAGES = $null
    $env:CMP_FAST_SYNC = $null
    $env:CMP_SYNC_MODE = $null
  }

  It 'resolves fast depth with 15 days, 1000 max pages, and fast sync mode' {
    $resolved = & $script:botScript -Depth fast -ResolveOnly
    $resolved.Depth | Should Be 'fast'
    $resolved.HistoryDays | Should Be '15'
    $resolved.MaxPages | Should Be '1000'
    $resolved.FastSync | Should Be 'true'
    $resolved.SyncMode | Should Be 'fast'
  }

  It 'resolves normal and standard depths with 120 days and 1000 max pages' {
    $normal = & $script:botScript -Depth normal -ResolveOnly
    $normal.HistoryDays | Should Be '120'
    $normal.MaxPages | Should Be '1000'
    $normal.FastSync | Should Be 'false'
    $normal.SyncMode | Should Be 'normal'

    $env:CMP_HISTORY_DAYS = $null
    $env:CMP_MAX_PAGES = $null
    $env:CMP_FAST_SYNC = $null
    $env:CMP_SYNC_MODE = $null

    $standard = & $script:botScript -Depth standard -ResolveOnly
    $standard.HistoryDays | Should Be '120'
    $standard.MaxPages | Should Be '1000'
    $standard.FastSync | Should Be 'false'
    $standard.SyncMode | Should Be 'normal'
  }

  It 'resolves deep depth with 365 days and 1000 max pages' {
    $deep = & $script:botScript -Depth deep -ResolveOnly
    $deep.HistoryDays | Should Be '365'
    $deep.MaxPages | Should Be '1000'
    $deep.FastSync | Should Be 'false'
    $deep.SyncMode | Should Be 'deep'
  }

  It 'defaults to 120 days and 1000 max pages when no depth is specified' {
    $defaultConfig = & $script:botScript -ResolveOnly
    $defaultConfig.HistoryDays | Should Be '120'
    $defaultConfig.MaxPages | Should Be '1000'
    $defaultConfig.FastSync | Should Be 'false'
    $defaultConfig.SyncMode | Should Be 'normal'
  }

  It 'preserves explicit MaxPages override' {
    $custom = & $script:botScript -Depth fast -MaxPages 50 -ResolveOnly
    $custom.MaxPages | Should Be '50'
    $custom.HistoryDays | Should Be '15'
  }
}
