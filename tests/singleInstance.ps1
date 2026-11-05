$ErrorActionPreference = 'Stop'
$appBinary = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target\x86_64-pc-windows-msvc\release\app.exe'))
$profileDirectory = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\src-tauri\target\qa-single-instance-profile'))
$previousProfile = $env:WEBVIEW2_USER_DATA_FOLDER
$ownedProcesses = @()
try {
    $env:WEBVIEW2_USER_DATA_FOLDER = $profileDirectory
    $primaryApp = Start-Process -WindowStyle Hidden -FilePath $appBinary -PassThru
    $ownedProcesses += $primaryApp
    Start-Sleep -Seconds 4
    $primaryApp.Refresh()
    if ($primaryApp.HasExited) { throw 'Primary test app did not remain running; an existing instance may own the identifier.' }
    foreach ($attempt in 1..3) {
        $extraApp = Start-Process -WindowStyle Hidden -FilePath $appBinary -PassThru
        $ownedProcesses += $extraApp
        if (-not $extraApp.WaitForExit(8000)) { throw 'Repeated launch created a second persistent instance.' }
        if ($extraApp.ExitCode -ne 0) { throw 'Repeated launch did not exit cleanly.' }
    }
    $primaryApp.Refresh()
    if ($primaryApp.HasExited) { throw 'Primary instance exited during activation.' }
    if ($primaryApp.MainWindowHandle -eq [IntPtr]::Zero) { throw 'Existing main window was not shown after activation.' }
    Write-Output "PASS: three repeated launches exited; primary PID $($primaryApp.Id) retains one main window."
} finally {
    foreach ($ownedProcess in $ownedProcesses) {
        $ownedProcess.Refresh()
        if (-not $ownedProcess.HasExited) { Stop-Process -Id $ownedProcess.Id -ErrorAction SilentlyContinue }
    }
    if ($null -eq $previousProfile) { Remove-Item Env:\WEBVIEW2_USER_DATA_FOLDER -ErrorAction SilentlyContinue }
    else { $env:WEBVIEW2_USER_DATA_FOLDER = $previousProfile }
}
