[CmdletBinding()]
param(
    [string]$DownloadsPath = (Join-Path $env:USERPROFILE "Downloads"),
    [string]$ProjectRoot = "",
    [string[]]$OnlyIds = @(),
    [switch]$Force
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ProjectRoot)) {
    $ProjectRoot = Split-Path -Parent $PSScriptRoot
}

$catalogPath = Join-Path $ProjectRoot "data/asset_library/download_catalog.json"
$libraryRoot = Join-Path $ProjectRoot "assets/library/downloaded"
$stageRoot = Join-Path ([IO.Path]::GetPathRoot($ProjectRoot)) ".soul_of_hero_asset_import"

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

function Assert-SafeChildPath {
    param([string]$Parent, [string]$Child)

    $parentFull = [IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childFull = [IO.Path]::GetFullPath($Child)
    if (-not $childFull.StartsWith($parentFull, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe path outside expected root: $childFull"
    }
}

function Remove-SafeTree {
    param([string]$Parent, [string]$Child)

    Assert-SafeChildPath -Parent $Parent -Child $Child
    if (Test-Path -LiteralPath $Child) {
        try {
            Remove-Item -LiteralPath $Child -Recurse -Force
        }
        catch {
            # Windows PowerShell 5 can fail on long nested cache paths even
            # when the path is valid. The extended-path .NET fallback keeps
            # deletion inside the already-verified staging root.
            $fullPath = [IO.Path]::GetFullPath($Child)
            [IO.Directory]::Delete("\\?\$fullPath", $true)
        }
    }
}

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
    param(
        [string]$Root,
        [string[]]$AdditionalExtensions = @()
    )

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
            (($allowedExtensions -contains $extension) -or ($AdditionalExtensions -contains $extension))
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

if (-not (Test-Path -LiteralPath $catalogPath -PathType Leaf)) {
    throw "Missing catalog: $catalogPath"
}

$catalog = Get-Content -LiteralPath $catalogPath -Raw -Encoding UTF8 | ConvertFrom-Json
New-Item -ItemType Directory -Path $libraryRoot -Force | Out-Null
New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

$results = @()

foreach ($package in $catalog.packages) {
    if (-not (Test-SelectedId -Id $package.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $package.archive
    $targetPath = Join-Path $libraryRoot $package.id
    $markerPath = Join-Path $targetPath ".asset-import.json"
    $stagePath = Join-Path $stageRoot $package.id

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Missing archive for '$($package.id)': $sourcePath"
    }

    $actualHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $package.sha256.ToUpperInvariant()) {
        throw "SHA-256 mismatch for '$($package.archive)'. Expected $($package.sha256), got $actualHash"
    }

    if ((-not $Force) -and (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($marker.sha256 -eq $actualHash) {
            $results += [pscustomobject]@{
                id = $package.id
                status = "already_imported"
                files = [int]$marker.files
                bytes = [long]$marker.bytes
            }
            continue
        }
    }

    Remove-SafeTree -Parent $stageRoot -Child $stagePath
    New-Item -ItemType Directory -Path $stagePath -Force | Out-Null

    # Windows tar in this workspace cannot open a non-ASCII archive path even
    # though PowerShell and .NET can. Use a verified staging alias while keeping
    # the original Downloads archive as the hash authority.
    $archiveReadPath = $sourcePath
    if ($sourcePath -match '[^\x00-\x7F]') {
        $archiveReadPath = Join-Path $stagePath ("_source" + [IO.Path]::GetExtension($sourcePath))
        Copy-Item -LiteralPath $sourcePath -Destination $archiveReadPath -Force
    }

    $entries = @(& tar -tf $archiveReadPath 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not list '$sourcePath': $($entries -join [Environment]::NewLine)"
    }
    foreach ($entry in $entries) {
        $normalized = ([string]$entry).Replace('\', '/')
        if ($normalized.StartsWith('/') -or $normalized -match '^[A-Za-z]:' -or
            $normalized.Split('/') -contains '..') {
            throw "Unsafe archive entry in '$($package.archive)': $entry"
        }
    }

    $extractOutput = @(& tar -xf $archiveReadPath -C $stagePath 2>&1)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not extract '$sourcePath': $($extractOutput -join [Environment]::NewLine)"
    }

    $selected = @(Get-CandidateAssetFiles -Root $stagePath -AdditionalExtensions @($package.include_extensions))

    if ($selected.Count -eq 0) {
        throw "Archive '$($package.archive)' contained no supported candidate asset files."
    }

    $relativeFiles = @($selected | ForEach-Object {
        Get-RelativePathCompat -Parent $stagePath -Child $_.FullName
    })

    $firstSegments = @($relativeFiles | ForEach-Object {
        $_.Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)[0]
    } | Select-Object -Unique)
    $stripFirstDirectory = $false
    if ($firstSegments.Count -eq 1) {
        $candidateRoot = Join-Path $stagePath $firstSegments[0]
        $stripFirstDirectory = Test-Path -LiteralPath $candidateRoot -PathType Container
    }

    if (Test-Path -LiteralPath $targetPath) {
        Remove-SafeTree -Parent $libraryRoot -Child $targetPath
    }
    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null

    $copiedBytes = 0L
    foreach ($file in $selected) {
        $relative = Get-RelativePathCompat -Parent $stagePath -Child $file.FullName
        if ($stripFirstDirectory) {
            $relative = $relative.Substring($firstSegments[0].Length).TrimStart('\', '/')
        }
        if ([string]::IsNullOrWhiteSpace($relative)) {
            continue
        }
        $destination = Join-Path $targetPath $relative
        Assert-SafeChildPath -Parent $targetPath -Child $destination
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $copiedBytes += $file.Length
    }

    $marker = [ordered]@{
        schema_version = 1
        package_id = $package.id
        archive = $package.archive
        sha256 = $actualHash
        imported_at = [DateTime]::UtcNow.ToString("o")
        files = $selected.Count
        bytes = $copiedBytes
        categories = @($package.categories)
        license_status = $package.license_status
    }
    $marker | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $markerPath -Encoding UTF8

    $results += [pscustomobject]@{
        id = $package.id
        status = "imported"
        files = $selected.Count
        bytes = $copiedBytes
    }
    Remove-SafeTree -Parent $stageRoot -Child $stagePath
}

foreach ($directory in @($catalog.directories)) {
    if (-not (Test-SelectedId -Id $directory.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $directory.directory
    $targetPath = Join-Path $libraryRoot $directory.id
    $markerPath = Join-Path $targetPath ".asset-import.json"

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Container)) {
        throw "Missing source directory for '$($directory.id)': $sourcePath"
    }

    $selected = @(Get-CandidateAssetFiles -Root $sourcePath)
    if ($selected.Count -eq 0) {
        throw "Directory '$($directory.directory)' contained no supported candidate asset files."
    }
    $actualHash = Get-DirectoryFingerprint -Root $sourcePath -Files $selected
    if ($actualHash -ne $directory.sha256.ToUpperInvariant()) {
        throw "Directory SHA-256 mismatch for '$($directory.directory)'. Expected $($directory.sha256), got $actualHash"
    }

    if ((-not $Force) -and (Test-Path -LiteralPath $markerPath -PathType Leaf)) {
        $marker = Get-Content -LiteralPath $markerPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($marker.sha256 -eq $actualHash) {
            $results += [pscustomobject]@{
                id = $directory.id
                kind = "directory"
                status = "already_imported"
                files = [int]$marker.files
                bytes = [long]$marker.bytes
            }
            continue
        }
    }

    $relativeFiles = @($selected | ForEach-Object {
        Get-RelativePathCompat -Parent $sourcePath -Child $_.FullName
    })
    $firstSegments = @($relativeFiles | ForEach-Object {
        $_.Split([char[]]@('\', '/'), [StringSplitOptions]::RemoveEmptyEntries)[0]
    } | Select-Object -Unique)
    $stripFirstDirectory = $false
    if ($firstSegments.Count -eq 1) {
        $candidateRoot = Join-Path $sourcePath $firstSegments[0]
        $stripFirstDirectory = Test-Path -LiteralPath $candidateRoot -PathType Container
    }

    if (Test-Path -LiteralPath $targetPath) {
        Remove-SafeTree -Parent $libraryRoot -Child $targetPath
    }
    New-Item -ItemType Directory -Path $targetPath -Force | Out-Null

    $copiedBytes = 0L
    foreach ($file in $selected) {
        $relative = Get-RelativePathCompat -Parent $sourcePath -Child $file.FullName
        if ($stripFirstDirectory) {
            $relative = $relative.Substring($firstSegments[0].Length).TrimStart('\', '/')
        }
        if ([string]::IsNullOrWhiteSpace($relative)) {
            continue
        }
        $destination = Join-Path $targetPath $relative
        Assert-SafeChildPath -Parent $targetPath -Child $destination
        New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
        Copy-Item -LiteralPath $file.FullName -Destination $destination -Force
        $copiedBytes += $file.Length
    }

    $marker = [ordered]@{
        schema_version = 1
        package_id = $directory.id
        source_kind = "directory"
        directory = $directory.directory
        sha256 = $actualHash
        imported_at = [DateTime]::UtcNow.ToString("o")
        files = $selected.Count
        bytes = $copiedBytes
        categories = @($directory.categories)
        license_status = $directory.license_status
    }
    $marker | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $markerPath -Encoding UTF8

    $results += [pscustomobject]@{
        id = $directory.id
        kind = "directory"
        status = "imported"
        files = $selected.Count
        bytes = $copiedBytes
    }
}

$looseTargetRoot = Join-Path $libraryRoot "_loose"
New-Item -ItemType Directory -Path $looseTargetRoot -Force | Out-Null
foreach ($looseFile in @($catalog.loose_files)) {
    if (-not (Test-SelectedId -Id $looseFile.id)) {
        continue
    }
    $sourcePath = Join-Path $DownloadsPath $looseFile.file
    $destination = Join-Path $looseTargetRoot $looseFile.target_name
    Assert-SafeChildPath -Parent $looseTargetRoot -Child $destination

    if (-not (Test-Path -LiteralPath $sourcePath -PathType Leaf)) {
        throw "Missing loose asset '$($looseFile.id)': $sourcePath"
    }
    $actualHash = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToUpperInvariant()
    if ($actualHash -ne $looseFile.sha256.ToUpperInvariant()) {
        throw "SHA-256 mismatch for '$($looseFile.file)'. Expected $($looseFile.sha256), got $actualHash"
    }

    $status = "imported"
    if (Test-Path -LiteralPath $destination -PathType Leaf) {
        $destinationHash = (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash.ToUpperInvariant()
        if ($destinationHash -eq $actualHash) {
            $status = "already_imported"
        }
        elseif (-not $Force) {
            throw "Refusing to overwrite changed loose asset without -Force: $destination"
        }
    }
    if ($status -eq "imported") {
        Copy-Item -LiteralPath $sourcePath -Destination $destination -Force
    }

    $sourceInfo = Get-Item -LiteralPath $sourcePath
    $results += [pscustomobject]@{
        id = $looseFile.id
        kind = "loose_file"
        status = $status
        files = 1
        bytes = $sourceInfo.Length
    }
}

$summary = [ordered]@{
    schema_version = 1
    generated_at = [DateTime]::UtcNow.ToString("o")
    packages = @($catalog.packages).Count
    directories = @($catalog.directories).Count
    loose_files = @($catalog.loose_files).Count
    entries = $results.Count
    imported = @($results | Where-Object status -eq "imported").Count
    already_imported = @($results | Where-Object status -eq "already_imported").Count
    files = ($results | Measure-Object files -Sum).Sum
    bytes = ($results | Measure-Object bytes -Sum).Sum
    results = $results
}
$summaryPath = Join-Path $libraryRoot "_import-summary.json"
$summary | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 6
