$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "chapter_1_level_5_miniboss_report.json"
$stdout = Join-Path $artifacts "chapter_1_level_5_miniboss_stdout.log"
$stderr = Join-Path $artifacts "chapter_1_level_5_miniboss_stderr.log"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }

$arguments = "--headless --path `"$root`" --script res://tests/chapter_1_level_5_miniboss_test.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
$out = Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue
$err = Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue
$hasEngineError = $out -match "(?m)^(SCRIPT ERROR|ERROR):" -or $err -match "(?m)^(SCRIPT ERROR|ERROR):"
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $hasEngineError) {
	Get-Content -LiteralPath $stdout -ErrorAction SilentlyContinue
	Get-Content -LiteralPath $stderr -ErrorAction SilentlyContinue
	exit 1
}
Get-Content -LiteralPath $report -Encoding UTF8
