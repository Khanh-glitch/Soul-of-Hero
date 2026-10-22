[CmdletBinding()]
param(
    [string]$DownloadsPath = (Join-Path $env:USERPROFILE "Downloads"),
    [string]$ProjectRoot = "",
    [string[]]$OnlyIds = @()
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$catalogPath = Join-Path $ProjectRoot "data/asset_library/download_catalog.json"
$libraryRoot = Join-Path $ProjectRoot "assets/library/downloaded"
$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
$errors = [Collections.Generic.List[string]]::new()

$allowedExtensions = @(
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".svg", ".gif",
    ".wav", ".ogg", ".mp3", ".flac",
    ".ttf", ".otf",
    ".ase", ".aseprite", ".psd", ".kra", ".xcf",
    ".tmx", ".tsx", ".json", ".xml", ".yaml", ".yml",
    ".txt", ".md", ".pdf", ".docx"
)
$ignoredSegments = @(
    "__MACOSX", ".git", ".godot", ".idea", ".vscode",
    "node_modules", "Library", "Temp", "obj", "bin"
)

function Get-RelativePathCompat {
    param([string]$Parent, [string]$Child)

    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childFull = [IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Cannot make relative path for $childFull"
    }
    return $childFull.Substring($parentFull.Length)
}

function Get-CandidateAssetFiles {
    param([string]$Root)

    return @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force | Where-Object {
        $relative = Get-RelativePathCompat -Parent $Root -Child $_.FullName
        $segments = $relative.Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)
        $hasIgnoredSegment = $false
        foreach ($segment in $segments) {
            if ($ignoredSegments -contains $segment) {
                $hasIgnoredSegment = $true
                break
            }
        }
        $name = $_.Name
        $extension = $_.Extension.ToLowerInvariant()
        (-not $hasIgnoredSegment) -and
            (-not $name.StartsWith('._')) -and
            ($name -ne '.DS_Store') -and
            ($name -ne 'Thumbs.db') -and
            ($allowedExtensions -contains $extension)
    })
}

function Get-DirectoryFingerprint {
    param(
        [string]$Root,
        [array]$Files
    )

    $records = @($Files | ForEach-Object {
        $relative = (Get-RelativePathCompat -Parent $Root -Child $_.FullName).Replace('\', '/')
        $hash = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToUpperInvariant()
        "$relative|$($_.Length)|$hash"
    } | Sort-Object)
    $payload = $records -join "`n"
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
        return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '')
    }
    finally {
        $sha.Dispose()
    }
}

function Test-SelectedId {
    param([string]$Id)

    return ($OnlyIds.Count -eq 0) -or ($OnlyIds -contains $Id)
}

foreach ($package in @($catalog.packages)) {
    if (-not (Test-SelectedId -Id $package.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $package.archive
    $targetPath = Join-Path $libraryRoot $package.id
    $markerPath = Join-Path $targetPath ".asset-import.json"

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        $errors.Add("missing archive: $($package.archive)")
        continue
    }
    $actualHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $package.sha256.ToUpperInvariant()) {
        $errors.Add("archive hash mismatch: $($package.archive)")
    }
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        $errors.Add("missing import marker: $($package.id)")
        continue
    }
    $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($marker.sha256 -ne $actualHash) {
        $errors.Add("marker hash mismatch: $($package.id)")
    }
    $candidateFiles = @(Get-ChildItem -LiteralPath $targetPath -File -Recurse -Force |
        Where-Object { $_.Name -ne ".asset-import.json" -and $_.Extension -ne ".import" })
    if ($candidateFiles.Count -ne [int]$marker.files) {
        $errors.Add("candidate file count mismatch: $($package.id) expected $($marker.files), got $($candidateFiles.Count)")
    }
}

