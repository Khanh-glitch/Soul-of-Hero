$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$expectedStems = @(
	"continuous_loop_enemy_xp",
	"continuous_loop_ground_loot",
	"continuous_loop_field_codex",
	"continuous_loop_field_codex_item_detail",
	"continuous_loop_field_codex_upgrades",
	"continuous_loop_completion_choice",
	"continuous_loop_level_picker"
)

function Invoke-ContinuousLoopCapture {
	param(
		[int]$Width,
		[int]$Height
	)
	$runStem = "continuous_loop_visual_acceptance_{0}x{1}" -f $Width, $Height
	$stdout = Join-Path $artifacts ($runStem + "_stdout.log")
	$stderr = Join-Path $artifacts ($runStem + "_stderr.log")
	$isolatedSavePath = "user://tests/{0}_{1}.json" -f $runStem, ([guid]::NewGuid().ToString("N"))
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$arguments = "--path `"$root`" --rendering-method gl_compatibility --rendering-driver opengl3 --resolution ${Width}x${Height} --position 20,20 res://tests/continuous_loop_visual_acceptance_capture.tscn -- --expected-width=$Width --expected-height=$Height"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or $output -match "(?m)^(SCRIPT ERROR|ERROR):") {
		throw "$runStem failed with exit code $($process.ExitCode)."
	}
	if ($output -notmatch "CONTINUOUS LOOP VISUAL ACCEPTANCE PASSED") {
		throw "$runStem did not report a passing result."
	}

	Add-Type -AssemblyName System.Drawing
	foreach ($stem in $expectedStems) {
		$imagePath = Join-Path $artifacts ("{0}_{1}x{2}.png" -f $stem, $Width, $Height)
		if (-not (Test-Path -LiteralPath $imagePath)) {
			throw "$runStem did not produce $imagePath"
		}
		$image = [System.Drawing.Image]::FromFile($imagePath)
		try {
			if ($image.Width -ne $Width -or $image.Height -ne $Height) {
				throw "$imagePath is $($image.Width)x$($image.Height), expected ${Width}x${Height}."
			}
		}
		finally {
			$image.Dispose()
		}
		Write-Output "CONTINUOUS LOOP CAPTURE PASSED  $imagePath"
	}
}

try {
	Invoke-ContinuousLoopCapture -Width 847 -Height 437
	Invoke-ContinuousLoopCapture -Width 1280 -Height 720
}
finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
}

Write-Output "CONTINUOUS LOOP VISUAL ACCEPTANCE RUNNER PASSED"
