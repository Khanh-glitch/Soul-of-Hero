[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$PackageRoot,

    [string]$SceneGuid = "8c13838df8e680749ae1bb30cfe63339",

    [string]$OutputPath = ".artifacts/cainos_sc_demo.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Read-UnityDocuments {
    param([Parameter(Mandatory = $true)][string]$Text)

    $pattern = '(?ms)^--- !u!(?<class>\d+) &(?<id>-?\d+)(?<stripped> stripped)?\r?\n(?<body>.*?)(?=^--- !u!|\z)'
    $documents = @()
    foreach ($match in [regex]::Matches($Text, $pattern)) {
        $documents += [pscustomobject][ordered]@{
            class_id = [int64]$match.Groups["class"].Value
            file_id = $match.Groups["id"].Value
            stripped = $match.Groups["stripped"].Success
            body = $match.Groups["body"].Value
        }
    }
    return ,$documents
}

function Get-FirstCapture {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Pattern,
        [string]$Default = ""
    )

    $match = [regex]::Match($Text, $Pattern)
    if (-not $match.Success -and $Pattern.EndsWith('$') -and -not $Pattern.EndsWith('\r?$')) {
        $crlfPattern = $Pattern.Substring(0, $Pattern.Length - 1) + '\r?$'
        $match = [regex]::Match($Text, $crlfPattern)
    }
    if ($match.Success) {
        return $match.Groups[1].Value
    }
    return $Default
}

function Convert-InvariantDouble {
    param([Parameter(Mandatory = $true)][string]$Value)

    return [double]::Parse(
        $Value,
        [Globalization.NumberStyles]::Float,
        [Globalization.CultureInfo]::InvariantCulture
    )
}

function Read-Vector2 {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Field,
        [double]$DefaultX = 0.0,
        [double]$DefaultY = 0.0
    )

    $pattern = '(?m)^\s*' + [regex]::Escape($Field) + ': \{x: ([^,]+), y: ([^}]+)\}'
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        return [pscustomobject][ordered]@{ x = $DefaultX; y = $DefaultY }
    }
    return [pscustomobject][ordered]@{
        x = Convert-InvariantDouble $match.Groups[1].Value
        y = Convert-InvariantDouble $match.Groups[2].Value
    }
}

function Read-Vector3 {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Field,
        [double]$DefaultX = 0.0,
        [double]$DefaultY = 0.0,
        [double]$DefaultZ = 0.0
    )

    $pattern = '(?m)^\s*' + [regex]::Escape($Field) + ': \{x: ([^,]+), y: ([^,]+), z: ([^}]+)\}'
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        return [pscustomobject][ordered]@{ x = $DefaultX; y = $DefaultY; z = $DefaultZ }
    }
    return [pscustomobject][ordered]@{
        x = Convert-InvariantDouble $match.Groups[1].Value
        y = Convert-InvariantDouble $match.Groups[2].Value
        z = Convert-InvariantDouble $match.Groups[3].Value
    }
}

function Read-Quaternion {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Field
    )

    $pattern = '(?m)^\s*' + [regex]::Escape($Field) + ': \{x: ([^,]+), y: ([^,]+), z: ([^,]+), w: ([^}]+)\}'
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        return [pscustomobject][ordered]@{ x = 0.0; y = 0.0; z = 0.0; w = 1.0 }
    }
    return [pscustomobject][ordered]@{
        x = Convert-InvariantDouble $match.Groups[1].Value
        y = Convert-InvariantDouble $match.Groups[2].Value
        z = Convert-InvariantDouble $match.Groups[3].Value
        w = Convert-InvariantDouble $match.Groups[4].Value
    }
}

function Read-Color {
    param(
        [Parameter(Mandatory = $true)][string]$Text,
        [Parameter(Mandatory = $true)][string]$Field
    )

    $pattern = '(?m)^\s*' + [regex]::Escape($Field) + ': \{r: ([^,]+), g: ([^,]+), b: ([^,]+), a: ([^}]+)\}'
    $match = [regex]::Match($Text, $pattern)
    if (-not $match.Success) {
        return [pscustomobject][ordered]@{ r = 1.0; g = 1.0; b = 1.0; a = 1.0 }
    }
    return [pscustomobject][ordered]@{
        r = Convert-InvariantDouble $match.Groups[1].Value
        g = Convert-InvariantDouble $match.Groups[2].Value
        b = Convert-InvariantDouble $match.Groups[3].Value
        a = Convert-InvariantDouble $match.Groups[4].Value
    }
}

function Read-PngDimensions {
    param([Parameter(Mandatory = $true)][string]$Path)

    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -lt 24 -or $bytes[1] -ne 80 -or $bytes[2] -ne 78 -or $bytes[3] -ne 71) {
        throw "Not a valid PNG: $Path"
    }
    $width = ($bytes[16] -shl 24) -bor ($bytes[17] -shl 16) -bor ($bytes[18] -shl 8) -bor $bytes[19]
    $height = ($bytes[20] -shl 24) -bor ($bytes[21] -shl 16) -bor ($bytes[22] -shl 8) -bor $bytes[23]
    return [pscustomobject][ordered]@{ width = $width; height = $height }
}

