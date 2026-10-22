$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localGodot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"

if (Test-Path -LiteralPath $localGodot) {
    $godot = $localGodot
} else {
    $command = Get-Command godot4, godot -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw "Godot 4.7 was not found." }
    $godot = $command.Source
}

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "save_unlock_report.json"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$stdoutLog = Join-Path $artifacts "save_unlock_stdout.log"
$stderrLog = Join-Path $artifacts "save_unlock_stderr.log"

$previousOverride = $env:SOUL_OF_HERO_SAVE_PATH
try {
    # The autoload initializes before the test body, so route it away from the
    # player's real profile at process startup.
    $env:SOUL_OF_HERO_SAVE_PATH = "user://tests/soul_of_hero_save_smoke.json"
    $arguments = "--headless --path `"$root`" --script res://tests/save_unlock_smoke_test.gd"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report)) {
        Get-Content -LiteralPath $stdoutLog -ErrorAction SilentlyContinue
        Get-Content -LiteralPath $stderrLog -ErrorAction SilentlyContinue
        exit 1
    }
    Get-Content -LiteralPath $report -Encoding UTF8
} finally {
    $env:SOUL_OF_HERO_SAVE_PATH = $previousOverride
}
