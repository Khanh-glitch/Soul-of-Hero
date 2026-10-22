$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path $godot)) {
    $command = Get-Command godot4, godot -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw "Godot executable not found." }
    $godot = $command.Source
}
& $godot --headless --path $root --script res://tests/map_entity_authoring_test.gd
exit $LASTEXITCODE
