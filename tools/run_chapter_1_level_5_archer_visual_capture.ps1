$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH

try {
    foreach ($size in @(@{ Width = 640; Height = 360 }, @{ Width = 847; Height = 437 }, @{ Width = 1280; Height = 720 })) {
        $width = $size.Width
        $height = $size.Height
        $stem = "level5_kingdom_archer_${width}x${height}"
        $savePath = "user://tests/${stem}_$([guid]::NewGuid().ToString('N')).json"
        $env:SOUL_OF_HERO_SAVE_PATH = $savePath
        $env:LIVING_ARSENAL_SAVE_PATH = $savePath
        $stdout = Join-Path $artifacts ($stem + "_stdout.log")
        $stderr = Join-Path $artifacts ($stem + "_stderr.log")
        $arguments = "--path `"$root`" --rendering-method gl_compatibility --rendering-driver opengl3 --resolution ${width}x${height} --position 20,20 res://tests/chapter_1_level_5_archer_visual_capture.tscn -- --expected-width=$width --expected-height=$height"
        $process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
        $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
        Write-Output $output
        if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
            throw "$stem failed with exit code $($process.ExitCode)."
        }
        if ($output -notmatch "CHAPTER 1 LEVEL 5 KINGDOMARCHER VISUAL CAPTURE PASSED - ${width}x${height}") {
            throw "$stem did not report a passing capture."
        }
        $imagePath = Join-Path $artifacts ($stem + ".png")
        if (-not (Test-Path -LiteralPath $imagePath)) { throw "$stem did not produce $imagePath" }
        Add-Type -AssemblyName System.Drawing
        $image = [System.Drawing.Image]::FromFile($imagePath)
        try {
            if ($image.Width -ne $width -or $image.Height -ne $height) {
                throw "$stem produced $($image.Width)x$($image.Height), expected ${width}x${height}."
            }
        }
        finally {
            $image.Dispose()
        }
        Write-Output "LEVEL 5 KINGDOMARCHER CAPTURE PASSED  $imagePath"
    }
}
finally {
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

Write-Output "CHAPTER 1 LEVEL 5 KINGDOMARCHER VISUAL CAPTURE RUNNER PASSED"
