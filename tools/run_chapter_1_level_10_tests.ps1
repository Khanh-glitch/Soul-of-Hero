$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "chapter_1_level_10_fresh_route_report.json"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$tests = @(
    @{
        Name = "chapter_1_level_10_generator"
        Arguments = "--headless --path `"$root`" --script res://tools/generators/generate_chapter_1_level_10.gd"
        FreshSave = $false
    },
    @{
        Name = "chapter_1_level_10_vertical_slice"
        Arguments = "--headless --path `"$root`" --script res://tests/chapter_1_level_10_vertical_slice_test.gd"
        FreshSave = $false
    },
    @{
        Name = "chapter_1_level_10_live_runtime"
        Arguments = "--headless --path `"$root`" res://tests/chapter_1_level_10_live_runtime_test.tscn"
        FreshSave = $false
    },
    @{
        Name = "chapter_1_level_10_fresh_route"
        Arguments = "--headless --path `"$root`" --script res://tests/chapter_1_level_10_fresh_route_test.gd"
        FreshSave = $true
    }
)

$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
    $isolatedRuntimeSave = "user://tests/chapter_1_level_10_runtime_$([guid]::NewGuid().ToString('N')).json"
    foreach ($test in $tests) {
        $savePath = if ($test.FreshSave) {
            "user://tests/chapter_1_level_10_fresh_route_test.json"
        } else {
            $isolatedRuntimeSave
        }
        $env:SOUL_OF_HERO_SAVE_PATH = $savePath
        $env:LIVING_ARSENAL_SAVE_PATH = $savePath
        $stdout = Join-Path $artifacts ("{0}_stdout.log" -f $test.Name)
        $stderr = Join-Path $artifacts ("{0}_stderr.log" -f $test.Name)
        $process = Start-Process -FilePath $godot -ArgumentList $test.Arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
        Write-Output $output
        if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
    }
    if (-not (Test-Path -LiteralPath $report)) { throw "Level 10 fresh-route report was not produced." }
    Get-Content -LiteralPath $report -Encoding UTF8
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
