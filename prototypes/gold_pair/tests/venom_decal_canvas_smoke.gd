extends SceneTree

## Smoke test: source-locked RGBA Decal pixels are actually submitted to a
## native Godot ImageTexture/Sprite2D, with original logical pixel coordinates.
## Does NOT establish GPU frame parity, map alignment, FPS or skill approval.
const CANVAS = preload("res://prototypes/gold_pair/venom_source_decal_canvas.gd")
const PALETTE = {"a":0xFF332211,"b":0xFF665544,"c":0xFF998877}
const EXPECTED_SOURCE_SHA256 = "086169086f0a4f89a53c5d887f52c50747b6614f54f6e28e553bf8e09ef07e9b"

func _initialize() -> void:
    call_deferred("_run")

func _run() -> void:
    var canvas = CANVAS.new()
    root.add_child(canvas)
    if canvas.source_sprite == null:
        _fail(canvas, "missing runtime Sprite2D")
        return
    if canvas.source_sprite.centered or canvas.source_sprite.texture_filter != CanvasItem.TEXTURE_FILTER_NEAREST:
        _fail(canvas, "source pixel placement/filter drift")
        return
    if canvas.source_sprite.texture.get_width() != 600 or canvas.source_sprite.texture.get_height() != 340:
        _fail(canvas, "wrong source raster dimensions")
        return
    if canvas.is_processing():
        _fail(canvas, "must not advance source simulation from render _process")
        return
    canvas.begin_source_decal(305.25,170.5,"veins",34.0,4.2,17,PALETTE,0.37,1.2)
    var bytes: PackedByteArray = canvas.render_source_frame(0.25,0.25)
    var hash := HashingContext.new()
    hash.start(HashingContext.HASH_SHA256)
    hash.update(bytes)
    var digest: String = hash.finish().hex_encode()
    if digest != EXPECTED_SOURCE_SHA256:
        _fail(canvas, "uploaded source pixels differ from original TS Decal.gnd(): "+digest)
        return
    if canvas.is_source_lifetime_over(4.19) or not canvas.is_source_lifetime_over(4.2):
        _fail(canvas, "source lifetime boundary drift")
        return
    if canvas.source_sprite.transform != Transform2D.IDENTITY:
        _fail(canvas, "unexpected implicit source-to-map transform")
        return
    canvas.set_source_to_map_transform(Transform2D(0.0, Vector2(14.0,29.0)))
    if canvas.source_sprite.position != Vector2(14.0,29.0):
        _fail(canvas, "explicit map transform not applied")
        return
    canvas.queue_free()
    print("VENOM_DECAL_CANVAS: PASS / source RGBA -> native ImageTexture / 600x340 / no auto-clock")
    quit(0)

func _fail(canvas: Node, message: String) -> void:
    push_error("VENOM_DECAL_CANVAS: "+message)
    canvas.queue_free()
    quit(1)
