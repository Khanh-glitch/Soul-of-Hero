$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localGodot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"

if (Test-Path -LiteralPath $localGodot) {
    $godot = $localGodot
} else {
    $command = Get-Command godot4, godot -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw "Không tìm thấy Godot 4.7." }
    $godot = $command.Source
}

$arguments = "--headless --path `"$root`" -- --smoke-test"
$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$report = Join-Path $root ".artifacts\smoke_report.json"
if (Test-Path -LiteralPath $report) { Remove-Item -LiteralPath $report }
$stdoutLog = Join-Path $artifacts "smoke_stdout.log"
$stderrLog = Join-Path $artifacts "smoke_stderr.log"
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
try {
	$isolatedSavePath = "user://tests/gameplay_smoke_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
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
if (Test-Path -LiteralPath $report) {
    Get-Content -LiteralPath $report -Encoding UTF8
}
$runtimeOutput = ((Get-Content -LiteralPath $stdoutLog -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue))
$hasRuntimeError = $runtimeOutput -match '(?m)^(SCRIPT ERROR|ERROR):'
if ($process.ExitCode -ne 0 -or $hasRuntimeError -or -not (Test-Path -LiteralPath $report)) {
    if (-not [string]::IsNullOrWhiteSpace($runtimeOutput)) { Write-Error $runtimeOutput }
    exit 1
}
exit 0
