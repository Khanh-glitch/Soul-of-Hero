$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) {
    throw "Godot binary not found: $godot"
}

$previousSoulSave = $env:SOUL_OF_HERO_SAVE_PATH
$previousArsenalSave = $env:LIVING_ARSENAL_SAVE_PATH
$env:SOUL_OF_HERO_SAVE_PATH = "user://tests/combat_balance_model.json"
$env:LIVING_ARSENAL_SAVE_PATH = $env:SOUL_OF_HERO_SAVE_PATH
try {
    $artifacts = Join-Path $root ".artifacts"
    New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
    $stdout = Join-Path $artifacts "combat_balance_model_stdout.log"
    $stderr = Join-Path $artifacts "combat_balance_model_stderr.log"
    $arguments = "--headless --path `"$root`" --script res://tests/combat_balance_model_test.gd"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
        throw "Combat balance model test failed with exit code $($process.ExitCode)"
    }
}
finally {
    $env:SOUL_OF_HERO_SAVE_PATH = $previousSoulSave
    $env:LIVING_ARSENAL_SAVE_PATH = $previousArsenalSave
}