foreach ($directory in @($catalog.directories)) {
    if (-not (Test-SelectedId -Id $directory.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $directory.directory
    $targetPath = Join-Path $libraryRoot $directory.id
    $markerPath = Join-Path $targetPath ".asset-import.json"
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        $errors.Add("missing source directory: $($directory.directory)")
        continue
    }
    if (-not (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        $errors.Add("missing import marker: $($directory.id)")
        continue
    }
    $sourceFiles = @(Get-CandidateAssetFiles -Root $sourcePath)
    $sourceHash = Get-DirectoryFingerprint -Root $sourcePath -Files $sourceFiles
    $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($sourceHash -ne $directory.sha256.ToUpperInvariant()) {
        $errors.Add("directory hash mismatch: $($directory.directory)")
    }
    if ($marker.sha256 -ne $sourceHash) {
        $errors.Add("marker hash mismatch: $($directory.id)")
    }
    $candidateFiles = @(Get-ChildItem -LiteralPath $targetPath -File -Recurse -Force |
        Where-Object { $_.Name -ne ".asset-import.json" -and $_.Extension -ne ".import" })
    if ($candidateFiles.Count -ne [int]$marker.files) {
        $errors.Add("candidate file count mismatch: $($directory.id) expected $($marker.files), got $($candidateFiles.Count)")
    }
}

$looseRoot = Join-Path $libraryRoot "_loose"
foreach ($looseFile in @($catalog.loose_files)) {
    if (-not (Test-SelectedId -Id $looseFile.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $looseFile.file
    $targetPath = Join-Path $looseRoot $looseFile.target_name
    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        $errors.Add("missing loose source: $($looseFile.file)")
        continue
    }
    if (-not (Test-Path -LiteralPath $targetPath -PathType Leaf)) {
        $errors.Add("missing loose import: $($looseFile.id)")
        continue
    }
    $sourceHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToUpperInvariant()
    $targetHash = (Get-FileHash -LiteralPath $targetPath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($sourceHash -ne $looseFile.sha256.ToUpperInvariant() -or $targetHash -ne $sourceHash) {
        $errors.Add("loose hash mismatch: $($looseFile.id)")
    }
}

$importableExtensions = @(
    ".png", ".jpg", ".jpeg", ".webp", ".bmp", ".svg",
    ".wav", ".ogg", ".mp3", ".flac", ".ttf", ".otf"
)
$importableFiles = @(Get-ChildItem -LiteralPath $libraryRoot -File -Recurse |
    Where-Object { $importableExtensions -contains $_.Extension.ToLowerInvariant() })
$missingSidecars = @($importableFiles | Where-Object {
    -not (Test-Path -LiteralPath ($_.FullName + ".import") -PathType Leaf)
})
foreach ($missing in $missingSidecars) {
    $errors.Add("Godot import missing: $($missing.FullName)")
}

$pngFiles = @($importableFiles | Where-Object Extension -eq ".png")
$invalidPixelImports = @()
foreach ($pngFile in $pngFiles) {
    $sidecarPath = $pngFile.FullName + ".import"
    if (-not (Test-Path -LiteralPath $sidecarPath -PathType Leaf)) {
        continue
    }
    $sidecar = Get-Content -LiteralPath $sidecarPath -Raw
    if ($sidecar -notmatch 'compress/mode=0' -or $sidecar -notmatch 'mipmaps/generate=false') {
        $invalidPixelImports += $pngFile
    }
}
foreach ($invalidPixelImport in $invalidPixelImports) {
    $errors.Add("non-pixel PNG import preset: $($invalidPixelImport.FullName)")
}

$allEntries = @($catalog.packages) + @($catalog.directories) + @($catalog.loose_files) |
    Where-Object { Test-SelectedId -Id $_.id }
$missingLicenseProof = @($allEntries | Where-Object license_status -eq "missing_local_proof")

Write-Host "Downloaded asset library validation"
Write-Host "  packages: $(@($catalog.packages).Count)"
Write-Host "  directories: $(@($catalog.directories).Count)"
Write-Host "  loose files: $(@($catalog.loose_files).Count)"
Write-Host "  Godot-importable files: $($importableFiles.Count)"
Write-Host "  PNG pixel presets: $($pngFiles.Count - $invalidPixelImports.Count)/$($pngFiles.Count)"
Write-Host "  missing local license proof: $($missingLicenseProof.Count) (candidate gate, not an import failure)"

if ($errors.Count -gt 0) {
    foreach ($validationError in $errors) {
        Write-Error $validationError
    }
    exit 1
}

Write-Host "PASS: all catalog hashes, candidate files and Godot imports are present."
