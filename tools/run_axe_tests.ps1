$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$tests = @(
    "res://tests/axe_hero_identity_test.gd",
    "res://tests/axe_combat_test.gd",
    "res://tests/weapons/weapon_manager_test.gd",
    "res://tests/weapon_effects_test.gd",
    "res://tests/character_form_asset_test.gd"
)

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$isolatedSavePath = "user://tests/axe_suite_$([guid]::NewGuid().ToString('N')).json"
$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
$index = 0
try {
    foreach ($test in $tests) {
        $index += 1
        $stdout = Join-Path $artifacts "axe_test_${index}_stdout.log"
        $stderr = Join-Path $artifacts "axe_test_${index}_stderr.log"
        $arguments = "--headless --path `"$root`" --script $test"
        $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
        Write-Output $output
        if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
    }

    $stdout = Join-Path $artifacts "axe_knight_stdout.log"
    $stderr = Join-Path $artifacts "axe_knight_stderr.log"
    $arguments = "--headless --path `"$root`" -- --axe-knight-test"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
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
