$ErrorActionPreference = 'Stop'

$helperScript = Join-Path $PSScriptRoot 'sync-helper.py'
$statusUrl = 'http://127.0.0.1:8790/api/status'
$failureLog = Join-Path $PSScriptRoot '또 틀렸다!\동기화도우미.log'

function Test-SyncHelper {
    try {
        $response = Invoke-RestMethod -Uri $statusUrl -Method Get -TimeoutSec 2
        return $response.helper -eq 'tax-accounting-sync-helper'
    }
    catch {
        return $false
    }
}

if (Test-SyncHelper) {
    exit 0
}

$pythonCandidates = [System.Collections.Generic.List[string]]::new()
$pythonw = Get-Command 'pythonw.exe' -ErrorAction SilentlyContinue
if ($pythonw) {
    $pythonCandidates.Add($pythonw.Source)
}

$pyw = Get-Command 'pyw.exe' -ErrorAction SilentlyContinue
if ($pyw) {
    $pythonCandidates.Add($pyw.Source)
}

$codexPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $codexPython) {
    $pythonCandidates.Add($codexPython)
}

try {
    if (-not (Test-Path -LiteralPath $helperScript)) {
        throw 'sync-helper.py 파일을 찾지 못했습니다.'
    }
    if ($pythonCandidates.Count -eq 0) {
        throw '사용할 수 있는 Python 실행환경을 찾지 못했습니다.'
    }

    foreach ($pythonExe in $pythonCandidates) {
        $arguments = if ([IO.Path]::GetFileName($pythonExe) -ieq 'pyw.exe') {
            @('-3', "`"$helperScript`"")
        }
        else {
            @("`"$helperScript`"")
        }
        Start-Process -FilePath $pythonExe -ArgumentList $arguments -WindowStyle Hidden | Out-Null

        foreach ($attempt in 1..20) {
            Start-Sleep -Milliseconds 250
            if (Test-SyncHelper) {
                exit 0
            }
        }
    }

    throw '동기화 도우미가 5초 안에 시작되지 않았습니다.'
}
catch {
    $time = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    Add-Content -LiteralPath $failureLog -Encoding UTF8 -Value "[$time] launcher error: $($_.Exception.Message)"
    exit 1
}
