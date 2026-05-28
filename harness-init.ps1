param([switch]$Fix)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$exitCode = 0

function Check {
    param($Name, [ScriptBlock]$Condition, [string]$FixHint)
    try {
        $result = & $Condition
        if ($result) {
            Write-Host "  [PASS] $Name" -ForegroundColor Green
        } else {
            Write-Host "  [FAIL] $Name" -ForegroundColor Red
            if ($FixHint) { Write-Host "         $FixHint" -ForegroundColor Yellow }
            $script:exitCode = 1
        }
    } catch {
        Write-Host "  [FAIL] $Name - $_" -ForegroundColor Red
        $script:exitCode = 1
    }
}

Write-Host "=== Harness Init: Debors ===" -ForegroundColor Cyan
Write-Host "Root: $root" -ForegroundColor Cyan
Write-Host "" -ForegroundColor Cyan

# --- Archivos esenciales ---
Write-Host "--- Archivos esenciales ---" -ForegroundColor Magenta
Check "harness.md existe" { Test-Path "$root\harness.md" }
Check "tasks.json existe" { Test-Path "$root\tasks.json" }
Check "progress/ existe" { Test-Path "$root\progress" }

# --- Node.js ---
Write-Host "`n--- Node.js (Frontend) ---" -ForegroundColor Magenta
Check "package.json existe" { Test-Path "$root\package.json" }
Check "node_modules/ existe" { Test-Path "$root\node_modules" }
Check "vite.config.js existe" { Test-Path "$root\vite.config.js" }
Check "eslint.config.js existe" { Test-Path "$root\eslint.config.js" }

# --- Server ---
Write-Host "`n--- Backend (server/) ---" -ForegroundColor Magenta
Check "server/package.json existe" { Test-Path "$root\server\package.json" }
Check "server/server.js existe" { Test-Path "$root\server\server.js" }

# --- Dependencias ---
Write-Host "`n--- Dependencias ---" -ForegroundColor Magenta
$pkg = Get-Content "$root\package.json" -Raw | ConvertFrom-Json
$hasReact = $pkg.dependencies.PSObject.Properties.Name -contains "react"
Check "React en dependencies" { $hasReact }
$hasSupabase = $pkg.dependencies.PSObject.Properties.Name -contains "@supabase/supabase-js"
Check "Supabase SDK en dependencies" { $hasSupabase }

# --- Tests y Lint (advertencias, no bloquean) ---
Write-Host "`n--- Verificacion de codigo (advertencias) ---" -ForegroundColor Magenta
if (Test-Path "$root\node_modules") {
    $lintOk = $true
    try {
        $null = & "npx.cmd" eslint --quiet "$root\src" 2>&1
        if ($LASTEXITCODE -ne 0) { $lintOk = $false }
    } catch { $lintOk = $false }
    if (-not $lintOk) {
        Write-Host "  [WARN] ESLint tiene errores en src/ (no bloquea)" -ForegroundColor Yellow
    } else {
        Write-Host "  [PASS] ESLint pasa en src/" -ForegroundColor Green
    }

    $testOk = $true
    try {
        $null = & "npx.cmd" vitest run --reporter=dot 2>&1
        if ($LASTEXITCODE -ne 0) { $testOk = $false }
    } catch { $testOk = $false }
    if (-not $testOk) {
        Write-Host "  [WARN] Algunos tests fallan (no bloquea)" -ForegroundColor Yellow
    } else {
        Write-Host "  [PASS] Vitest tests pasan" -ForegroundColor Green
    }
} else {
    Write-Host "  [SKIP] Tests y lint (node_modules no instalado)" -ForegroundColor Yellow
}

# --- .env ---
Write-Host "`n--- Configuracion ---" -ForegroundColor Magenta
Check ".env.example existe" { Test-Path "$root\.env.example" }

# --- Resumen ---
Write-Host "`n=== Resultado ===" -ForegroundColor Cyan
if ($exitCode -eq 0) {
    Write-Host "TODO OK - El arnes esta listo para trabajar." -ForegroundColor Green
} else {
    Write-Host "HAY FALLOS BLOQUEANTES - Revisa las marcas [FAIL] arriba." -ForegroundColor Red
}
exit $exitCode
