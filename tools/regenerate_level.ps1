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

$arguments = "--headless --path `"$root`" --script res://tools/generators/generate_chapter_1_levels_2_to_5.gd"
$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
exit $process.ExitCode
