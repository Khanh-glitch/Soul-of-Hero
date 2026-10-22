$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localGodot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (Test-Path -LiteralPath $localGodot) {
    $godot = $localGodot
} else {
    $command = Get-Command godot4, godot -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $command) { throw "Godot 4.7 was not found." }
    $godot = $command.Source
}

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$stdout = Join-Path $artifacts "designer_control_center_stdout.log"
$stderr = Join-Path $artifacts "designer_control_center_stderr.log"
$arguments = "--headless --path `"$root`" --script res://tests/designer_control_center_test.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue
Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue
exit $process.ExitCode
