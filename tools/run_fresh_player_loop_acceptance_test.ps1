$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "fresh_player_loop_acceptance_report.json"
$stdout = Join-Path $artifacts "fresh_player_loop_acceptance_stdout.log"
$stderr = Join-Path $artifacts "fresh_player_loop_acceptance_stderr.log"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$process = $null
try {
	$isolatedBootSave = "user://tests/fresh_player_loop_boot_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedBootSave
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedBootSave
	$arguments = "--headless --path `"$root`" -- --fresh-player-loop-acceptance-test"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
}

$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
Write-Output $output
if ($null -eq $process -or $process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
Get-Content -LiteralPath $report -Encoding UTF8
