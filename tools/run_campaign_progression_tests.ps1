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
$report = Join-Path $artifacts "campaign_progression_report.json"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$stdoutLog = Join-Path $artifacts "campaign_progression_stdout.log"
$stderrLog = Join-Path $artifacts "campaign_progression_stderr.log"

$previousSaveOverride = $env:SOUL_OF_HERO_SAVE_PATH
try {
    $env:SOUL_OF_HERO_SAVE_PATH = "user://tests/campaign_progression_save.json"
    $arguments = "--headless --path `"$root`" res://tests/content/campaign_progression_test.tscn"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
    $stdout = Get-Content -LiteralPath $stdoutLog -Raw -ErrorAction SilentlyContinue
    $stderr = Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue
    $hasEngineError = $stdout -match "(?m)^(SCRIPT ERROR|ERROR):" -or $stderr -match "(?m)^(SCRIPT ERROR|ERROR):"
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $hasEngineError) {
        Get-Content -LiteralPath $stdoutLog -ErrorAction SilentlyContinue
        Get-Content -LiteralPath $stderrLog -ErrorAction SilentlyContinue
        exit 1
    }
    Get-Content -LiteralPath $report -Encoding UTF8
} finally {
    $env:SOUL_OF_HERO_SAVE_PATH = $previousSaveOverride
}
