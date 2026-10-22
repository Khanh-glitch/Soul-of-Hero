$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
$artifacts = Join-Path $root ".artifacts"
$report = Join-Path $artifacts "living_arsenal_runtime_report.json"
$stdout = Join-Path $artifacts "living_arsenal_runtime_stdout.log"
$stderr = Join-Path $artifacts "living_arsenal_runtime_stderr.log"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
Remove-Item -LiteralPath $report -ErrorAction SilentlyContinue
$env:LIVING_ARSENAL_SAVE_PATH = "user://living_arsenal_runtime_test.json"
$arguments = "--headless --path `"$root`" -- --living-arsenal-test"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue
$runtimeOutput = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
if (Test-Path -LiteralPath $report) {
    Get-Content -LiteralPath $report -Encoding UTF8
}
if ($process.ExitCode -ne 0 -or $runtimeOutput -match '(?m)^(SCRIPT ERROR|ERROR):' -or -not (Test-Path -LiteralPath $report)) {
    if (-not [string]::IsNullOrWhiteSpace($runtimeOutput)) { Write-Error $runtimeOutput }
    exit 1
}

