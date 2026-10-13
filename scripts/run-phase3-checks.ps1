param()
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-secrets.ps1')
$root = Split-Path -Parent $PSScriptRoot
$directory = Get-KanuLocalDirectory
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$reportPath = Join-Path $directory 'phase3-auto-results.json'
$unitPath = Join-Path $directory 'phase3-unit-results.json'
$databasePath = Join-Path $directory 'phase3-database-results.json'
$result = [ordered]@{
    checkedAtUtc = [DateTime]::UtcNow.ToString('o')
    computer = [Environment]::MachineName
    commit = $null
    branch = $null
    workingTreeClean = $false
    sourceReference = 'working-tree'
    status = 'failed'
    unit = $null
    types = $false
    build = $false
    integration = $null
    testDatabase = $null
    devDatabase = $null
    manualRecipePending = $true
}

function Invoke-KanuNpm {
    param([string[]]$Arguments)
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Controle npm echoue : $($Arguments[0])." }
}

function Read-KanuTestSummary {
    param([string]$Path)
    $data = Get-Content -LiteralPath $Path -Raw -ErrorAction Stop | ConvertFrom-Json
    if ($data.success -ne $true -or $data.numTotalTests -lt 1 -or
        $data.numFailedTests -ne 0 -or $data.numPassedTests -ne $data.numTotalTests -or
        $data.numPendingTests -gt 0) {
        throw "Rapport de tests incomplet ou en echec."
    }
    return [ordered]@{ files = @($data.testResults).Count; tests = $data.numTotalTests; passed = $data.numPassedTests }
}

$values = @{}
Push-Location -LiteralPath $root
try {
    $result.commit = (& git rev-parse HEAD)
    if ($LASTEXITCODE -ne 0) { throw "Lecture du commit echouee." }
    $result.branch = (& git branch --show-current)
    if ($LASTEXITCODE -ne 0) { throw "Lecture de la branche echouee." }
    $changes = @(& git status --porcelain --untracked-files=all)
    if ($LASTEXITCODE -ne 0) { throw "Lecture de l'etat Git echouee." }
    $result.workingTreeClean = $changes.Count -eq 0
    if ($result.workingTreeClean) { $result.sourceReference = 'commit' }
    $nodeVersion = (& node --version)
    if ($LASTEXITCODE -ne 0 -or $nodeVersion -notmatch '^v24\.(\d+)\.\d+$' -or [int]$Matches[1] -lt 15) {
        throw "Node.js 24.15 ou plus recent dans la serie 24 est requis (CI : 24.21.0)."
    }
    $npmVersion = (& npm.cmd --version)
    if ($LASTEXITCODE -ne 0 -or $npmVersion.Trim() -ne '12.2.0') { throw "npm 12.2.0 est requis." }

    Invoke-KanuNpm -Arguments @('test', '--', '--reporter=default', '--reporter=json', "--outputFile=$unitPath")
    $result.unit = Read-KanuTestSummary -Path $unitPath
    Invoke-KanuNpm -Arguments @('run', 'typecheck')
    $result.types = $true
    Invoke-KanuNpm -Arguments @('run', 'build')
    $result.build = $true

    foreach ($target in @('test', 'dev')) {
        $app = Get-KanuCredential -Kind app -Target $target
        $migration = Get-KanuCredential -Kind migrate -Target $target
        $appVariable = if ($target -eq 'test') { 'KANU_TEST_DB_PASSWORD' } else { 'KANU_DEV_DB_PASSWORD' }
        $values[$appVariable] = $app.GetNetworkCredential().Password
        $values["KANU_MIGRATE_$($target.ToUpperInvariant())_DB_PASSWORD"] = $migration.GetNetworkCredential().Password
    }
    Invoke-WithKanuEnvironment -Values $values -Action {
        Invoke-KanuNpm -Arguments @('run', 'test:integration', '--', '--reporter=default', '--reporter=json', "--outputFile=$databasePath")
        $result.integration = Read-KanuTestSummary -Path $databasePath
        foreach ($target in @('test', 'dev')) {
            $raw = & node (Join-Path $PSScriptRoot 'check-local-readiness.mjs') $target
            if ($LASTEXITCODE -ne 0) { throw "Base $target non prete : suivre docs/windows-local.md." }
            $readiness = ($raw -join [Environment]::NewLine) | ConvertFrom-Json
            if ($readiness.ready -ne $true) { throw "Base $target non prete." }
            if ($target -eq 'test') { $result.testDatabase = $readiness } else { $result.devDatabase = $readiness }
            Write-Host "Base $target : $($readiness.migrations.applied) migrations, aucune en attente."
        }
    }
    $result.status = 'automated-passed'
    Write-Host 'Controles automatiques reussis. La recette manuelle et la CI restent a valider.'
    if (-not $result.workingTreeClean) { Write-Host 'Rapport avant commit : refaire les controles sur main propre apres fusion.' }
}
finally {
    $result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host "Rapport prive : $reportPath"
    $values.Clear()
    Remove-Variable app, migration, values -ErrorAction SilentlyContinue
    Pop-Location
}
