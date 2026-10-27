class_name GoldS01TerrainInk
extends Sprite2D

## Persistent ENVIRONMENT FX from the ORIGINAL user Gold S01:
## 2 source Bezier grooves (0.85s, 2.50s); 13 source-randomized cracks
## and 13 rubble stamps, ending at Gold world t=2.8s. Inherit the
## EXACT source ground pixel-write callgraph / RNG, not an approximate
## decal texture or a precaptured frame.
##
## The source 480x270 RGBA8 ink is uploaded ONLY when an authored
## environmental mutation occurs. Every other game frame is static:
## 0 mesh rebuilds, 0 per-frame texture uploads for settled terrain.
## The overlay is solely visual. It does not modify level TileMap/physics.
const INK = preload("res://prototypes/gold_fidelity/gold_s01_transparent_ground.gd")
const GOLD_COMPONENTS = preload("res://prototypes/gold_fidelity/hairline_source_components_lab.gd")
var _ink: GoldS01TransparentGround
var _texture: ImageTexture
var _events: Array[Dictionary]=[]
var _cursor:=0
var _time:=0.0
var _texture_uploads:=0
var _last_alpha_count:=0

func _ready() -> void:
    centered=false
    z_index=1
    texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
    _ink=INK.new()
    _ink.clear_ink()
    _texture=ImageTexture.create_from_image(_ink.as_image())
    texture=_texture
    _events.append({"t":0.85,"kind":"groove_a"})
    _events.append({"t":2.5,"kind":"groove_b"})
    for c in GOLD_COMPONENTS.CRACKS:
        _events.append({"t":float(c[2]),"kind":"crack",
            "x":float(c[0]),"angle":float(c[1])})
        _events.append({"t":float(c[2]),"kind":"rubble","x":int(c[0])})
    seek_source_time(0.0)

func seek_source_time(t: float) -> void:
    if _ink == null:
        return
    var target:=clampf(t,0.0,7.0)
    var changed:=false
    if target<_time:
        _ink.clear_ink()
        _cursor=0
        changed=true
    _time=target
    while _cursor<_events.size() and float(_events[_cursor]["t"])<=_time+0.000001:
        var e: Dictionary=_events[_cursor]
        match String(e["kind"]):
            "groove_a":
                _ink.source_first_groove()
            "groove_b":
                _ink.source_second_groove()
            "crack":
                _ink.crack(float(e["x"]),150.0,float(e["angle"]),16.0,1)
            "rubble":
                _ink.rubble(int(e["x"]),151,7)
        _cursor+=1
        changed=true
    if changed:
        _texture.update(_ink.as_image())
        _texture_uploads+=1
        _last_alpha_count=_ink.marked_count()

func source_diagnostics() -> Dictionary:
    return {
        "source_mutations":_cursor,
        "source_total_mutations":_events.size(),
        "texture_uploads":_texture_uploads,
        "marked_pixels":_last_alpha_count,
        "visible":visible,
        "source_time":_time,
        "terrain_visual_only":true,
        "tilemap_changed":false,
        "persistent_until_cast_reset":true
    }
