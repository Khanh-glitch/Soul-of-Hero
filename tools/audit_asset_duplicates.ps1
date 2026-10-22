$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$assets = Join-Path $root "assets"

$groups = Get-ChildItem -LiteralPath $assets -Recurse -File |
    ForEach-Object {
        [PSCustomObject]@{
            Hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
            Path = $_.FullName.Substring($root.Length + 1).Replace('\', '/')
        }
    } |
    Group-Object Hash |
    Where-Object { $_.Count -gt 1 }

if ($groups.Count -eq 0) {
    Write-Output "No byte-identical production assets were found."
    exit 0
}

$hasTriplicate = $false
foreach ($group in $groups) {
    $paths = @($group.Group | Select-Object -ExpandProperty Path)
    $references = @()
    foreach ($path in $paths) {
        $references += rg --fixed-strings --glob '*.gd' --glob '*.tscn' --glob '*.tres' --glob '*.json' --files-with-matches $path game data tests 2>$null
    }
    $count = $paths.Count
    Write-Output ("{0} identical files ({1})" -f $count, $group.Name)
    $paths | ForEach-Object { Write-Output ("  asset: " + $_) }
    ($references | Sort-Object -Unique) | ForEach-Object { Write-Output ("  ref:   " + $_) }
    if ($count -gt 2) { $hasTriplicate = $true }
}

if ($hasTriplicate) {
    Write-Error "Found a production asset duplicated three or more times. Review before staging."
    exit 1
}
