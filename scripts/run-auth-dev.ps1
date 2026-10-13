param(
    [ValidateSet('dev', 'test')][string]$Target = 'dev',
    [ValidateSet('console', 'smtp')][string]$MailMode = 'console'
)

$ErrorActionPreference = 'Stop'
$Target = $Target.ToLowerInvariant()
. (Join-Path $PSScriptRoot 'local-secrets.ps1')
$directory = Get-KanuLocalDirectory
New-Item -ItemType Directory -Path $directory -Force | Out-Null
$credential = Get-KanuCredential -Kind app -Target $Target
$database = if ($Target -eq 'test') { 'kanuconnecttest' } else { 'kanuconnectdev' }
$secretFile = Join-Path $directory 'auth-secret.xml'
if (-not (Test-Path -LiteralPath $secretFile -PathType Leaf)) {
    [byte[]]$bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force |
        Export-Clixml -LiteralPath $secretFile
    Remove-Variable bytes, generator -ErrorAction SilentlyContinue
}
try { $secret = Import-Clixml -LiteralPath $secretFile -ErrorAction Stop }
catch { throw 'Cle Auth.js illisible : auth-secret.xml doit appartenir au compte Windows de ce PC.' }
if ($secret -isnot [Security.SecureString] -or $secret.Length -lt 32) {
    throw 'Cle Auth.js locale invalide.'
}
$password = [Uri]::EscapeDataString($credential.GetNetworkCredential().Password)
$values = @{
    KANU_DATABASE_NAME = $database
    KANU_DATABASE_URL = ('mysql://kanu_app_{0}:{1}@127.0.0.1:3306/{2}' -f $Target, $password, $database)
    AUTH_URL = 'http://localhost:3000'
    AUTH_SECRET = [pscredential]::new('auth', $secret).GetNetworkCredential().Password
    NODE_ENV = 'development'
    KANU_DEV_MAIL_TO_CONSOLE = $(if ($Target -eq 'dev' -and $MailMode -eq 'console') { '1' } else { $null })
}
foreach ($setting in @(
    @{ File = 'moderator-id.txt'; Variable = 'KANU_MODERATOR_IDS' }
    @{ File = 'admin-id.txt'; Variable = 'KANU_ADMIN_IDS' }
    @{ File = 'appeal-email.txt'; Variable = 'KANU_APPEAL_EMAIL' }
)) {
    $path = Join-Path $directory $setting.File
    if (Test-Path -LiteralPath $path -PathType Leaf) {
        $values[$setting.Variable] = (Get-Content -LiteralPath $path -Raw).Trim()
    }
}
try {
    Invoke-WithKanuEnvironment -Values $values -Action {
        Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
        try {
            & npm.cmd run dev
            if ($LASTEXITCODE -ne 0) { throw 'Demarrage local echoue.' }
        }
        finally { Pop-Location }
    }
}
finally {
    Remove-Variable credential, password, secret, values -ErrorAction SilentlyContinue
}
