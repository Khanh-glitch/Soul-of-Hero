$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$previousTouchControls = $env:GODOT_FORCE_TOUCH_CONTROLS

function Invoke-HudCase {
	param(
		[string]$CaseName,
		[bool]$TouchControls
	)
	$stdout = Join-Path $artifacts ("hero_aware_hud_{0}_stdout.log" -f $CaseName)
	$stderr = Join-Path $artifacts ("hero_aware_hud_{0}_stderr.log" -f $CaseName)
	$isolatedSavePath = "user://tests/hero_aware_hud_{0}_{1}.json" -f $CaseName, ([guid]::NewGuid().ToString('N'))
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$env:GODOT_FORCE_TOUCH_CONTROLS = if ($TouchControls) { "1" } else { "0" }
	$arguments = "--headless --path `"$root`" --script res://tests/hero_aware_hud_runtime_test.gd"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
		throw "Hero-aware HUD $CaseName case failed with exit code $($process.ExitCode)."
	}
}

try {
	Invoke-HudCase -CaseName "desktop" -TouchControls $false
	Invoke-HudCase -CaseName "mobile" -TouchControls $true
}
finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
	$env:GODOT_FORCE_TOUCH_CONTROLS = $previousTouchControls
}

Write-Output "HERO-AWARE HUD RUNTIME RUNNER PASSED"
