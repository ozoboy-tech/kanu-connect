param([ValidateSet('dev', 'test')][string]$Target = 'dev')

$ErrorActionPreference = 'Stop'
$Target = $Target.ToLowerInvariant()
. (Join-Path $PSScriptRoot 'local-secrets.ps1')
$credential = Get-KanuCredential -Kind migrate -Target $Target
$values = @{}
$values["KANU_MIGRATE_$($Target.ToUpperInvariant())_DB_PASSWORD"] = $credential.GetNetworkCredential().Password
try {
    Invoke-WithKanuEnvironment -Values $values -Action {
        & node (Join-Path $PSScriptRoot 'migrate.mjs') $Target
        if ($LASTEXITCODE -ne 0) { throw "Migration locale echouee." }
    }
}
finally { Remove-Variable credential, values -ErrorAction SilentlyContinue }
