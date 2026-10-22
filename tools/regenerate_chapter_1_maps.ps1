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

$generators = @(
    "res://tools/generators/generate_chapter_1_levels_2_to_5.gd",
    "res://tools/generators/generate_chapter_1_level_6.gd",
    "res://tools/generators/generate_chapter_1_level_7.gd",
    "res://tools/generators/generate_chapter_1_level_8.gd"
)
foreach ($generator in $generators) {
    $arguments = "--headless --path `"$root`" --script $generator"
    $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden
    if ($process.ExitCode -ne 0) { exit $process.ExitCode }
}
exit 0
