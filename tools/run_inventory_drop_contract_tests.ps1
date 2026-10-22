$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$env:SOUL_OF_HERO_SAVE_PATH = "user://tests/inventory_drop_contract_runner_$([guid]::NewGuid().ToString('N')).json"
$env:LIVING_ARSENAL_SAVE_PATH = $env:SOUL_OF_HERO_SAVE_PATH
& $godot --headless --path $root --script "res://tests/inventory_drop_contract_test.gd"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
