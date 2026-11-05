param(
    [ValidateSet('aarch64','x86_64','both')][string]$Target = 'aarch64',
    [switch]$Release
)
$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$workspaceTools = Join-Path (Split-Path $repoRoot -Parent) 'build-tools'
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Join-Path $env:USERPROFILE '.jdks/ms-17.0.20.1' }
if (-not $env:ANDROID_HOME) { $env:ANDROID_HOME = Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
if (-not $env:NDK_HOME) { $env:NDK_HOME = Join-Path $workspaceTools 'android-ndk-r30' }
if (-not $env:RUSTUP_HOME -and (Test-Path (Join-Path $workspaceTools 'rustup'))) { $env:RUSTUP_HOME = Join-Path $workspaceTools 'rustup' }
if (-not $env:CARGO_HOME -and (Test-Path (Join-Path $workspaceTools 'cargo'))) { $env:CARGO_HOME = Join-Path $workspaceTools 'cargo' }
foreach ($entry in @(@($env:JAVA_HOME,'bin/java.exe'),@($env:ANDROID_HOME,'platform-tools/adb.exe'),@($env:NDK_HOME,'source.properties'))) {
    if (-not (Test-Path (Join-Path $entry[0] $entry[1]))) { throw "Configure JAVA_HOME, ANDROID_HOME and NDK_HOME first; missing $($entry[0])/$($entry[1])" }
}
$env:PATH = (Join-Path $env:JAVA_HOME 'bin') + ';' + $env:PATH
if ($env:CARGO_HOME) { $env:PATH = (Join-Path $env:CARGO_HOME 'bin') + ';' + $env:PATH }
$tauri = Join-Path $repoRoot 'node_modules/.bin/tauri.cmd'
if (-not (Test-Path $tauri)) { throw 'Run npm ci in the project first' }
$targetList = if ($Target -eq 'both') { @('aarch64','x86_64') } else { @($Target) }
$buildArguments = @('android','build','--apk','--target') + $targetList + @('--ci')
if (-not $Release) { $buildArguments += '--debug' }
Push-Location $repoRoot
try { & $tauri @buildArguments; if ($LASTEXITCODE -ne 0) { throw 'Android build failed' } }
finally { Pop-Location }
