class_name ArcanaSourceScarCanvas
extends Node2D

## Original 480x270 Gold source space; fixed-clock driven from caller, never
## from variable-rate _process. Two separate original Pixi layers: mark and glow.
## Only native staging: not original Pixi shader/underlying TileMap parity.
const LEDGER=preload("res://prototypes/gold_pair/arcana_source_scar_draw_ledger.gd")
const PASS=preload("res://prototypes/gold_pair/arcana_source_scar_pass.gd")
var ledger:ArcanaSourceScarDrawLedger
var mark_layer:ArcanaSourceScarPass
var glow_layer:ArcanaSourceScarPass
var last_source_age:float=0.0
var last_ink:int=0
var last_glow:int=0

func _ready()->void:
    _ensure_layers()
    set_process(false)

func _ensure_layers()->void:
    if mark_layer!=null and glow_layer!=null:return
    mark_layer=PASS.new()
    mark_layer.name="GoldScarGround"
    mark_layer.z_index=0
    mark_layer.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(mark_layer)
    glow_layer=PASS.new()
    glow_layer.name="GoldScarGlow"
    glow_layer.z_index=1
    glow_layer.texture_filter=CanvasItem.TEXTURE_FILTER_NEAREST
    add_child(glow_layer)

func begin_source_scar(seed:int,x:float,y:float,n:int,length:float,life:float,
        color:int,ys:float=0.7)->void:
    _ensure_layers()
    ledger=LEDGER.new()
    ledger.configure(seed,x,y,n,length,life,color,ys)

func set_source_to_map_transform(xform:Transform2D)->void:
    _ensure_layers()
    transform=xform

func render_source_frame(source_age:float,source_alpha:float=1.0)->void:
    _ensure_layers()
    if ledger==null:
        push_error("ARCANA ScarCanvas requires begin_source_scar")
        return
    last_source_age=source_age
    var ink:PackedStringArray=PackedStringArray()
    var glow:PackedStringArray=PackedStringArray()
    if source_age>=0.0 and source_age<ledger.scar.duration:
        for line in ledger.draw_trace(source_age,source_alpha):
            if line.begins_with("mark|"):ink.append(line)
            elif line.begins_with("glow|"):glow.append(line)
    last_ink=ink.size()
    last_glow=glow.size()
    mark_layer.set_source_commands(ink)
    glow_layer.set_source_commands(glow)

func release_source_scar()->void:
    ledger=null
    last_ink=0;last_glow=0
    mark_layer.set_source_commands(PackedStringArray())
    glow_layer.set_source_commands(PackedStringArray())
