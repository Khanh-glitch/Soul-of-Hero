$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $artifacts "archer_soul_codex_report.json"
$stdout = Join-Path $artifacts "archer_soul_codex_stdout.log"
$stderr = Join-Path $artifacts "archer_soul_codex_stderr.log"
Remove-Item -LiteralPath $report, $stdout, $stderr -ErrorAction SilentlyContinue

$previousSavePath = $env:SOUL_OF_HERO_SAVE_PATH
try {
	$env:SOUL_OF_HERO_SAVE_PATH = "user://tests/archer_soul_codex_test.json"
	$arguments = "--headless --path `"$root`" --script res://tests/archer_soul_codex_test.gd"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $report) -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') { exit 1 }
	Get-Content -LiteralPath $report -Encoding UTF8
}
finally {
	if ($null -eq $previousSavePath) {
		Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
	} else {
		$env:SOUL_OF_HERO_SAVE_PATH = $previousSavePath
	}
}