function Get-ArrayEntries {
    param(
        [Parameter(Mandatory = $true)][string]$Body,
        [Parameter(Mandatory = $true)][string]$StartField,
        [Parameter(Mandatory = $true)][string]$EndField
    )

    $sectionPattern = '(?ms)^  ' + [regex]::Escape($StartField) + ':\r?\n(?<section>.*?)(?=^  ' + [regex]::Escape($EndField) + ':)'
    $sectionMatch = [regex]::Match($Body, $sectionPattern)
    if (-not $sectionMatch.Success) {
        return ,@()
    }
    $entries = @()
    $entryPattern = '(?ms)^  - m_RefCount: (?<refs>\d+)\r?\n    m_Data: \{fileID: (?<file>-?\d+)(?:, guid: (?<guid>[0-9a-f]+), type: (?<type>\d+))?\}'
    foreach ($match in [regex]::Matches($sectionMatch.Groups["section"].Value, $entryPattern)) {
        $entries += [pscustomobject][ordered]@{
            ref_count = [int]$match.Groups["refs"].Value
            file_id = $match.Groups["file"].Value
            guid = $match.Groups["guid"].Value
            type = if ($match.Groups["type"].Success) { [int]$match.Groups["type"].Value } else { 0 }
        }
    }
    return ,$entries
}

function Get-ColorArrayEntries {
    param([Parameter(Mandatory = $true)][string]$Body)

    $sectionMatch = [regex]::Match(
        $Body,
        '(?ms)^  m_TileColorArray:\r?\n(?<section>.*?)(?=^  m_TileObjectToInstantiateArray:)'
    )
    if (-not $sectionMatch.Success) {
        return ,@()
    }
    $entries = @()
    $pattern = '(?ms)^  - m_RefCount: (?<refs>\d+)\r?\n    m_Data: \{r: (?<r>[^,]+), g: (?<g>[^,]+), b: (?<b>[^,]+), a: (?<a>[^}]+)\}'
    foreach ($match in [regex]::Matches($sectionMatch.Groups["section"].Value, $pattern)) {
        $entries += [pscustomobject][ordered]@{
            ref_count = [int]$match.Groups["refs"].Value
            color = [pscustomobject][ordered]@{
                r = Convert-InvariantDouble $match.Groups["r"].Value
                g = Convert-InvariantDouble $match.Groups["g"].Value
                b = Convert-InvariantDouble $match.Groups["b"].Value
                a = Convert-InvariantDouble $match.Groups["a"].Value
            }
        }
    }
    return ,$entries
}

$packagePath = (Resolve-Path -LiteralPath $PackageRoot).Path
$packageIndex = @{}
foreach ($directory in Get-ChildItem -LiteralPath $packagePath -Directory) {
    $pathnameFile = Join-Path $directory.FullName "pathname"
    if (-not (Test-Path -LiteralPath $pathnameFile)) {
        continue
    }
    $guid = $directory.Name
    $packageIndex[$guid] = [pscustomobject][ordered]@{
        guid = $guid
        pathname = ([IO.File]::ReadAllText($pathnameFile)).Trim()
        asset_path = Join-Path $directory.FullName "asset"
        meta_path = Join-Path $directory.FullName "asset.meta"
    }
}

if (-not $packageIndex.ContainsKey($SceneGuid)) {
    throw "Scene GUID $SceneGuid is not present in $packagePath"
}

$sortingLayersById = @{}
$tagManagerEntry = $packageIndex.Values | Where-Object { $_.pathname -eq "ProjectSettings/TagManager.asset" } | Select-Object -First 1
if ($null -ne $tagManagerEntry -and (Test-Path -LiteralPath $tagManagerEntry.asset_path)) {
    $tagText = [IO.File]::ReadAllText($tagManagerEntry.asset_path)
    foreach ($match in [regex]::Matches($tagText, '(?ms)^  - name: (?<name>[^\r\n]+)\r?\n    uniqueID: (?<id>\d+)')) {
        $unsigned = [uint32]::Parse($match.Groups["id"].Value)
        $signed = [BitConverter]::ToInt32([BitConverter]::GetBytes($unsigned), 0)
        $sortingLayersById[[string]$signed] = $match.Groups["name"].Value
    }
}

