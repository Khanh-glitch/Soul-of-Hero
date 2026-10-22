$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$tests = @(
    "res://tests/hero_soul_fusion_live_affix_test.gd",
    "res://tests/hero_soul_rules_test.gd",
    "res://tests/hero_soul_inventory_test.gd",
    "res://tests/save_compatibility_regression_test.gd"
)

$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
    $isolatedSavePath = "user://tests/fusion_live_affix_runner_$([guid]::NewGuid().ToString('N')).json"
    $env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
    $env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
    foreach ($test in $tests) {
        $name = [System.IO.Path]::GetFileNameWithoutExtension($test)
        $stdout = Join-Path $artifacts ("{0}_focused_stdout.log" -f $name)
        $stderr = Join-Path $artifacts ("{0}_focused_stderr.log" -f $name)
        $arguments = "--headless --path `"$root`" --script $test"
        $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
        Write-Output $output
        if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
    }
} finally {
    if ($null -eq $previousPrimarySavePath) {
        Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
    } else {
        $env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
    }
    if ($null -eq $previousLegacySavePath) {
        Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue
    } else {
        $env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
    }
}

exit 0
