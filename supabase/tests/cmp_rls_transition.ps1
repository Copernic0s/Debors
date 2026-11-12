$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$container = 'supabase_db_debors-db-baseline'

function Invoke-LocalSql([string]$Path) {
  Get-Content -Raw (Join-Path $repo $Path) | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "SQL contract failed: $Path" }
}

function Invoke-Activation([string]$Path, [bool]$ExpectFailure) {
  Get-Content -Raw (Join-Path $repo $Path) | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1 2>&1 | Out-String | Tee-Object -Variable output
  $code = $LASTEXITCODE
  if ($ExpectFailure) {
    if ($code -eq 0 -or $output -notmatch 'no is_manager=true user') {
      throw 'Activation without a manager should fail with the explicit manager guard.'
    }
  } elseif ($code -ne 0) { throw "Activation script failed: $Path`n$output" }
}

Invoke-LocalSql 'supabase/tests/cmp_rls_transition_setup.sql'
Invoke-LocalSql 'supabase/tests/cmp_rls_transition_open.sql'
Invoke-Activation 'supabase/activation/activate_agent_rls.sql' $true
Invoke-LocalSql 'supabase/tests/cmp_rls_transition_open.sql'

$managerSql = "insert into public.agent_scopes (user_id, agent_id, is_manager) values ('f6100000-0000-4000-8000-000000000002', 'f6-manager-scope', true);"
$managerSql | docker exec -i $container psql -U postgres -d postgres -v ON_ERROR_STOP=1
if ($LASTEXITCODE -ne 0) { throw 'Could not seed local test manager.' }

Invoke-Activation 'supabase/activation/activate_agent_rls.sql' $false
Invoke-LocalSql 'supabase/tests/cmp_rls_transition_scoped.sql'
Invoke-Activation 'supabase/activation/rollback_agent_rls.sql' $false
Invoke-LocalSql 'supabase/tests/cmp_rls_transition_open.sql'
Write-Output 'CMP RLS transition contract passed.'
