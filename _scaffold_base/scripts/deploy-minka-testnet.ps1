[CmdletBinding()]
param(
    [string]$AdminAlias = $env:ADMIN_ALIAS,
    [string]$UsdcSacId = $env:USDC_SAC_ID,
    [int64]$UnitPrice = $(if ($env:UNIT_PRICE) { $env:UNIT_PRICE } else { 10000000 }),
    [int64]$TargetUnits = $(if ($env:TARGET_UNITS) { $env:TARGET_UNITS } else { 1000 }),
    [switch]$BuildOnly,
    [switch]$Help
)

if ($Help) {
    @'
Usage:
  .\scripts\deploy-minka-testnet.ps1 -AdminAlias admin -UsdcSacId C... -UnitPrice 10000000 -TargetUnits 1000
  .\scripts\deploy-minka-testnet.ps1 -BuildOnly

Preconditions:
  - The Stellar CLI has an existing Testnet identity for AdminAlias.
  - UsdcSacId is a Stellar Testnet SAC contract address (starts with C), unless BuildOnly is used.
  - No secret key is accepted, created, or stored by this script.
'@ | Write-Output
    exit 0
}

if (-not $BuildOnly -and [string]::IsNullOrWhiteSpace($AdminAlias)) {
    throw 'ADMIN_ALIAS is required. Create or import an identity in Stellar CLI first.'
}

if (-not $BuildOnly -and $UsdcSacId -notmatch '^C[A-Z2-7]{55}$') {
    throw 'USDC_SAC_ID must be a Stellar contract address beginning with C.'
}

if ($UnitPrice -le 0 -or $TargetUnits -le 0) {
    throw 'UNIT_PRICE and TARGET_UNITS must be positive integers in token atomic units and units.'
}

$projectRoot = Split-Path -Parent $PSScriptRoot
$defaultCli = 'C:\Program Files (x86)\Stellar CLI\stellar.exe'
$stellar = if (Get-Command stellar -ErrorAction SilentlyContinue) {
    'stellar'
} elseif (Test-Path $defaultCli) {
    $defaultCli
} else {
    throw 'Stellar CLI was not found. Install it, or add stellar.exe to PATH.'
}

$toolchainFile = Join-Path $projectRoot 'rust-toolchain.toml'
$toolchainChannel = (Select-String -Path $toolchainFile -Pattern '^channel\s*=\s*"([^"]+)"').Matches[0].Groups[1].Value
$cargoBin = Get-ChildItem (Join-Path $env:USERPROFILE ".rustup\toolchains\$toolchainChannel-*\bin\cargo.exe") -ErrorAction SilentlyContinue |
    Select-Object -First 1 -ExpandProperty DirectoryName
if (-not $cargoBin) {
    throw "Rust toolchain $toolchainChannel was not found. Run: rustup toolchain install $toolchainChannel"
}
$env:PATH = "$cargoBin;$env:PATH"

$vsDevCmd = 'C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat'
if (Test-Path $vsDevCmd) {
    $vsEnvironment = & cmd.exe /c "call `"$vsDevCmd`" -arch=x64 >nul && set"
    foreach ($line in $vsEnvironment) {
        if ($line -match '^([^=]+)=(.*)$') {
            Set-Item -Path "Env:$($Matches[1])" -Value $Matches[2]
        }
    }
    $env:PATH = "$cargoBin;$env:PATH"
}

Push-Location $projectRoot
try {
    & $stellar -q contract build --package minka-market
    if ($LASTEXITCODE -ne 0) { throw 'Contract build failed.' }

    $wasm = Join-Path $projectRoot 'target\wasm32v1-none\release\minka_market.wasm'
    if (-not (Test-Path $wasm)) { throw "Expected Wasm artifact was not created: $wasm" }

    if ($BuildOnly) {
        Write-Output "Minka Market Wasm built locally: $wasm"
        return
    }

    # The constructor runs in the same transaction as the deployment, so the
    # offering cannot be initialized by anyone else in between.
    $contractId = & $stellar contract deploy `
        --wasm $wasm `
        --source-account $AdminAlias `
        --network testnet `
        --alias minka-market-testnet `
        -- `
        --admin $AdminAlias `
        --usdc $UsdcSacId `
        --unit_price $UnitPrice `
        --target_units $TargetUnits
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($contractId)) {
        throw 'Contract deployment failed.'
    }
    $contractId = ($contractId | Select-Object -Last 1).Trim()

    Write-Output "Minka Market deployed to Stellar Testnet: $contractId"
    Write-Output "Set MINKA_MARKET_ID=$contractId before starting the dashboard."
} finally {
    Pop-Location
}
