$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$stdout = Join-Path $artifacts "mana_meta_core_stdout.log"
$stderr = Join-Path $artifacts "mana_meta_core_stderr.log"
$previousPrimary = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacy = $env:LIVING_ARSENAL_SAVE_PATH
$isolated = "user://tests/mana_meta_core_runner_$([guid]::NewGuid().ToString('N')).json"
$env:SOUL_OF_HERO_SAVE_PATH = $isolated
$env:LIVING_ARSENAL_SAVE_PATH = $isolated

try {
	$arguments = "--headless --path `"$root`" --script res://tests/mana_meta_core_test.gd"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
		throw "Mana/meta core suite failed with exit code $($process.ExitCode)."
	}
}
finally {
	if ($null -eq $previousPrimary) { Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue } else { $env:SOUL_OF_HERO_SAVE_PATH = $previousPrimary }
	if ($null -eq $previousLegacy) { Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue } else { $env:LIVING_ARSENAL_SAVE_PATH = $previousLegacy }
}

Write-Output "MANA META CORE RUNNER PASSED"
