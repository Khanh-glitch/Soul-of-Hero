$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$suites = @(
    @{ Name = "vfx_asset"; Script = "res://tests/vfx_asset_integration_test.gd" },
    @{ Name = "weapon_asset_presentation"; Script = "res://tests/weapon_asset_presentation_test.gd" }
)

foreach ($suite in $suites) {
    $stdout = Join-Path $artifacts ($suite.Name + "_test_stdout.log")
    $stderr = Join-Path $artifacts ($suite.Name + "_test_stderr.log")
    $arguments = "--headless --path `"$root`" --script " + $suite.Script
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
}
