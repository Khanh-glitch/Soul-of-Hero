$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$reports = @(
    (Join-Path $artifacts "level_5_archer_pickup_report.json"),
    (Join-Path $artifacts "chapter_1_level_5_live_loot_report.json")
)
foreach ($report in $reports) {
    if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
}

$tests = @(
    @{
        Name = "level_5_archer_pickup"
        Arguments = "--headless --path `"$root`" --script res://tests/level_5_archer_pickup_test.gd"
        SavePath = "user://tests/level_5_archer_pickup_test.json"
        Marker = "LEVEL 5 ARCHER PICKUP TEST PASSED"
    },
    @{
        Name = "chapter_1_level_5_live_loot"
        Arguments = "--headless --path `"$root`" res://tests/chapter_1_level_5_live_loot_regression.tscn"
        SavePath = "user://tests/chapter_1_level_5_live_loot_$([guid]::NewGuid().ToString('N')).json"
        Marker = "CHAPTER 1 LEVEL 5 LIVE LOOT PASSED"
    }
)

$previousSavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
    foreach ($test in $tests) {
        $env:SOUL_OF_HERO_SAVE_PATH = $test.SavePath
        $env:LIVING_ARSENAL_SAVE_PATH = $test.SavePath
        $stdout = Join-Path $artifacts ("{0}_stdout.log" -f $test.Name)
        $stderr = Join-Path $artifacts ("{0}_stderr.log" -f $test.Name)
        Remove-Item -LiteralPath $stdout, $stderr -ErrorAction SilentlyContinue
        $process = Start-Process -FilePath $godot -ArgumentList $test.Arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
        Write-Output $output
        if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):' -or $output -notmatch [regex]::Escape($test.Marker)) { exit 1 }
    }
    foreach ($report in $reports) {
        if (-not (Test-Path -LiteralPath $report)) { throw "Missing Level 5 report: $report" }
        Get-Content -LiteralPath $report -Encoding UTF8
    }
} finally {
    if ($null -eq $previousSavePath) {
        Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
    } else {
        $env:SOUL_OF_HERO_SAVE_PATH = $previousSavePath
    }
    if ($null -eq $previousLegacySavePath) {
        Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue
    } else {
        $env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
    }
}
