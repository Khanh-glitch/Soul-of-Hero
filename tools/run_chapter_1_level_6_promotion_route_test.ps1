$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "chapter_1_level_6_promotion_route_report.json"
$stdout = Join-Path $artifacts "chapter_1_level_6_promotion_route_stdout.log"
$stderr = Join-Path $artifacts "chapter_1_level_6_promotion_route_stderr.log"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$previousSavePath = $env:SOUL_OF_HERO_SAVE_PATH
try {
    $env:SOUL_OF_HERO_SAVE_PATH = "user://tests/chapter_1_level_6_promotion_route_test.json"
    $arguments = "--headless --path `"$root`" --script res://tests/chapter_1_level_6_promotion_route_test.gd"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
    Get-Content -LiteralPath $report -Encoding UTF8
} finally {
    if ($null -eq $previousSavePath) {
        Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
    } else {
        $env:SOUL_OF_HERO_SAVE_PATH = $previousSavePath
    }
}
