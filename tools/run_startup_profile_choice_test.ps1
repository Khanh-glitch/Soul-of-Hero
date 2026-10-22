$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$godot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"
if (-not (Test-Path -LiteralPath $godot)) { throw "Godot 4.7 was not found at $godot" }

$artifacts = Join-Path $root ".artifacts"
New-Item -ItemType Directory -Path $artifacts -Force | Out-Null
$stdout = Join-Path $artifacts "startup_profile_choice_stdout.log"
$stderr = Join-Path $artifacts "startup_profile_choice_stderr.log"
$previousSavePath = $env:SOUL_OF_HERO_SAVE_PATH
$previousLegacySavePath = $env:LIVING_ARSENAL_SAVE_PATH
$previousBridgePort = $env:GODOT_WS_PORT
$process = $null
try {
	$isolatedSavePath = "user://tests/startup_profile_choice_$([guid]::NewGuid().ToString('N')).json"
	$env:SOUL_OF_HERO_SAVE_PATH = $isolatedSavePath
	$env:LIVING_ARSENAL_SAVE_PATH = $isolatedSavePath
	$portProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
	$portProbe.Start()
	$env:GODOT_WS_PORT = [string](($portProbe.LocalEndpoint).Port)
	$portProbe.Stop()
	$arguments = "--headless --path `"$root`" -- --startup-profile-choice-test"
	$process = Start-Process -FilePath $godot -ArgumentList $arguments -Wait -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
}
finally {
	if ($null -eq $previousSavePath) {
		Remove-Item Env:SOUL_OF_HERO_SAVE_PATH -ErrorAction SilentlyContinue
	} else {
		$env:SOUL_OF_HERO_SAVE_PATH = $previousSavePath
	}
	if ($null -eq $previousLegacySavePath) {
		Remove-Item Env:LIVING_ARSENAL_SAVE_PATH -ErrorAction SilentlyContinue
	} else {
		$env:LIVING_ARSENAL_SAVE_PATH = $previousLegacySavePath
	}
	if ($null -eq $previousBridgePort) {
		Remove-Item Env:GODOT_WS_PORT -ErrorAction SilentlyContinue
	} else {
		$env:GODOT_WS_PORT = $previousBridgePort
	}
}

$output = ((Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue) + "`n" + (Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue))
Write-Output $output
if ($null -eq $process -or $process.ExitCode -ne 0 -or $output -match '(?m)^(SCRIPT ERROR|ERROR):' -or $output -notmatch 'STARTUP PROFILE CHOICE TEST PASSED') { exit 1 }
exit 0
