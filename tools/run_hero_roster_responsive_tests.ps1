param(
    [switch]$SkipVisualCapture
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null

function Assert-GodotRun {
    param(
        [string]$Arguments,
        [string]$Stem,
        [switch]$VisibleRenderer
    )
    $stdout = Join-Path $artifacts ($Stem + "_stdout.log")
    $stderr = Join-Path $artifacts ($Stem + "_stderr.log")
    $windowStyle = if ($VisibleRenderer) { "Hidden" } else { "Hidden" }
    $process = Start-Process -FilePath $godot -ArgumentList $Arguments -Wait -PassThru -WindowStyle $windowStyle -RedirectStandardOutput $stdout -RedirectStandardError $stderr
    $output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
    Write-Output $output
    if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
        throw "$Stem failed with exit code $($process.ExitCode)."
    }
}

$layoutArguments = "--headless --path `"$root`" --script res://tests/hero_roster_responsive_test.gd"
Assert-GodotRun -Arguments $layoutArguments -Stem "hero_roster_responsive_layout"

if (-not $SkipVisualCapture) {
    Add-Type -AssemblyName System.Drawing
    foreach ($case in @(
        @{ Width = 847; Height = 437 },
        @{ Width = 1280; Height = 720 }
    )) {
        $width = [int]$case.Width
        $height = [int]$case.Height
        $stem = "hero_roster_${width}x${height}"
        $captureArguments = "--path `"$root`" --resolution ${width}x${height} --position 20,20 -- --ui-shell-capture"
        Assert-GodotRun -Arguments $captureArguments -Stem $stem -VisibleRenderer
        $source = Join-Path $artifacts "ui_shell_home_hero_roster.png"
        if (-not (Test-Path -LiteralPath $source)) { throw "$stem did not produce the production Home Map roster capture." }
        $destination = Join-Path $artifacts ($stem + ".png")
        Copy-Item -LiteralPath $source -Destination $destination -Force
        $image = [System.Drawing.Image]::FromFile($destination)
        try {
            if ($image.Width -ne $width -or $image.Height -ne $height) {
                throw "$stem produced $($image.Width)x$($image.Height), expected ${width}x${height}."
            }
        }
        finally {
            $image.Dispose()
        }
        Write-Output "CAPTURE PASSED  $destination"

		$skillsSource = Join-Path $artifacts "ui_shell_home_hero_skills.png"
		if (-not (Test-Path -LiteralPath $skillsSource)) { throw "$stem did not produce the production Hero Skills capture." }
		$skillsDestination = Join-Path $artifacts ("hero_skills_${width}x${height}.png")
		Copy-Item -LiteralPath $skillsSource -Destination $skillsDestination -Force
		$skillsImage = [System.Drawing.Image]::FromFile($skillsDestination)
		try {
			if ($skillsImage.Width -ne $width -or $skillsImage.Height -ne $height) {
				throw "$stem Hero Skills produced $($skillsImage.Width)x$($skillsImage.Height), expected ${width}x${height}."
			}
		}
		finally {
			$skillsImage.Dispose()
		}
		Write-Output "CAPTURE PASSED  $skillsDestination"
    }
}

Write-Output "HERO ROSTER RESPONSIVE RUNNER PASSED"
