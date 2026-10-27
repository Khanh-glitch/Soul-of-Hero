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
var _visible_alpha_count:=0
var _floor_layer: TileMapLayer
var _wall_layer: TileMapLayer

## Bind the ACTUAL authored terrain layers. The original Gold ground stencil
## must never paint on a real map's void or solid walls. This changes only
## the COMPOSITING MASK, never source random draws or crack geometry.
## Without binding, isolated Gold oracle remains an unmasked source fixture.
func bind_actual_map(backdrop: TileMapLayer, geometry: TileMapLayer) -> void:
    _floor_layer=backdrop
    _wall_layer=geometry
    if _ink!=null:
        _refresh_decal()

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
        _refresh_decal()

func _refresh_decal() -> void:
    # The source ink buffer remains untouched for RNG/geometry parity.
    # Mask the DISPLAY alpha only against actual authored walkable floor.
    var image: Image=_ink.as_image()
    _last_alpha_count=_ink.marked_count()
    _visible_alpha_count=_last_alpha_count
    if _floor_layer!=null and _wall_layer!=null:
        var data: PackedByteArray=image.get_data()
        _visible_alpha_count=0
        for p in range(3,data.size(),4):
            if data[p]==0:
                continue
            var index: int=(p-3)/4
            var x: int=index%_ink.W
            var y: int=index/_ink.W
            var pos: Vector2=to_global(Vector2(x+0.5,y+0.5))
            var floor_cell: Vector2i=_floor_layer.local_to_map(_floor_layer.to_local(pos))
            var wall_cell: Vector2i=_wall_layer.local_to_map(_wall_layer.to_local(pos))
            if _floor_layer.get_cell_source_id(floor_cell)<0 or _wall_layer.get_cell_source_id(wall_cell)>=0:
                data[p]=0
            else:
                _visible_alpha_count+=1
        image=Image.create_from_data(_ink.W,_ink.H,false,Image.FORMAT_RGBA8,data)
    _texture.update(image)
    _texture_uploads+=1

func source_diagnostics() -> Dictionary:
    return {
        "source_mutations":_cursor,
        "source_total_mutations":_events.size(),
        "texture_uploads":_texture_uploads,
        "marked_pixels":_last_alpha_count,
        "visible_floor_pixels":_visible_alpha_count,
        "floor_mask_bound":_floor_layer!=null and _wall_layer!=null,
        "visible":visible,
        "source_time":_time,
        "terrain_visual_only":true,
        "tilemap_changed":false,
        "persistent_until_cast_reset":true
    }
