function Get-KanuLocalDirectory {
    if ([string]::IsNullOrWhiteSpace($env:APPDATA)) { throw "APPDATA absent : utiliser PowerShell sur Windows." }
    return (Join-Path $env:APPDATA 'KanuConnect')
}

function Get-KanuCredential {
    param([ValidateSet('app', 'migrate')][string]$Kind, [ValidateSet('dev', 'test')][string]$Target)
    $Kind = $Kind.ToLowerInvariant()
    $Target = $Target.ToLowerInvariant()
    $path = Join-Path (Get-KanuLocalDirectory) "$Kind-$Target.xml"
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Identifiant prive absent : $path. Suivre docs/windows-local.md sur ce PC."
    }
    try { $credential = Import-Clixml -LiteralPath $path -ErrorAction Stop }
    catch { throw "Identifiant prive illisible : $path. Les XML doivent appartenir au compte Windows de ce PC." }
    if ($credential -isnot [pscredential] -or $credential.UserName -cne "kanu_${Kind}_$Target") {
        throw "Compte prive inattendu pour $Kind-$Target.xml."
    }
    if ([string]::IsNullOrEmpty($credential.GetNetworkCredential().Password)) {
        throw "Mot de passe absent pour $Kind-$Target.xml."
    }
    return $credential
}

function Invoke-WithKanuEnvironment {
    param([hashtable]$Values, [scriptblock]$Action)
    $previous = @{}
    foreach ($name in $Values.Keys) {
        if ($name -notmatch '^[A-Z][A-Z0-9_]*$') { throw "Nom de variable invalide." }
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
    try {
        foreach ($name in $Values.Keys) { [Environment]::SetEnvironmentVariable($name, $Values[$name], 'Process') }
        & $Action
    }
    finally {
        foreach ($name in $previous.Keys) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
        $Values.Clear()
        $previous.Clear()
    }
}
