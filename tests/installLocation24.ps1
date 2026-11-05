$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixtureRoot = Join-Path $projectRoot 'src-tauri\target\qa-install-location24'
New-Item -ItemType Directory -Path $fixtureRoot -Force | Out-Null
$template = Get-Content -LiteralPath (Join-Path $projectRoot 'src-tauri\installer-template.nsi') -Raw -Encoding UTF8
$functions = [regex]::Match($template, '(?s)Function RestorePreviousInstallLocation.*?Function FindPreviousInstallLocation.*?FunctionEnd').Value
if (-not $functions) { throw 'Missing production location restore functions' }
# All registry operations are redirected into a disposable test namespace.
$functions = $functions.Replace('Software\Microsoft\Windows\CurrentVersion\Uninstall\KennysVideo','Software\KennysVideoInstallPathQA24\LegacyUninstall').Replace('Software\KennysPan\KennysVideo','Software\KennysVideoInstallPathQA24\LegacyPublisher').Replace('Software\KennysVideo\KennysVideo','Software\KennysVideoInstallPathQA24\LegacyProduct')
$harness = @'
Unicode true
!include LogicLib.nsh
!define PLACEHOLDER_INSTALL_DIR "placeholder\KennysVideo"
!define MAINBINARYNAME app
!define UNINSTKEY "Software\KennysVideoInstallPathQA24\Uninstall"
!define MANUPRODUCTKEY "Software\KennysVideoInstallPathQA24\Product"
!macro SetContext
 SetRegView 64
 SetShellVarContext current
!macroend
Name "Install location isolated regression test"
OutFile "__ROOT__\location-test.exe"
RequestExecutionLevel user
SilentInstall silent
__FUNCTIONS__
Section
 CreateDirectory "__ROOT__\旧版 有空格"
 FileOpen $0 "__ROOT__\旧版 有空格\app.exe" w
 FileClose $0
 SetRegView 64
 WriteRegStr HKCU "${UNINSTKEY}" "InstallLocation" '$\"__ROOT__\旧版 有空格$\"'
 StrCpy $INSTDIR "${PLACEHOLDER_INSTALL_DIR}"
 Call RestorePreviousInstallLocation
 StrCmp $INSTDIR "__ROOT__\旧版 有空格" 0 failed
 ; Explicit /D/current executable location wins over a stale registration.
 StrCpy $INSTDIR "__ROOT__\明确选择"
 Call RestorePreviousInstallLocation
 StrCmp $INSTDIR "__ROOT__\明确选择" 0 failed
 DeleteRegKey HKCU "${UNINSTKEY}"
 SetRegView 32
 WriteRegStr HKCU "${MANUPRODUCTKEY}" "" "__ROOT__\旧版 有空格"
 SetRegView 64
 StrCpy $INSTDIR "${PLACEHOLDER_INSTALL_DIR}"
 Call RestorePreviousInstallLocation
 StrCmp $INSTDIR "__ROOT__\旧版 有空格" 0 failed
 ; Stale registry entries must not redirect installation into a missing folder.
 SetRegView 32
 WriteRegStr HKCU "${MANUPRODUCTKEY}" "" "__ROOT__\不存在"
 SetRegView 64
 StrCpy $INSTDIR "${PLACEHOLDER_INSTALL_DIR}"
 Call RestorePreviousInstallLocation
 StrCmp $INSTDIR "${PLACEHOLDER_INSTALL_DIR}" 0 failed
 StrCpy $1 0
 Goto cleanup
 failed:
 StrCpy $1 1
 cleanup:
 SetRegView 64
 DeleteRegKey HKCU "Software\KennysVideoInstallPathQA24"
 SetRegView 32
 DeleteRegKey HKCU "Software\KennysVideoInstallPathQA24"
 SetErrorLevel $1
SectionEnd
'@
$harness = $harness.Replace('__ROOT__',$fixtureRoot).Replace('__FUNCTIONS__',$functions)
$harnessPath = Join-Path $fixtureRoot 'location-test.nsi'
# Generated compiler input, not an application source edit.
[IO.File]::WriteAllText($harnessPath,$harness,[Text.UTF8Encoding]::new($true))
$compiler = Join-Path $projectRoot 'src-tauri\target\.tauri\NSIS\makensis.exe'
& $compiler /V2 $harnessPath
if ($LASTEXITCODE -ne 0) { throw 'Harness compilation failed' }
$testProcess = Start-Process -WindowStyle Hidden -FilePath (Join-Path $fixtureRoot 'location-test.exe') -PassThru
if (-not $testProcess.WaitForExit(10000)) { Stop-Process -Id $testProcess.Id; throw 'Harness timed out' }
if ($testProcess.ExitCode -ne 0) { throw 'Install location regression failed' }
Write-Output 'PASS: actual NSIS restore functions handle quoted Chinese/spaced paths, legacy 32-bit registry, explicit directory priority and stale records.'
