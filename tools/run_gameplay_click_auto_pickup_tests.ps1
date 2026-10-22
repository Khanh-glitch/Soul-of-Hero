$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

& $godot --headless --path $root -- --gameplay-click-auto-pickup-test
exit $LASTEXITCODE
