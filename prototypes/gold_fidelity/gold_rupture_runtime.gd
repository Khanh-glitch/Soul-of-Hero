class_name GoldRuptureRuntime
extends Node2D

## Live native renderer of the 13 base Hairline Rupture waves.
## Reuses source-derived GoldRuptureSequence/Blob/Chunk/Part/RingFx.
## Full original skill fidelity NOT established: central additions, earlier
## skill RNG interleaving, contact/light, ribbon, actor and floor remain outside.
const SEQUENCE = preload("res://prototypes/gold_fidelity/gold_rupture_sequence.gd")
const BLOB = preload("res://prototypes/gold_fidelity/gold_blob_primitive.gd")
const GLYPH = preload("res://prototypes/gold_fidelity/gold_rupture_glyph.gd")
const POST = preload("res://prototypes/gold_fidelity/gold_post.gdshader")
const DT := 1.0 / 60.0
var timeline: GoldRuptureSequence
var visual_nodes: Array[Node2D] = []
var rings: Array[Dictionary] = []
var material_post: ShaderMaterial
var total_spawned_visual := 0
var total_spawned_source := 0
var tick_count := 0
var started := false

func start(seed: int = 0x20261027, offset: Vector2 = Vector2.ZERO) -> void:
    if started:
        push_error("GoldRuptureRuntime.start() is single-use. Instantiate a fresh runtime to replay.")
        return
    started = true
    timeline = SEQUENCE.new(seed, offset)
    var overlay := ColorRect.new()
    overlay.name = "GoldSourceRingPost"
    overlay.size = Vector2(480, 270)
    overlay.color = Color.WHITE
    overlay.z_index = 100
    material_post = ShaderMaterial.new()
    material_post.shader = POST
    overlay.material = material_post
    add_child(overlay)
    material_post.set_shader_parameter(&"u_amb",1.0)
    material_post.set_shader_parameter(&"u_nl",0)
    material_post.set_shader_parameter(&"u_ns",0)
    material_post.set_shader_parameter(&"u_haze",0.0)
    _update_post()

func tick_60hz() -> void:
    if not started:
        push_error("Call start() before native tick")
        return
    tick_count += 1
    for node: Node2D in visual_nodes:
        if not is_instance_valid(node) or bool(node.get("dead")):
            continue
        if node is GoldBlobPrimitive:
            node.call("step_gold",DT,2.5 + float(tick_count)*DT)
        else:
            node.call("step_gold",DT)
    for i in range(rings.size()-1, -1, -1):
        rings[i]["age"] = float(rings[i]["age"]) + DT
        if float(rings[i]["age"]) >= float(rings[i]["life"]):
            rings.remove_at(i)
    for wave: Dictionary in timeline.advance(DT):
        _spawn(wave["objects"])
    _update_post()

func _spawn(source_objects: Array) -> void:
    for obj: Dictionary in source_objects:
        var kind := String(obj["kind"])
        var attrs: Dictionary = obj["source"]
        total_spawned_source += 1
        if kind == "ring":
            var ring := attrs.duplicate(true)
            ring["age"] = 0.0
            rings.append(ring)
            continue
        var node: Node2D = BLOB.new() if kind == "blob" else GLYPH.new()
        add_child(node)
        if kind == "blob":
            node.call("configure",attrs)
        else:
            node.call("configure",kind,attrs)
        visual_nodes.append(node)
        total_spawned_visual += 1

func _update_post() -> void:
    if material_post == null:
        return
    var ring_positions := PackedVector4Array()
    var ring_strengths := PackedFloat32Array()
    var count := mini(rings.size(),12)
    if rings.size()>12:
        push_warning("Gold post uses 12 ring slots; full ring visibility requires renderer-specific capacity audit")
    for i in range(12):
        if i<count:
            var ring: Dictionary = rings[i]
            var u := clampf(float(ring["age"])/float(ring["life"]),0.0,1.0)
            var eased := 1.0-pow(1.0-u,3.0)
            ring_positions.append(Vector4(float(ring["x"]),float(ring["y"]),
                lerpf(float(ring["r0"]),float(ring["r1"]),eased),float(ring["wd"])))
            ring_strengths.append(float(ring["s"])*(1.0-u))
        else:
            ring_positions.append(Vector4.ZERO)
            ring_strengths.append(0.0)
    material_post.set_shader_parameter(&"u_time",2.5 + float(tick_count)*DT)
    material_post.set_shader_parameter(&"u_ring",ring_positions)
    material_post.set_shader_parameter(&"u_ring_s",ring_strengths)
    material_post.set_shader_parameter(&"u_nr",count)

func snapshot() -> Dictionary:
    return {"tick":tick_count,"waves":timeline.cursor if timeline != null else 0,
        "spawned_source":total_spawned_source,
        "spawned_visual":total_spawned_visual,
        "active_rings":rings.size()}
