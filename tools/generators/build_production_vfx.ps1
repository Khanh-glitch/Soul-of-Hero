$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function New-RgbaBitmap([int]$width, [int]$height) {
    return [System.Drawing.Bitmap]::new(
        $width,
        $height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
}

function New-PixelGraphics([System.Drawing.Bitmap]$bitmap) {
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    return $graphics
}

function New-SourceRect([int]$x, [int]$y, [int]$width, [int]$height) {
    return [System.Drawing.Rectangle]::new($x, $y, $width, $height)
}

function New-DestinationRect([int]$x, [int]$y, [int]$width, [int]$height) {
    return [System.Drawing.Rectangle]::new($x, $y, $width, $height)
}

function Draw-PixelFrame(
    [System.Drawing.Graphics]$graphics,
    [System.Drawing.Image]$source,
    [System.Drawing.Rectangle]$sourceRect,
    [System.Drawing.Rectangle]$destinationRect,
    [float]$opacity = 1.0,
    [float]$angleDegrees = 0.0,
    [float]$pivotX = -1.0,
    [float]$pivotY = -1.0
) {
    $attributes = [System.Drawing.Imaging.ImageAttributes]::new()
    $matrix = [System.Drawing.Imaging.ColorMatrix]::new()
    $matrix.Matrix33 = [Math]::Max(0.0, [Math]::Min(1.0, $opacity))
    $attributes.SetColorMatrix($matrix)

    $state = $graphics.Save()
    if ([Math]::Abs($angleDegrees) -gt 0.001) {
        $centerX = if ($pivotX -ge 0.0) { $pivotX } else { $destinationRect.X + $destinationRect.Width * 0.5 }
        $centerY = if ($pivotY -ge 0.0) { $pivotY } else { $destinationRect.Y + $destinationRect.Height * 0.5 }
        $graphics.TranslateTransform([single]$centerX, [single]$centerY)
        $graphics.RotateTransform([single]$angleDegrees)
        $graphics.TranslateTransform([single]-$centerX, [single]-$centerY)
    }
    $graphics.DrawImage(
        $source,
        $destinationRect,
        $sourceRect.X,
        $sourceRect.Y,
        $sourceRect.Width,
        $sourceRect.Height,
        [System.Drawing.GraphicsUnit]::Pixel,
        $attributes
    )
    $graphics.Restore($state)
    $attributes.Dispose()
}

function Save-Png([System.Drawing.Bitmap]$bitmap, [string]$relativePath) {
    $destination = Join-Path $projectRoot $relativePath
    $directory = Split-Path -Parent $destination
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $bitmap.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Load-ProjectBitmap([string]$relativePath) {
    return [System.Drawing.Bitmap]::FromFile((Join-Path $projectRoot $relativePath))
}

function Build-AxeSpin {
    $source = Load-ProjectBitmap "assets\ui\fantasy_icons.png"
    $output = New-RgbaBitmap 256 32
    $graphics = New-PixelGraphics $output
    # LivingArsenalIcons.AXE is atlas cell (10, 5). The former runtime region
    # (32, 224) was a different icon and is intentionally not preserved.
    $sourceRect = New-SourceRect (10 * 32) (5 * 32) 32 32
    for ($frame = 0; $frame -lt 8; $frame++) {
        $cellX = $frame * 32
        $destination = New-DestinationRect ($cellX + 5) 5 22 22
        Draw-PixelFrame $graphics $source $sourceRect $destination 1.0 ($frame * 45.0) ($cellX + 16) 16
    }
    Save-Png $output "assets\vfx\axe\axe_spin_32x32_8.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-AxeCharge {
    $source = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Sci-fi\scifi_charge_up_001\scifi_charge_up_001_large_yellow\spritesheet.png"
    $output = New-RgbaBitmap (64 * 12) 64
    $graphics = New-PixelGraphics $output
    for ($frame = 0; $frame -lt 12; $frame++) {
        Draw-PixelFrame $graphics $source (New-SourceRect ($frame * 96) 0 96 96) (New-DestinationRect ($frame * 64) 0 64 64)
    }
    Save-Png $output "assets\vfx\axe\axe_charge_64x64_12.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-AxeCleave {
    $source = Load-ProjectBitmap "VFX Free Pack\Effect_Wheel\30fps\Spritesheets\Effect_Wheel_1_273x273.png"
    $output = New-RgbaBitmap (64 * 6) 48
    $graphics = New-PixelGraphics $output
    $sourceFrames = @(18, 19, 20, 21, 22, 23)
    for ($frame = 0; $frame -lt $sourceFrames.Count; $frame++) {
        $sourceIndex = $sourceFrames[$frame]
        $sourceX = ($sourceIndex % 6) * 273
        $sourceY = [Math]::Floor($sourceIndex / 6) * 273
        Draw-PixelFrame $graphics $source (New-SourceRect $sourceX $sourceY 273 273) (New-DestinationRect ($frame * 64) 0 64 48)
    }
    $graphics.Dispose()
    # Keep only a 150-degree forward sector so the result reads as a cleave,
    # not as a magic ring. Runtime rotates this authored right-facing arc.
    for ($frame = 0; $frame -lt 6; $frame++) {
        $centerX = $frame * 64 + 14.0
        $centerY = 24.0
        for ($x = $frame * 64; $x -lt ($frame + 1) * 64; $x++) {
            for ($y = 0; $y -lt 48; $y++) {
                $angle = [Math]::Atan2($y - $centerY, $x - $centerX) * 180.0 / [Math]::PI
                if ([Math]::Abs($angle) -gt 75.0 -or $x -lt ($frame * 64 + 10)) {
                    $output.SetPixel($x, $y, [System.Drawing.Color]::Transparent)
                }
            }
        }
    }
    Save-Png $output "assets\vfx\axe\axe_cleave_64x48_6.png"
    $output.Dispose()
    $source.Dispose()
}

function Build-SmokeStrip([string]$destination, [int[]]$frames, [int]$width, [int]$height) {
    $source = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Smoke Bursts\directional_smoke_burst_001\directional_smoke_burst_001_small_white\spritesheet.png"
    $output = New-RgbaBitmap ($width * $frames.Count) $height
    $graphics = New-PixelGraphics $output
    for ($index = 0; $index -lt $frames.Count; $index++) {
        Draw-PixelFrame $graphics $source (New-SourceRect ($frames[$index] * 32) 0 32 32) (New-DestinationRect ($index * $width) 0 $width $height)
    }
    Save-Png $output $destination
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-SwordMarker {
    $source = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Sci-fi\scifi_charge_up_001\scifi_charge_up_001_large_yellow\spritesheet.png"
    $output = New-RgbaBitmap (24 * 6) 24
    $graphics = New-PixelGraphics $output
    # Favor the readable middle/late rings. Early charge frames collapse to a
    # few pixels at 24x24 and fail as a top-down target marker.
    $sourceFrames = @(1, 3, 5, 7, 9, 11)
    for ($frame = 0; $frame -lt 6; $frame++) {
        Draw-PixelFrame $graphics $source (New-SourceRect ($sourceFrames[$frame] * 96) 0 96 96) (New-DestinationRect ($frame * 24 + 1) 5 22 14) 0.92
    }
    Save-Png $output "assets\vfx\sword\sword_pursuit_marker_24x24_6.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-SwordRibbon {
    $source = Load-ProjectBitmap "assets\vfx\sword\sword_crescent_wave.png"
    $output = New-RgbaBitmap (48 * 6) 24
    $graphics = New-PixelGraphics $output
    $widths = @(22, 30, 38, 46, 48, 40)
    $heights = @(8, 11, 14, 18, 22, 14)
    $opacity = @(0.28, 0.40, 0.52, 0.62, 0.54, 0.22)
    for ($frame = 0; $frame -lt 6; $frame++) {
        $x = $frame * 48 + [Math]::Floor((48 - $widths[$frame]) * 0.5)
        $y = [Math]::Floor((24 - $heights[$frame]) * 0.5)
        Draw-PixelFrame $graphics $source (New-SourceRect 0 0 128 128) (New-DestinationRect $x $y $widths[$frame] $heights[$frame]) $opacity[$frame]
    }
    Save-Png $output "assets\vfx\sword\sword_echo_ribbon_48x24_6.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-SparkleStrip([string]$destination) {
    $source = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Magic Bursts\round_sparkle_burst_001\round_sparkle_burst_001_small_blue\spritesheet.png"
    $output = New-RgbaBitmap (32 * 8) 32
    $graphics = New-PixelGraphics $output
    $sourceFrames = @(0, 2, 4, 6, 8, 10, 12, 13)
    for ($frame = 0; $frame -lt 8; $frame++) {
        Draw-PixelFrame $graphics $source (New-SourceRect ($sourceFrames[$frame] * 32) 0 32 32) (New-DestinationRect ($frame * 32) 0 32 32)
    }
    Save-Png $output $destination
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-ReaperDisc {
    $source = Load-ProjectBitmap "assets\characters\enemies\enemies-skeleton2_attack.png"
    $base = New-RgbaBitmap 32 32
    for ($x = 0; $x -lt 32; $x++) {
        for ($y = 0; $y -lt 32; $y++) {
            $pixel = $source.GetPixel(10 * 32 + $x, $y)
            $brightness = [Math]::Max($pixel.R, [Math]::Max($pixel.G, $pixel.B))
            $insideBody = $x -ge 11 -and $x -le 21 -and $y -ge 9 -and $y -le 29
            if ($pixel.A -gt 16 -and $brightness -gt 88 -and -not $insideBody) {
                $alpha = [Math]::Max(96, $pixel.A)
                $base.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($alpha, 232, 238, 244))
            }
        }
    }
    $output = New-RgbaBitmap (48 * 8) 48
    $graphics = New-PixelGraphics $output
    for ($frame = 0; $frame -lt 8; $frame++) {
        $cellX = $frame * 48
        Draw-PixelFrame $graphics $base (New-SourceRect 0 0 32 32) (New-DestinationRect ($cellX + 4) 4 40 40) 1.0 ($frame * 45.0) ($cellX + 24) 24
    }
    Save-Png $output "assets\vfx\enemy\reaper_disc_48x48_8.png"
    $graphics.Dispose()
    $output.Dispose()
    $base.Dispose()
    $source.Dispose()
}

function Build-ReaperTrail {
    $source = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Fantasy Spells\spell_absorb_001\spell_absorb_001_small_violet\spritesheet.png"
    $output = New-RgbaBitmap (32 * 6) 16
    $graphics = New-PixelGraphics $output
    $sourceFrames = @(2, 6, 10, 14, 18, 22)
    for ($frame = 0; $frame -lt 6; $frame++) {
        Draw-PixelFrame $graphics $source (New-SourceRect ($sourceFrames[$frame] * 64) 0 64 64) (New-DestinationRect ($frame * 32) 0 32 16) 0.64
    }
    Save-Png $output "assets\vfx\enemy\reaper_trail_32x16_6.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-VampireBlink {
    $warp = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Sci-fi\scifi_warp_002\scifi_warp_002_small_red\spritesheet.png"
    $splatter = Load-ProjectBitmap "Super Pixel Effects Gigapack (Free Version) v2.6.0\Super Pixel Effects Gigapack (Free Version)\spritesheet\Splatters\burst_splatter_001\burst_splatter_001_small_red\spritesheet.png"
    foreach ($mode in @("departure", "arrival")) {
        $output = New-RgbaBitmap (48 * 10) 48
        $graphics = New-PixelGraphics $output
        for ($frame = 0; $frame -lt 10; $frame++) {
            $sourceFrame = if ($mode -eq "departure") { $frame } else { 9 - $frame }
            Draw-PixelFrame $graphics $warp (New-SourceRect ($sourceFrame * 48) 0 48 48) (New-DestinationRect ($frame * 48) 0 48 48) 0.66
            Draw-PixelFrame $graphics $splatter (New-SourceRect ($sourceFrame * 32) 0 32 32) (New-DestinationRect ($frame * 48 + 8) 8 32 32) 0.68 $(if ($mode -eq "arrival") { 180.0 } else { 0.0 }) ($frame * 48 + 24) 24
        }
        Save-Png $output "assets\vfx\enemy\vampire_blink_${mode}_48x48_10.png"
        $graphics.Dispose()
        $output.Dispose()
    }
    $warp.Dispose()
    $splatter.Dispose()
}

function Build-VampireTether {
    $source = Load-ProjectBitmap "VFX Free Pack\Effect_Hyperspeed\30fps\Spritesheets\Effect_Hyperspeed_1_517x515.png"
    $output = New-RgbaBitmap (32 * 4) 16
    $graphics = New-PixelGraphics $output
    $sourceFrames = @(4, 10, 16, 22)
    for ($frame = 0; $frame -lt 4; $frame++) {
        $sourceIndex = $sourceFrames[$frame]
        $sourceX = ($sourceIndex % 6) * 517
        $sourceY = [Math]::Floor($sourceIndex / 6) * 515 + 190
        Draw-PixelFrame $graphics $source (New-SourceRect $sourceX $sourceY 517 135) (New-DestinationRect ($frame * 32) 0 32 16) 0.72
    }
    Save-Png $output "assets\vfx\enemy\vampire_tether_32x16_4.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

function Build-WorldPortal {
    $source = Load-ProjectBitmap "VFX Free Pack\Effect_TheVortex\30fps\Spritesheets\Effect_TheVortex_1_427x431.png"
    $output = New-RgbaBitmap (64 * 12) 64
    $graphics = New-PixelGraphics $output
    for ($frame = 0; $frame -lt 12; $frame++) {
        $sourceIndex = $frame * 2
        $sourceX = ($sourceIndex % 6) * 427
        $sourceY = [Math]::Floor($sourceIndex / 6) * 431
        Draw-PixelFrame $graphics $source (New-SourceRect $sourceX $sourceY 427 431) (New-DestinationRect ($frame * 64) 0 64 64) 0.72
    }
    Save-Png $output "assets\vfx\world\fantasy_portal_64x64_12.png"
    $graphics.Dispose()
    $output.Dispose()
    $source.Dispose()
}

Build-AxeSpin
Build-AxeCharge
Build-AxeCleave
Build-SmokeStrip "assets\vfx\axe\axe_trail_32x16_6.png" @(0, 3, 6, 9, 12, 15) 32 16
Build-SwordMarker
Build-SwordRibbon
Build-SparkleStrip "assets\vfx\sword\sword_echo_anchor_32x32_8.png"
Build-ReaperDisc
Build-ReaperTrail
Build-VampireBlink
Build-VampireTether
Build-SmokeStrip "assets\vfx\world\world_smoke_32x32_8.png" @(0, 3, 6, 9, 12, 15, 18, 20) 32 32
Build-SparkleStrip "assets\vfx\world\interaction_sparkle_32x32_8.png"
Build-WorldPortal

Write-Output "Production VFX sheets rebuilt successfully."
