param([switch]$Remove)

$ErrorActionPreference = 'Stop'

$startupDirectory = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startupDirectory 'TaxAccountingTrainingSync.lnk'

if ($Remove) {
    if (Test-Path -LiteralPath $shortcutPath) {
        Remove-Item -LiteralPath $shortcutPath -Force
    }
    exit 0
}

$launcherScript = Join-Path $PSScriptRoot 'start-sync-helper.ps1'
if (-not (Test-Path -LiteralPath $launcherScript)) {
    throw 'start-sync-helper.ps1을 찾을 수 없습니다.'
}

$powerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powerShell
$shortcut.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcherScript + '"'
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.WindowStyle = 7
$shortcut.Description = '오답 훈련센터 동기화 도우미 자동 시작'
$shortcut.Save()

& $powerShell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File $launcherScript
if ($LASTEXITCODE -ne 0) {
    throw '동기화 도우미를 시작하지 못했습니다.'
}
