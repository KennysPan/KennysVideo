$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixtureRoot = Join-Path $projectRoot 'src-tauri\target\qa-shortcut-icons'
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
$appTarget = Join-Path $fixtureRoot 'app.exe'
$otherTarget = Join-Path $fixtureRoot 'other.exe'
$iconTarget = Join-Path $fixtureRoot 'KennysVideo-test.ico'
Copy-Item -LiteralPath (Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release\app.exe') -Destination $appTarget
Copy-Item -LiteralPath $appTarget -Destination $otherTarget
Copy-Item -LiteralPath (Join-Path $projectRoot 'src-tauri\icons\icon.ico') -Destination $iconTarget
$shell = New-Object -ComObject WScript.Shell
foreach ($name in @('own','other')) {
    $link = $shell.CreateShortcut((Join-Path $fixtureRoot "$name.lnk"))
    $link.TargetPath = if ($name -eq 'own') { $appTarget } else { $otherTarget }
    $link.Arguments = '--preserve-test-argument'
    $link.Save()
}
$template = Get-Content -LiteralPath (Join-Path $projectRoot 'src-tauri\installer-template.nsi') -Raw
$macro = [regex]::Match($template, '(?s)!macro RefreshBrandShortcut shortcut.*?!macroend').Value
if (-not $macro) { throw 'Missing production icon refresh macro' }
$harness = @'
Unicode true
!addincludedir "__INCLUDE__"
!include LogicLib.nsh
!include Win\COM.nsh
!include Win\Propkey.nsh
!include utils.nsh
!define MAINBINARYNAME app
!define VERSION test
Name "Shortcut icon test"
OutFile "__FIXTURE__\icon-test.exe"
RequestExecutionLevel user
SilentInstall silent
__MACRO__
Section
 StrCpy $INSTDIR "__FIXTURE__"
 !insertmacro RefreshBrandShortcut "$INSTDIR\own.lnk"
 !insertmacro RefreshBrandShortcut "$INSTDIR\other.lnk"
SectionEnd
'@
$includeDir = Join-Path $projectRoot 'src-tauri\target\x86_64-pc-windows-msvc\release\nsis\x64'
$harness = $harness.Replace('__FIXTURE__',$fixtureRoot).Replace('__MACRO__',$macro).Replace('__INCLUDE__',$includeDir)
$harnessPath = Join-Path $fixtureRoot 'icon-test.nsi'
[IO.File]::WriteAllText($harnessPath,$harness,[Text.UTF8Encoding]::new($false))
$compiler = Join-Path $projectRoot 'src-tauri\target\.tauri\NSIS\makensis.exe'
& $compiler /V2 $harnessPath
if ($LASTEXITCODE -ne 0) { throw 'Harness compilation failed' }
$testProcess = Start-Process -WindowStyle Hidden -FilePath (Join-Path $fixtureRoot 'icon-test.exe') -PassThru
if (-not $testProcess.WaitForExit(10000)) { Stop-Process -Id $testProcess.Id; throw 'Harness timed out' }
if ($testProcess.ExitCode -ne 0) { throw 'Harness failed' }
$own = $shell.CreateShortcut((Join-Path $fixtureRoot 'own.lnk'))
$other = $shell.CreateShortcut((Join-Path $fixtureRoot 'other.lnk'))
if ($own.IconLocation -ne "$iconTarget,0") { throw "Own icon was not refreshed: $($own.IconLocation)" }
if ($other.IconLocation -ne ',0') { throw 'Unrelated shortcut was modified' }
if ($own.TargetPath -ne $appTarget -or $own.Arguments -ne '--preserve-test-argument') { throw 'Shortcut target or arguments changed' }
Write-Output 'PASS: production NSIS macro refreshes own shortcut icon, preserves target/arguments and ignores unrelated shortcuts.'
