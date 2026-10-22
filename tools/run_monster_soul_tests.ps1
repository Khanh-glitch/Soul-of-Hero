$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "monster_soul_rules_report.json"
$stdout = Join-Path $artifacts "monster_soul_rules_stdout.log"
$stderr = Join-Path $artifacts "monster_soul_rules_stderr.log"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$arguments = "--headless --path `"$root`" --script res://tests/monster_soul_rules_test.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
Write-Output $output
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
Get-Content -LiteralPath $report -Encoding UTF8
