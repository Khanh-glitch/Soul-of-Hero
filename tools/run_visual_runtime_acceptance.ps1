$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$previousPrimarySavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH

function Invoke-VisualAcceptanceCase {
	param(
		[string]$CaseName,
		[int]$Width,
		[int]$Height
	)
	$stem = "visual_acceptance_{0}_{1}x{2}" -f $CaseName, $Width, $Height
	$stdout = Join-Path $artifacts ($stem + "_stdout.log")
	$stderr = Join-Path $artifacts ($stem + "_stderr.log")
	$isolatedSavePath = "user://tests/{0}_{1}.json" -f $stem, ([guid]::NewGuid().ToString('N'))
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$arguments = "--path `"$root`" --resolution ${Width}x${Height} --position 20,20 res://tests/visual_runtime_acceptance_capture.tscn -- --visual-case=$CaseName --expected-width=$Width --expected-height=$Height"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
	$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
	Write-Output $output
	if ($process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):') {
		throw "$stem failed with exit code $($process.ExitCode)."
	}
	if ($output -notmatch "VISUAL RUNTIME ACCEPTANCE PASSED - $CaseName") {
		throw "$stem did not report a passing visual acceptance result."
	}
	$imagePath = Join-Path $artifacts ($stem + ".png")
	if (-not (Test-Path -LiteralPath $imagePath)) {
		throw "$stem did not produce $imagePath"
	}
	Add-Type -AssemblyName System.Drawing
	$image = [System.Drawing.Image]::FromFile($imagePath)
	try {
		if ($image.Width -ne $Width -or $image.Height -ne $Height) {
			throw "$stem produced $($image.Width)x$($image.Height), expected ${Width}x${Height}."
		}
	}
	finally {
		$image.Dispose()
	}
	Write-Output "VISUAL CAPTURE PASSED  $imagePath"
}

try {
	foreach ($caseName in @("axe", "level7_beacon")) {
		Invoke-VisualAcceptanceCase -CaseName $caseName -Width 847 -Height 437
		Invoke-VisualAcceptanceCase -CaseName $caseName -Width 1280 -Height 720
	}
	Invoke-VisualAcceptanceCase -CaseName "roster_souls" -Width 847 -Height 437
	Invoke-VisualAcceptanceCase -CaseName "roster_skills" -Width 847 -Height 437
	Invoke-VisualAcceptanceCase -CaseName "roster_aux" -Width 847 -Height 437
	Invoke-VisualAcceptanceCase -CaseName "chest_catalog" -Width 1280 -Height 720
}
finally {
	$env:SOUL_OF_HERO_SAVE_PATH = $previousPrimarySavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
}

Write-Output "VISUAL RUNTIME ACCEPTANCE RUNNER PASSED"