$textures = @{}
foreach ($entry in $packageIndex.Values) {
    if ($entry.pathname -notmatch '(?i)\.png$') {
        continue
    }
    if (-not (Test-Path -LiteralPath $entry.asset_path) -or -not (Test-Path -LiteralPath $entry.meta_path)) {
        continue
    }
    $dimensions = Read-PngDimensions $entry.asset_path
    $meta = [IO.File]::ReadAllText($entry.meta_path)
    $pixelsPerUnitText = Get-FirstCapture $meta '(?m)^  spritePixelsToUnits: ([^\r\n]+)$' "100"
    $sprites = @{}
    $spritePattern = '(?ms)^    - serializedVersion: \d+\r?\n      name: (?<name>[^\r\n]+)\r?\n      rect:\r?\n        serializedVersion: \d+\r?\n        x: (?<x>[^\r\n]+)\r?\n        y: (?<y>[^\r\n]+)\r?\n        width: (?<w>[^\r\n]+)\r?\n        height: (?<h>[^\r\n]+).*?^      alignment: (?<alignment>\d+)\r?\n      pivot: \{x: (?<px>[^,]+), y: (?<py>[^}]+)\}.*?^      internalID: (?<id>-?\d+)\r?$'
    foreach ($match in [regex]::Matches($meta, $spritePattern)) {
        $x = Convert-InvariantDouble $match.Groups["x"].Value
        $unityY = Convert-InvariantDouble $match.Groups["y"].Value
        $width = Convert-InvariantDouble $match.Groups["w"].Value
        $height = Convert-InvariantDouble $match.Groups["h"].Value
        $topY = $dimensions.height - $unityY - $height
        $physicsPaths = @()
        $physicsSection = [regex]::Match(
            $match.Value,
            '(?ms)^      physicsShape:\r?\n(?<section>.*?)(?=^      [a-zA-Z_]|\z)'
        )
        if ($physicsSection.Success) {
            $currentPhysicsPath = $null
            foreach ($line in ($physicsSection.Groups["section"].Value -split "`r?`n")) {
                $pathStart = [regex]::Match($line, '^      - - \{x: (?<x>[^,]+), y: (?<y>[^}]+)\}')
                $pathPoint = [regex]::Match($line, '^        - \{x: (?<x>[^,]+), y: (?<y>[^}]+)\}')
                if ($pathStart.Success) {
                    if ($null -ne $currentPhysicsPath) {
                        $physicsPaths += ,$currentPhysicsPath
                    }
                    $currentPhysicsPath = @([pscustomobject][ordered]@{
                        x = Convert-InvariantDouble $pathStart.Groups["x"].Value
                        y = Convert-InvariantDouble $pathStart.Groups["y"].Value
                    })
                }
                elseif ($pathPoint.Success -and $null -ne $currentPhysicsPath) {
                    $currentPhysicsPath += [pscustomobject][ordered]@{
                        x = Convert-InvariantDouble $pathPoint.Groups["x"].Value
                        y = Convert-InvariantDouble $pathPoint.Groups["y"].Value
                    }
                }
            }
            if ($null -ne $currentPhysicsPath) {
                $physicsPaths += ,$currentPhysicsPath
            }
        }
        $sprite = [pscustomobject][ordered]@{
            file_id = $match.Groups["id"].Value
            name = $match.Groups["name"].Value
            unity_rect_bottom_left = [pscustomobject][ordered]@{ x = $x; y = $unityY; width = $width; height = $height }
            source_rect_top_left = [pscustomobject][ordered]@{ x = $x; y = $topY; width = $width; height = $height }
            pivot = [pscustomobject][ordered]@{
                x = Convert-InvariantDouble $match.Groups["px"].Value
                y = Convert-InvariantDouble $match.Groups["py"].Value
            }
            alignment = [int]$match.Groups["alignment"].Value
            physics_paths_unity_px = $physicsPaths
        }
        $sprites[$sprite.file_id] = $sprite
    }
    $textures[$entry.guid] = [pscustomobject][ordered]@{
        guid = $entry.guid
        pathname = $entry.pathname
        package_asset_path = $entry.asset_path
        width = $dimensions.width
        height = $dimensions.height
        pixels_per_unit = Convert-InvariantDouble $pixelsPerUnitText
        sprites_by_file_id = $sprites
    }
}

$tileAssets = @{}
foreach ($entry in $packageIndex.Values) {
    if ($entry.pathname -notmatch '(?i)/Tile Palette/.+\.asset$' -or -not (Test-Path -LiteralPath $entry.asset_path)) {
        continue
    }
    $body = [IO.File]::ReadAllText($entry.asset_path)
    $spriteMatch = [regex]::Match($body, '(?m)^  m_Sprite: \{fileID: (?<file>-?\d+), guid: (?<guid>[0-9a-f]+), type: \d+\}')
    if (-not $spriteMatch.Success) {
        continue
    }
    $tileAssets[$entry.guid] = [pscustomobject][ordered]@{
        guid = $entry.guid
        pathname = $entry.pathname
        name = Get-FirstCapture $body '(?m)^  m_Name: ([^\r\n]+)$'
        sprite_file_id = $spriteMatch.Groups["file"].Value
        texture_guid = $spriteMatch.Groups["guid"].Value
        collider_type = [int](Get-FirstCapture $body '(?m)^  m_ColliderType: (\d+)$' "0")
        flags = [int](Get-FirstCapture $body '(?m)^  m_Flags: (\d+)$' "0")
        color = Read-Color $body "m_Color"
    }
}

$sceneEntry = $packageIndex[$SceneGuid]
$sceneText = [IO.File]::ReadAllText($sceneEntry.asset_path)
$sceneDocuments = Read-UnityDocuments $sceneText
$documentsById = @{}
$gameObjects = @{}
$componentToGameObject = @{}
$transforms = @{}
foreach ($document in $sceneDocuments) {
    $documentsById[$document.file_id] = $document
    if ($document.class_id -eq 1) {
        $components = @()
        foreach ($match in [regex]::Matches($document.body, '(?m)^  - component: \{fileID: (-?\d+)\}$')) {
            $componentId = $match.Groups[1].Value
            $components += $componentId
            $componentToGameObject[$componentId] = $document.file_id
        }
        $gameObjects[$document.file_id] = [pscustomobject][ordered]@{
            file_id = $document.file_id
            name = Get-FirstCapture $document.body '(?m)^  m_Name: ([^\r\n]*)$'
            layer = [int](Get-FirstCapture $document.body '(?m)^  m_Layer: (-?\d+)$' "0")
            active = (Get-FirstCapture $document.body '(?m)^  m_IsActive: (\d+)$' "1") -eq "1"
            components = $components
        }
    }
    elseif ($document.class_id -eq 4 -and -not $document.stripped) {
        $transforms[$document.file_id] = [pscustomobject][ordered]@{
            file_id = $document.file_id
            game_object_file_id = Get-FirstCapture $document.body '(?m)^  m_GameObject: \{fileID: (-?\d+)\}' "0"
            parent_file_id = Get-FirstCapture $document.body '(?m)^  m_Father: \{fileID: (-?\d+)\}' "0"
            root_order = [int](Get-FirstCapture $document.body '(?m)^  m_RootOrder: (-?\d+)$' "0")
            local_position = Read-Vector3 $document.body "m_LocalPosition"
            local_rotation = Read-Quaternion $document.body "m_LocalRotation"
            local_scale = Read-Vector3 $document.body "m_LocalScale" 1.0 1.0 1.0
        }
    }
}

