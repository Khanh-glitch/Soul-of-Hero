$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
$artifacts = Join-Path $root ".artifacts"
$report = Join-Path $artifacts "archer_hero_combat_report.json"

New-Item -ItemType Directory -Force -Path $artifacts | Out-Null
Remove-Item -Force -ErrorAction SilentlyContinue $report

& $godot --headless --path $root -- --archer-hero-combat-test
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
	exit $exitCode
}
if (-not (Test-Path $report)) {
	throw "Archer Hero combat report was not created."
}
$result = Get-Content $report -Raw | ConvertFrom-Json
Get-Content $report
if (-not $result.ok) {
	exit 1
}
