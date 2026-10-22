$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

& $godot --headless --path $root --script res://tests/vietnamese_gameplay_copy_contract_test.gd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

