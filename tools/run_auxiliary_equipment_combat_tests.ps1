$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "auxiliary_equipment_combat_report.json"
$stdout = Join-Path $artifacts "auxiliary_equipment_combat_stdout.log"
$stderr = Join-Path $artifacts "auxiliary_equipment_combat_stderr.log"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$arguments = "--headless --path `"$root`" --script res://tests/auxiliary_equipment_combat_test.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
Write-Output $output
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
Get-Content -LiteralPath $report -Encoding UTF8

$runtimeReport = Join-Path $artifacts "auxiliary_equipment_knight_integration_report.json"
$runtimeStdout = Join-Path $artifacts "auxiliary_equipment_knight_integration_stdout.log"
$runtimeStderr = Join-Path $artifacts "auxiliary_equipment_knight_integration_stderr.log"
if (Test-Path -LiteralPath $runtimeReport) { Remove-Item -LiteralPath $runtimeReport }
$runtimeArguments = "--headless --path `"$root`" -- --auxiliary-equipment-knight-test"
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
	$isolatedSavePath = "user://tests/auxiliary_equipment_knight_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$runtimeProcess = Start-Process -FilePath $godot -ArgumentList $runtimeArguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $runtimeStdout -RedirectStandardError $runtimeStderr
} finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
}
$runtimeOutput = ((Get-Content -LiteralPath $runtimeStdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $runtimeStderr -Raw -ErrorAction SilentlyContinue))
Write-Output $runtimeOutput
if ($runtimeProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $runtimeReport) -or $runtimeOutput -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
Get-Content -LiteralPath $runtimeReport -Encoding UTF8
