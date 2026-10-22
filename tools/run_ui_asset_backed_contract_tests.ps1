$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$stdoutLog = Join-Path $artifacts "ui_asset_backed_contract_stdout.log"
$stderrLog = Join-Path $artifacts "ui_asset_backed_contract_stderr.log"
Remove-Item -LiteralPath $stdoutLog, $stderrLog -ErrorAction SilentlyContinue
$arguments = "--headless --path `"$root`" --script res://tests/ui_asset_backed_contract_test.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdoutLog -RedirectStandardError $stderrLog
$runtimeOutput = ((Get-Content -LiteralPath $stdoutLog -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderrLog -Raw -ErrorAction SilentlyContinue))
Write-Output $runtimeOutput
if ($process.ExitCode -ne 0 -or $runtimeOutput -match '(?m)^(SCRIPT ERROR|ERROR):' -or $runtimeOutput -notmatch 'UI ASSET-BACKED CONTRACT TEST PASSED') {
	exit 1
}
exit 0
