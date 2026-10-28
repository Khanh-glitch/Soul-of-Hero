$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$manifestPath = Join-Path $root "data\asset_manifest\chapter_1_l06_l10_assets.json"
$manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
$errors = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

foreach ($asset in $manifest.assets) {
    $relative = $asset.path -replace '^res://', '' -replace '/', '\'
    $path = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $path)) {
        $errors.Add("Missing asset: $($asset.id) -> $($asset.path)")
        continue
    }
    if ($asset.path.EndsWith('.png')) {
        $image = [System.Drawing.Image]::FromFile($path)
        try {
            if ($asset.width -and ($image.Width -ne [int]$asset.width -or $image.Height -ne [int]$asset.height)) {
                $errors.Add("Dimension mismatch: $($asset.id) expected $($asset.width)x$($asset.height), got $($image.Width)x$($image.Height)")
            }
        } finally { $image.Dispose() }
        $importPath = "$path.import"
        if (-not (Test-Path -LiteralPath $importPath)) {
            $warnings.Add("Godot import metadata missing: $($asset.path)")
        } else {
            $import = Get-Content -Raw -LiteralPath $importPath
            if ($import -notmatch 'compress/mode=0') { $errors.Add("Non-lossless texture import: $($asset.id)") }
            if ($import -notmatch 'mipmaps/generate=false') { $errors.Add("Mipmaps enabled for pixel asset: $($asset.id)") }
        }
    }
    $source = $manifest.sources.PSObject.Properties[$asset.source]
    if (-not $source) {
        if ($asset.status -eq 'production_ready') { $errors.Add("Unknown source on production asset: $($asset.id)") }
        else { $warnings.Add("Unregistered source retained as placeholder: $($asset.id) -> $($asset.source)") }
        continue
    }
    if ($asset.status -eq 'production_ready' -and -not $source.Value.commercial_use) {
        $errors.Add("Production asset failed commercial-use gate: $($asset.id)")
    }
    if ($source.Value.record) {
        $recordRelative = $source.Value.record -replace '^res://', '' -replace '/', '\'
        if (-not (Test-Path -LiteralPath (Join-Path $root $recordRelative))) {
            $errors.Add("Missing provenance record: $($asset.id) -> $($source.Value.record)")
        }
    } elseif ($asset.status -eq 'production_ready') {
        $errors.Add("Production asset has no provenance record: $($asset.id)")
    }
}

# Every authored frame has to exist in the kit that draws it. A document can name a
# frame the atlas does not have - a typo, a renamed prop - and the renderer will
# simply draw nothing there, with no error anywhere. Level 7 lost twenty barrels and
# Level 8 lost two banners to exactly that.
$python = Get-Command python3 -ErrorAction SilentlyContinue
if (-not $python) { $python = Get-Command python -ErrorAction SilentlyContinue }
if (-not $python) {
    $errors.Add("No Python interpreter found for the art reference check.")
} else {
    & $python.Source (Join-Path $root "tools\validate_chapter1_art_refs.py")
    if ($LASTEXITCODE -ne 0) { $errors.Add("Art reference validation failed (see above).") }
}

$ready = @($manifest.assets | Where-Object status -eq 'production_ready').Count
$placeholder = @($manifest.assets | Where-Object status -eq 'placeholder_only').Count
Write-Output "Chapter 1 L06-L10 asset validation: $ready production-ready, $placeholder placeholder-only."
$warnings | ForEach-Object { Write-Warning $_ }
if ($errors.Count -gt 0) {
    $errors | ForEach-Object { Write-Error $_ }
    exit 1
}
Write-Output "PASS: manifest, dimensions, license gates, and available Godot import presets are valid."
