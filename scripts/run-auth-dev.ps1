param([ValidateSet('test', 'dev')][string]$Target = 'test')

$ErrorActionPreference = 'Stop'
$directory = Join-Path $env:APPDATA 'KanuConnect'
$credentialFile = Join-Path $directory "app-$Target.xml"
if (-not (Test-Path $credentialFile)) {
    throw "Identifiant absent : $credentialFile. Enregistre une fois le compte kanu_app_$Target avec Get-Credential | Export-Clixml."
}
$credential = Import-Clixml $credentialFile
if ($credential.UserName -ne "kanu_app_$Target") {
    throw "Le compte enregistré doit être kanu_app_$Target."
}
$database = if ($Target -eq 'test') { 'kanuconnecttest' } else { 'kanuconnectdev' }
$password = [Uri]::EscapeDataString($credential.GetNetworkCredential().Password)
$env:KANU_DATABASE_NAME = $database
$env:KANU_DATABASE_URL = ('mysql://kanu_app_{0}:{1}@127.0.0.1:3306/{2}' -f $Target, $password, $database)
$env:AUTH_URL = 'http://localhost:3000'

$secretFile = Join-Path $directory 'auth-secret.xml'
if (-not (Test-Path $secretFile)) {
    [byte[]]$bytes = New-Object byte[] 32
    $generator = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $generator.GetBytes($bytes) } finally { $generator.Dispose() }
    ConvertTo-SecureString ([Convert]::ToBase64String($bytes)) -AsPlainText -Force |
        Export-Clixml $secretFile
}
$secret = Import-Clixml $secretFile
$env:AUTH_SECRET = [pscredential]::new('auth', $secret).GetNetworkCredential().Password

$moderatorFile = Join-Path $directory 'moderator-id.txt'
$env:KANU_MODERATOR_IDS = if (Test-Path $moderatorFile) {
    (Get-Content -LiteralPath $moderatorFile -Raw).Trim()
} else {
    ''
}
if ($Target -eq 'dev') {
    $env:KANU_DEV_MAIL_TO_CONSOLE = '1'
} else {
    Remove-Item Env:KANU_DEV_MAIL_TO_CONSOLE -ErrorAction SilentlyContinue
}

npm run dev