function Get-GameObjectNameForComponent {
    param([string]$ComponentId)

    if (-not $componentToGameObject.ContainsKey($ComponentId)) {
        return ""
    }
    $gameObjectId = $componentToGameObject[$ComponentId]
    if (-not $gameObjects.ContainsKey($gameObjectId)) {
        return ""
    }
    return $gameObjects[$gameObjectId].name
}

function Resolve-SpriteRecord {
    param([string]$TextureGuid, [string]$SpriteFileId)

    if (-not $textures.ContainsKey($TextureGuid)) {
        return $null
    }
    $texture = $textures[$TextureGuid]
    if (-not $texture.sprites_by_file_id.ContainsKey($SpriteFileId)) {
        return $null
    }
    $sprite = $texture.sprites_by_file_id[$SpriteFileId]
    return [pscustomobject][ordered]@{
        texture_guid = $TextureGuid
        texture_pathname = $texture.pathname
        texture_width = $texture.width
        texture_height = $texture.height
        pixels_per_unit = $texture.pixels_per_unit
        sprite_file_id = $SpriteFileId
        sprite_name = $sprite.name
        unity_rect_bottom_left = $sprite.unity_rect_bottom_left
        source_rect_top_left = $sprite.source_rect_top_left
        pivot = $sprite.pivot
        physics_paths_unity_px = $sprite.physics_paths_unity_px
    }
}

