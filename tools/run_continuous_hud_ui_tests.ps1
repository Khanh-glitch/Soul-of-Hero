$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$stdoutLog = Join-Path $artifacts "continuous_hud_ui_stdout.log"
$stderrLog = Join-Path $artifacts "continuous_hud_ui_stderr.log"
Remove-Item -LiteralPath $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
$arguments = "--headless --path `"$root`" --script res://tests/continuous_hud_ui_test.gd"
$previousSavePath = $env:SOUL_OF_HERO_SAVE_PATH
try {
    $env:SOUL_OF_HERO_SAVE_PATH = "user://tests/continuous_hud_ui_$([guid]::NewGuid().ToString('N')).json"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
} finally {
    $env:SOUL_OF_HERO_SAVE_PATH = $previousSavePath
}
$runtimeOutput = ((Get-Content -LiteralPath $stdoutLog -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue))
Write-Output $runtimeOutput
if ($process.ExitCode -ne 0 -or $runtimeOutput -match '(?m)^(SCRIPT ERROR|ERROR):' -or $runtimeOutput -notmatch 'CONTINUOUS HUD UI TEST PASSED') {
    exit 1
}
exit 0
