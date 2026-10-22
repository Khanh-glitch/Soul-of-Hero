param(
    [string]$NodePath = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$localGodot = Join-Path $root ".tools\godot\Godot_v4.7-stable_win64.exe"

if (Test-Path -LiteralPath $localGodot) {
    $godot = $localGodot
} else {
    $godotCommand = Get-Command godot4, godot -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($null -eq $godotCommand) { throw "Không tìm thấy Godot 4.7." }
    $godot = $godotCommand.Source
}

if ([string]::IsNullOrWhiteSpace($NodePath)) {
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    $codexNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
    if ($null -ne $nodeCommand) { $NodePath = $nodeCommand.Source }
    elseif (Test-Path -LiteralPath $codexNode) { $NodePath = $codexNode }
    else { throw "Không tìm thấy Node 22+. Truyền -NodePath C:\path\to\node.exe." }
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()
$tokenBytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($tokenBytes)
$random.Dispose()
$token = -join ($tokenBytes | ForEach-Object { $_.ToString("x2") })
$environmentNames = @("GODOT_WS_PORT", "GODOT_WS_URL", "GODOT_MCP_TOKEN", "GODOT_BIN")
$previousEnvironment = @{}
foreach ($name in $environmentNames) {
    $previousEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
$env:GODOT_WS_PORT = "$port"
$env:GODOT_WS_URL = "ws://127.0.0.1:$port"
$env:GODOT_MCP_TOKEN = $token
$env:GODOT_BIN = $godot

$arguments = "--headless --path `"$root`""
$godotProcess = Start-Process -FilePath $godot -ArgumentList $arguments -PassThru -WindowStyle Hidden
try {
    $ready = $false
    for ($attempt = 0; $attempt -lt 40; $attempt++) {
        if ($godotProcess.HasExited) { throw "Godot thoát sớm với code $($godotProcess.ExitCode)." }
        $client = [System.Net.Sockets.TcpClient]::new()
        try {
            $connect = $client.ConnectAsync("127.0.0.1", $port)
            if ($connect.Wait(150) -and $client.Connected) { $ready = $true; break }
        } catch {
        } finally {
            $client.Dispose()
        }
        Start-Sleep -Milliseconds 150
    }
    if (-not $ready) { throw "WebSocket 127.0.0.1:9080 không sẵn sàng." }

    & $NodePath (Join-Path $root "tools\mcp\stdio_smoke_test.mjs")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $NodePath (Join-Path $root "tools\mcp\bidirectional_smoke_test.mjs")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    & $NodePath (Join-Path $root "tools\mcp\reconnect_smoke_test.mjs")
    exit $LASTEXITCODE
} finally {
    if (-not $godotProcess.HasExited) { Stop-Process -Id $godotProcess.Id -Force }
    $godotProcess.WaitForExit()
    foreach ($name in $environmentNames) {
        [Environment]::SetEnvironmentVariable($name, $previousEnvironment[$name], "Process")
    }
}
