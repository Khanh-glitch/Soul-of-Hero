$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$tests = @(
    "res://tests/soul_relay_test.gd",
    "res://tests/soul_echo_effect_test.gd",
    "res://tests/hero_soul_rules_test.gd",
    "res://tests/hero_soul_fusion_live_affix_test.gd",
    "res://tests/hero_soul_inventory_test.gd"
)

foreach ($test in $tests) {
    $name = [System.IO.Path]::GetFileNameWithoutExtension($test)
    $stdout = Join-Path $artifacts ("{0}_stdout.log" -f $name)
    $stderr = Join-Path $artifacts ("{0}_stderr.log" -f $name)
    $arguments = "--headless --path `"$root`" --script $test"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
}

exit 0
