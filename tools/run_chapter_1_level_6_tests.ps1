$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$tests = @(
    @{
        Name = "chapter_1_level_6_vertical_slice"
        Arguments = "--headless --path `"$root`" --script res://tests/chapter_1_level_6_vertical_slice_test.gd"
    },
    @{
        Name = "chapter_1_level_6_live_runtime"
        Arguments = "--headless --path `"$root`" res://tests/chapter_1_level_6_live_runtime_test.tscn"
    }
)

foreach ($test in $tests) {
    $stdout = Join-Path $artifacts ("{0}_stdout.log" -f $test.Name)
    $stderr = Join-Path $artifacts ("{0}_stderr.log" -f $test.Name)
    $process = Start-Process -FilePath $godot -ArgumentList $test.Arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
}
exit 0
