$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null

function Invoke-HeroSoulInstanceTest {
	param(
		[string]$Name,
		[string]$Arguments,
		[string]$ReportName
	)
	$report = Join-Path $artifacts $ReportName
	$stdout = Join-Path $artifacts ($Name + "_stdout.log")
	$stderr = Join-Path $artifacts ($Name + "_stderr.log")
	if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
	$process = Start-Process -FilePath $godot -ArgumentList $Arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
	$payload = Get-Content -LiteralPath $report -Raw -Encoding UTF8 | ConvertFrom-Json
	if (-not $payload.ok) { Get-Content -LiteralPath $report -Encoding UTF8; exit 1 }
	Get-Content -LiteralPath $report -Encoding UTF8
}

$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
	$isolatedSavePath = "user://tests/hero_soul_instance_runner_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$pureArguments = "--headless --path `"$root`" --script res://tests/hero_soul_instance_live_test.gd"
	Invoke-HeroSoulInstanceTest -Name "hero_soul_instance_live" -Arguments $pureArguments -ReportName "hero_soul_instance_live_report.json"

	$runtimeSavePath = "user://tests/hero_soul_instance_knight_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $runtimeSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $runtimeSavePath
	$runtimeArguments = "--headless --path `"$root`" -- --hero-soul-instance-knight-test"
	Invoke-HeroSoulInstanceTest -Name "hero_soul_instance_knight_runtime" -Arguments $runtimeArguments -ReportName "hero_soul_instance_knight_runtime_report.json"
} finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
}