$tilemaps = @()
$allTileCells = @()
foreach ($document in $sceneDocuments) {
    if ($document.class_id -ne 1839735485) {
        continue
    }
    $gameObjectId = $componentToGameObject[$document.file_id]
    $gameObject = $gameObjects[$gameObjectId]
    $rendererDocument = $null
    $tilemapColliderDocument = $null
    $compositeColliderDocument = $null
    $rigidbodyDocument = $null
    $transform = $null
    foreach ($componentId in $gameObject.components) {
        if (-not $documentsById.ContainsKey($componentId)) {
            continue
        }
        $componentDocument = $documentsById[$componentId]
        if ($componentDocument.class_id -eq 483693784) {
            $rendererDocument = $componentDocument
        }
        elseif ($componentDocument.class_id -eq 19719996) {
            $tilemapColliderDocument = $componentDocument
        }
        elseif ($componentDocument.class_id -eq 66) {
            $compositeColliderDocument = $componentDocument
        }
        elseif ($componentDocument.class_id -eq 50) {
            $rigidbodyDocument = $componentDocument
        }
        elseif ($componentDocument.class_id -eq 4) {
            $transform = $transforms[$componentId]
        }
    }
    $assetArray = Get-ArrayEntries $document.body "m_TileAssetArray" "m_TileSpriteArray"
    $spriteArray = Get-ArrayEntries $document.body "m_TileSpriteArray" "m_TileMatrixArray"
    $colorArray = Get-ColorArrayEntries $document.body
    $cells = @()
    $cellPattern = '(?ms)^  - first: \{x: (?<x>-?\d+), y: (?<y>-?\d+), z: (?<z>-?\d+)\}\r?\n    second:\r?\n(?<data>.*?)(?=^  - first:|^  m_AnimatedTiles:)'
    foreach ($match in [regex]::Matches($document.body, $cellPattern)) {
        $data = $match.Groups["data"].Value
        $x = [int]$match.Groups["x"].Value
        $unityY = [int]$match.Groups["y"].Value
        $z = [int]$match.Groups["z"].Value
        $tileIndex = [int](Get-FirstCapture $data '(?m)^      m_TileIndex: (\d+)$' "0")
        $spriteIndex = [int](Get-FirstCapture $data '(?m)^      m_TileSpriteIndex: (\d+)$' "0")
        $colorIndex = [int](Get-FirstCapture $data '(?m)^      m_TileColorIndex: (\d+)$' "0")
        $tileAssetReference = $assetArray[$tileIndex]
        $cachedSpriteReference = $spriteArray[$spriteIndex]
        $tileAsset = $null
        $resolvedSprite = $null
        if ($tileAssets.ContainsKey($tileAssetReference.guid)) {
            $tileAsset = $tileAssets[$tileAssetReference.guid]
            $resolvedSprite = Resolve-SpriteRecord $tileAsset.texture_guid $tileAsset.sprite_file_id
        }
        $color = $null
        if ($colorIndex -ge 0 -and $colorIndex -lt $colorArray.Count) {
            $color = $colorArray[$colorIndex].color
        }
        $cell = [pscustomobject][ordered]@{
            unity_cell = [pscustomobject][ordered]@{ x = $x; y = $unityY; z = $z }
            godot_cell_top_left = [pscustomobject][ordered]@{ x = $x; y = -$unityY - 1 }
            godot_center_px = [pscustomobject][ordered]@{ x = ($x * 32) + 16; y = (-$unityY * 32) - 16 }
            tile_index = $tileIndex
            tile_asset_guid = $tileAssetReference.guid
            tile_asset_pathname = if ($null -ne $tileAsset) { $tileAsset.pathname } else { "" }
            tile_collider_type = if ($null -ne $tileAsset) { $tileAsset.collider_type } else { 0 }
            sprite_index = $spriteIndex
            cached_sprite = $cachedSpriteReference
            sprite = $resolvedSprite
            matrix_index = [int](Get-FirstCapture $data '(?m)^      m_TileMatrixIndex: (\d+)$' "0")
            color_index = $colorIndex
            color = $color
            flags = [uint32](Get-FirstCapture $data '(?m)^      m_AllTileFlags: (\d+)$' "0")
        }
        $cells += $cell
        $allTileCells += $cell
    }
    $renderer = $null
    if ($null -ne $rendererDocument) {
        $sortingLayerId = Get-FirstCapture $rendererDocument.body '(?m)^  m_SortingLayerID: (-?\d+)$' "0"
        $sortingLayerName = ""
        if ($sortingLayersById.ContainsKey($sortingLayerId)) {
            $sortingLayerName = $sortingLayersById[$sortingLayerId]
        }
        $renderer = [pscustomobject][ordered]@{
            sorting_layer_index = [int](Get-FirstCapture $rendererDocument.body '(?m)^  m_SortingLayer: (-?\d+)$' "0")
            sorting_layer_id = [int64]$sortingLayerId
            sorting_layer_name = $sortingLayerName
            sorting_order = [int](Get-FirstCapture $rendererDocument.body '(?m)^  m_SortingOrder: (-?\d+)$' "0")
            mode = [int](Get-FirstCapture $rendererDocument.body '(?m)^  m_Mode: (-?\d+)$' "0")
            sort_order = [int](Get-FirstCapture $rendererDocument.body '(?m)^  m_SortOrder: (-?\d+)$' "0")
        }
    }
    $physics = $null
    if ($null -ne $tilemapColliderDocument) {
        $tilemapCollider = [pscustomobject][ordered]@{
            enabled = (Get-FirstCapture $tilemapColliderDocument.body '(?m)^  m_Enabled: (\d+)$' "1") -eq "1"
            is_trigger = (Get-FirstCapture $tilemapColliderDocument.body '(?m)^  m_IsTrigger: (\d+)$' "0") -eq "1"
            used_by_composite = (Get-FirstCapture $tilemapColliderDocument.body '(?m)^  m_UsedByComposite: (\d+)$' "0") -eq "1"
            offset = Read-Vector2 $tilemapColliderDocument.body "m_Offset"
            extrusion_factor = Convert-InvariantDouble (Get-FirstCapture $tilemapColliderDocument.body '(?m)^  m_ExtrusionFactor: ([^\r\n]+)$' "0")
            maximum_tile_change_count = [int](Get-FirstCapture $tilemapColliderDocument.body '(?m)^  m_MaximumTileChangeCount: (\d+)$' "0")
        }
        $compositeCollider = $null
        if ($null -ne $compositeColliderDocument) {
            $compositeCollider = [pscustomobject][ordered]@{
                enabled = (Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_Enabled: (\d+)$' "1") -eq "1"
                is_trigger = (Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_IsTrigger: (\d+)$' "0") -eq "1"
                geometry_type = [int](Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_GeometryType: (\d+)$' "0")
                generation_type = [int](Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_GenerationType: (\d+)$' "0")
                offset = Read-Vector2 $compositeColliderDocument.body "m_Offset"
                edge_radius = Convert-InvariantDouble (Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_EdgeRadius: ([^\r\n]+)$' "0")
                vertex_distance = Convert-InvariantDouble (Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_VertexDistance: ([^\r\n]+)$' "0")
                offset_distance = Convert-InvariantDouble (Get-FirstCapture $compositeColliderDocument.body '(?m)^  m_OffsetDistance: ([^\r\n]+)$' "0")
            }
        }
        $rigidbody = $null
        if ($null -ne $rigidbodyDocument) {
            $rigidbody = [pscustomobject][ordered]@{
                body_type = [int](Get-FirstCapture $rigidbodyDocument.body '(?m)^  m_BodyType: (\d+)$' "0")
                simulated = (Get-FirstCapture $rigidbodyDocument.body '(?m)^  m_Simulated: (\d+)$' "1") -eq "1"
                gravity_scale = Convert-InvariantDouble (Get-FirstCapture $rigidbodyDocument.body '(?m)^  m_GravityScale: ([^\r\n]+)$' "0")
                constraints = [int](Get-FirstCapture $rigidbodyDocument.body '(?m)^  m_Constraints: (\d+)$' "0")
            }
        }
        $physics = [pscustomobject][ordered]@{
            tilemap_collider = $tilemapCollider
            composite_collider = $compositeCollider
            rigidbody = $rigidbody
        }
    }
    $tilemaps += [pscustomobject][ordered]@{
        name = $gameObject.name
        game_object_file_id = $gameObjectId
        tilemap_file_id = $document.file_id
        transform = $transform
        origin = Read-Vector3 $document.body "m_Origin"
        size = Read-Vector3 $document.body "m_Size"
        tile_anchor = Read-Vector3 $document.body "m_TileAnchor" 0.5 0.5 0.0
        renderer = $renderer
        physics = $physics
        cell_count = $cells.Count
        cells = $cells
    }
}

$prefabModels = @{}
function Get-PrefabModel {
    param([Parameter(Mandatory = $true)][string]$Guid)

    if ($prefabModels.ContainsKey($Guid)) {
        return $prefabModels[$Guid]
    }
    if (-not $packageIndex.ContainsKey($Guid)) {
        return $null
    }
    $entry = $packageIndex[$Guid]
    if (-not (Test-Path -LiteralPath $entry.asset_path)) {
        return $null
    }
    $documents = Read-UnityDocuments ([IO.File]::ReadAllText($entry.asset_path))
    $docsById = @{}
    $objects = @{}
    $componentMap = @{}
    foreach ($document in $documents) {
        $docsById[$document.file_id] = $document
        if ($document.class_id -ne 1) {
            continue
        }
        $components = @()
        foreach ($match in [regex]::Matches($document.body, '(?m)^  - component: \{fileID: (-?\d+)\}$')) {
            $componentId = $match.Groups[1].Value
            $components += $componentId
            $componentMap[$componentId] = $document.file_id
        }
        $objects[$document.file_id] = [pscustomobject][ordered]@{
            file_id = $document.file_id
            name = Get-FirstCapture $document.body '(?m)^  m_Name: ([^\r\n]*)$'
            layer = [int](Get-FirstCapture $document.body '(?m)^  m_Layer: (-?\d+)$' "0")
            active = (Get-FirstCapture $document.body '(?m)^  m_IsActive: (\d+)$' "1") -eq "1"
            components = $components
        }
    }
    $modelTransforms = @()
    $rootTransformId = ""
    foreach ($document in $documents) {
        if ($document.class_id -ne 4) {
            continue
        }
        $parentId = Get-FirstCapture $document.body '(?m)^  m_Father: \{fileID: (-?\d+)\}' "0"
        if ($parentId -eq "0") {
            $rootTransformId = $document.file_id
        }
        $objectId = Get-FirstCapture $document.body '(?m)^  m_GameObject: \{fileID: (-?\d+)\}' "0"
        $modelTransforms += [pscustomobject][ordered]@{
            file_id = $document.file_id
            game_object_file_id = $objectId
            game_object_name = if ($objects.ContainsKey($objectId)) { $objects[$objectId].name } else { "" }
            parent_file_id = $parentId
            root_order = [int](Get-FirstCapture $document.body '(?m)^  m_RootOrder: (-?\d+)$' "0")
            local_position = Read-Vector3 $document.body "m_LocalPosition"
            local_rotation = Read-Quaternion $document.body "m_LocalRotation"
            local_scale = Read-Vector3 $document.body "m_LocalScale" 1.0 1.0 1.0
        }
    }
    $spriteRenderers = @()
    foreach ($document in $documents) {
        if ($document.class_id -ne 212) {
            continue
        }
        $spriteMatch = [regex]::Match($document.body, '(?m)^  m_Sprite: \{fileID: (?<file>-?\d+), guid: (?<guid>[0-9a-f]+), type: \d+\}')
        $objectId = Get-FirstCapture $document.body '(?m)^  m_GameObject: \{fileID: (-?\d+)\}' "0"
        $sortingLayerId = Get-FirstCapture $document.body '(?m)^  m_SortingLayerID: (-?\d+)$' "0"
        $sortingLayerName = ""
        if ($sortingLayersById.ContainsKey($sortingLayerId)) {
            $sortingLayerName = $sortingLayersById[$sortingLayerId]
        }
        $spriteRecord = $null
        if ($spriteMatch.Success) {
            $spriteRecord = Resolve-SpriteRecord $spriteMatch.Groups["guid"].Value $spriteMatch.Groups["file"].Value
        }
        $spriteRenderers += [pscustomobject][ordered]@{
            file_id = $document.file_id
            game_object_file_id = $objectId
            game_object_name = if ($objects.ContainsKey($objectId)) { $objects[$objectId].name } else { "" }
            enabled = (Get-FirstCapture $document.body '(?m)^  m_Enabled: (\d+)$' "1") -eq "1"
            color = Read-Color $document.body "m_Color"
            flip_x = (Get-FirstCapture $document.body '(?m)^  m_FlipX: (\d+)$' "0") -eq "1"
            flip_y = (Get-FirstCapture $document.body '(?m)^  m_FlipY: (\d+)$' "0") -eq "1"
            sorting_layer_index = [int](Get-FirstCapture $document.body '(?m)^  m_SortingLayer: (-?\d+)$' "0")
            sorting_layer_id = [int64]$sortingLayerId
            sorting_layer_name = $sortingLayerName
            sorting_order = [int](Get-FirstCapture $document.body '(?m)^  m_SortingOrder: (-?\d+)$' "0")
            sprite_sort_point = [int](Get-FirstCapture $document.body '(?m)^  m_SpriteSortPoint: (\d+)$' "0")
            sprite = $spriteRecord
        }
    }
    $colliders = @()
    foreach ($document in $documents) {
        if ($document.class_id -notin @(60, 61, 68)) {
            continue
        }
        $objectId = Get-FirstCapture $document.body '(?m)^  m_GameObject: \{fileID: (-?\d+)\}' "0"
        $points = @()
        $paths = @()
        $pointsSection = [regex]::Match($document.body, '(?ms)^  m_Points:\r?\n(?<section>.*?)(?=^\S|^  [a-zA-Z_]|\z)')
        if ($pointsSection.Success) {
            foreach ($pointMatch in [regex]::Matches($pointsSection.Groups["section"].Value, '\{x: (?<x>[^,]+), y: (?<y>[^}]+)\}')) {
                $points += [pscustomobject][ordered]@{
                    x = Convert-InvariantDouble $pointMatch.Groups["x"].Value
                    y = Convert-InvariantDouble $pointMatch.Groups["y"].Value
                }
            }
            if ($document.class_id -eq 60) {
                $currentPath = $null
                foreach ($line in ($pointsSection.Groups["section"].Value -split "`r?`n")) {
                    $pathStart = [regex]::Match($line, '^    - - \{x: (?<x>[^,]+), y: (?<y>[^}]+)\}')
                    $pathPoint = [regex]::Match($line, '^      - \{x: (?<x>[^,]+), y: (?<y>[^}]+)\}')
                    if ($pathStart.Success) {
                        if ($null -ne $currentPath) {
                            $paths += ,$currentPath
                        }
                        $currentPath = @([pscustomobject][ordered]@{
                            x = Convert-InvariantDouble $pathStart.Groups["x"].Value
                            y = Convert-InvariantDouble $pathStart.Groups["y"].Value
                        })
                    }
                    elseif ($pathPoint.Success -and $null -ne $currentPath) {
                        $currentPath += [pscustomobject][ordered]@{
                            x = Convert-InvariantDouble $pathPoint.Groups["x"].Value
                            y = Convert-InvariantDouble $pathPoint.Groups["y"].Value
                        }
                    }
                }
                if ($null -ne $currentPath) {
                    $paths += ,$currentPath
                }
            }
        }
        $kind = switch ($document.class_id) { 60 { "polygon" } 61 { "box" } 68 { "edge" } }
        $colliders += [pscustomobject][ordered]@{
            file_id = $document.file_id
            game_object_file_id = $objectId
            game_object_name = if ($objects.ContainsKey($objectId)) { $objects[$objectId].name } else { "" }
            kind = $kind
            enabled = (Get-FirstCapture $document.body '(?m)^  m_Enabled: (\d+)$' "1") -eq "1"
            is_trigger = (Get-FirstCapture $document.body '(?m)^  m_IsTrigger: (\d+)$' "0") -eq "1"
            offset = Read-Vector2 $document.body "m_Offset"
            size = Read-Vector2 $document.body "m_Size"
            edge_radius = Convert-InvariantDouble (Get-FirstCapture $document.body '(?m)^  m_EdgeRadius: ([^\r\n]+)$' "0")
            points = $points
            paths = $paths
        }
    }
    $model = [pscustomobject][ordered]@{
        guid = $Guid
        pathname = $entry.pathname
        root_transform_file_id = $rootTransformId
        game_objects = @($objects.Values | Sort-Object file_id)
        transforms = $modelTransforms
        sprite_renderers = $spriteRenderers
        colliders = $colliders
    }
    $prefabModels[$Guid] = $model
    return $model
}

$prefabInstances = @()
foreach ($document in $sceneDocuments) {
    if ($document.class_id -ne 1001) {
        continue
    }
    $sourceMatch = [regex]::Match($document.body, '(?m)^  m_SourcePrefab: \{fileID: \d+, guid: (?<guid>[0-9a-f]+), type: \d+\}')
    if (-not $sourceMatch.Success) {
        continue
    }
    $guid = $sourceMatch.Groups["guid"].Value
    $model = Get-PrefabModel $guid
    $parentTransformId = Get-FirstCapture $document.body '(?m)^    m_TransformParent: \{fileID: (-?\d+)\}' "0"
    $parentName = ""
    if ($transforms.ContainsKey($parentTransformId)) {
        $parentObjectId = $transforms[$parentTransformId].game_object_file_id
        if ($gameObjects.ContainsKey($parentObjectId)) {
            $parentName = $gameObjects[$parentObjectId].name
        }
    }
    $overrides = @()
    $modificationPattern = '(?ms)^    - target: \{fileID: (?<target>-?\d+), guid: (?<guid>[0-9a-f]+),\s*type: \d+\}\r?\n      propertyPath: (?<property>[^\r\n]*)\r?\n      value: (?<value>[^\r\n]*)\r?\n      objectReference: \{fileID: (?<object>-?\d+)(?:, guid: (?<object_guid>[0-9a-f]+),\s*type: \d+)?\}'
    foreach ($match in [regex]::Matches($document.body, $modificationPattern)) {
        $overrides += [pscustomobject][ordered]@{
            target_file_id = $match.Groups["target"].Value
            target_guid = $match.Groups["guid"].Value
            property_path = $match.Groups["property"].Value
            value = $match.Groups["value"].Value
            object_reference_file_id = $match.Groups["object"].Value
            object_reference_guid = $match.Groups["object_guid"].Value
        }
    }
    $rootPosition = [pscustomobject][ordered]@{ x = 0.0; y = 0.0; z = 0.0 }
    $rootRotation = [pscustomobject][ordered]@{ x = 0.0; y = 0.0; z = 0.0; w = 1.0 }
    $rootScale = [pscustomobject][ordered]@{ x = 1.0; y = 1.0; z = 1.0 }
    $rootOrder = 0
    if ($null -ne $model) {
        $rootTransform = $model.transforms | Where-Object { $_.file_id -eq $model.root_transform_file_id } | Select-Object -First 1
        if ($null -ne $rootTransform) {
            $rootPosition = [pscustomobject][ordered]@{ x = $rootTransform.local_position.x; y = $rootTransform.local_position.y; z = $rootTransform.local_position.z }
            $rootRotation = [pscustomobject][ordered]@{ x = $rootTransform.local_rotation.x; y = $rootTransform.local_rotation.y; z = $rootTransform.local_rotation.z; w = $rootTransform.local_rotation.w }
            $rootScale = [pscustomobject][ordered]@{ x = $rootTransform.local_scale.x; y = $rootTransform.local_scale.y; z = $rootTransform.local_scale.z }
            $rootOrder = $rootTransform.root_order
        }
        foreach ($override in $overrides | Where-Object { $_.target_guid -eq $guid -and $_.target_file_id -eq $model.root_transform_file_id }) {
            switch ($override.property_path) {
                "m_LocalPosition.x" { $rootPosition.x = Convert-InvariantDouble $override.value }
                "m_LocalPosition.y" { $rootPosition.y = Convert-InvariantDouble $override.value }
                "m_LocalPosition.z" { $rootPosition.z = Convert-InvariantDouble $override.value }
                "m_LocalRotation.x" { $rootRotation.x = Convert-InvariantDouble $override.value }
                "m_LocalRotation.y" { $rootRotation.y = Convert-InvariantDouble $override.value }
                "m_LocalRotation.z" { $rootRotation.z = Convert-InvariantDouble $override.value }
                "m_LocalRotation.w" { $rootRotation.w = Convert-InvariantDouble $override.value }
                "m_LocalScale.x" { $rootScale.x = Convert-InvariantDouble $override.value }
                "m_LocalScale.y" { $rootScale.y = Convert-InvariantDouble $override.value }
                "m_LocalScale.z" { $rootScale.z = Convert-InvariantDouble $override.value }
                "m_RootOrder" { $rootOrder = [int]$override.value }
            }
        }
    }
    $prefabInstances += [pscustomobject][ordered]@{
        prefab_instance_file_id = $document.file_id
        prefab_guid = $guid
        prefab_pathname = if ($null -ne $model) { $model.pathname } elseif ($packageIndex.ContainsKey($guid)) { $packageIndex[$guid].pathname } else { "" }
        parent_transform_file_id = $parentTransformId
        parent_name = $parentName
        root_transform_file_id = if ($null -ne $model) { $model.root_transform_file_id } else { "" }
        root_order = $rootOrder
        unity_position = $rootPosition
        godot_position_px = [pscustomobject][ordered]@{ x = $rootPosition.x * 32.0; y = -$rootPosition.y * 32.0; z = $rootPosition.z * 32.0 }
        local_rotation = $rootRotation
        local_scale = $rootScale
        overrides = $overrides
    }
}

$tileBounds = $null
if ($allTileCells.Count -gt 0) {
    $left = ($allTileCells | ForEach-Object { $_.godot_cell_top_left.x * 32 } | Measure-Object -Minimum).Minimum
    $top = ($allTileCells | ForEach-Object { $_.godot_cell_top_left.y * 32 } | Measure-Object -Minimum).Minimum
    $right = ($allTileCells | ForEach-Object { ($_.godot_cell_top_left.x + 1) * 32 } | Measure-Object -Maximum).Maximum
    $bottom = ($allTileCells | ForEach-Object { ($_.godot_cell_top_left.y + 1) * 32 } | Measure-Object -Maximum).Maximum
    $tileBounds = [pscustomobject][ordered]@{
        left = $left
        top = $top
        right = $right
        bottom = $bottom
        width = $right - $left
        height = $bottom - $top
    }
}

$export = [pscustomobject][ordered]@{
    format = "cainos-unity-demo-export-v1"
    source = [pscustomobject][ordered]@{
        package_root = $packagePath
        scene_guid = $SceneGuid
        scene_pathname = $sceneEntry.pathname
        unity_to_godot = "1 Unity unit = 32 px; x_godot = x_unity * 32; y_godot = -y_unity * 32"
    }
    counts = [pscustomobject][ordered]@{
        scene_documents = $sceneDocuments.Count
        tilemaps = $tilemaps.Count
        tile_cells = $allTileCells.Count
        prefab_instances = $prefabInstances.Count
        prefab_models = $prefabModels.Count
        textures = $textures.Count
        tile_assets = $tileAssets.Count
    }
    tile_draw_bounds_godot_px = $tileBounds
    sorting_layers_by_signed_id = $sortingLayersById
    scene_game_objects = @($gameObjects.Values | Sort-Object file_id)
    scene_transforms = @($transforms.Values | Sort-Object file_id)
    tilemaps = $tilemaps
    prefab_instances = $prefabInstances
    prefab_models = @($prefabModels.Values | Sort-Object pathname)
}

$resolvedOutput = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
$outputDirectory = Split-Path -Parent $resolvedOutput
if (-not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}
$json = $export | ConvertTo-Json -Depth 100
[IO.File]::WriteAllText($resolvedOutput, $json, [Text.UTF8Encoding]::new($false))

Write-Host "Exported $($allTileCells.Count) tile cells and $($prefabInstances.Count) prefab instances."
Write-Host "Output: $resolvedOutput"
