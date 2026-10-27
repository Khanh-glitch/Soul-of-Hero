class_name GoldS01LiveWaveLayer
extends Node2D

## ORIGINAL S01 component integration. Not a complete gold skill.
## Runs SourceWaveEmitter + Blob/Part/Chunk + RingFx on one fixed 60 Hz clock.
## All active FX nodes are genuine source-driven objects, never flattened frames.
## Center contact/light and prior full-skill RNG remain intentionally unported.
const SEQUENCE = preload("res://prototypes/gold_fidelity/gold_rupture_sequence.gd")
const BLOB = preload("res://prototypes/gold_fidelity/gold_blob_primitive.gd")
const GLYPH = preload("res://prototypes/gold_fidelity/gold_rupture_glyph.gd")
const CENTER = preload("res://prototypes/gold_fidelity/gold_s01_center_events.gd")
const DT := 1.0 / 60.0
const SOURCE_SEED := 0x20261027
const MAX_RINGS := 12

var _sequence: GoldRuptureSequence
var _ticks := 0
var _render_nodes: Array[Node2D] = []
var _rings: Array[Dictionary] = []
var _lights: Array[Dictionary] = []
var _contact_cues: Array[Dictionary] = []
var _central_large_ring_count := 0
var _post: ShaderMaterial
var _total_sources := 0
var _total_waves := 0
var _total_visuals := 0

func _ready() -> void:
    reset()

func bind_post(mat: ShaderMaterial) -> void:
    _post = mat
    _publish_post()

func reset() -> void:
    for item: Node2D in _render_nodes:
        if is_instance_valid(item):
            item.visible = false
            item.queue_free()
    _render_nodes.clear()
    _rings.clear()
    _lights.clear()
    _contact_cues.clear()
    _central_large_ring_count = 0
    _sequence = SEQUENCE.new(SOURCE_SEED)
    _ticks = 0
    _total_sources = 0
    _total_visuals = 0
    _total_waves = 0
    _publish_post()

func seek_seconds(seconds_since_rupture: float) -> void:
    var target_tick := maxi(0, int(floor(seconds_since_rupture * 60.0 + 0.000001)))
    if target_tick < _ticks:
        reset()
    while _ticks < target_tick:
        _step_one()
    _publish_post()

func _step_one() -> void:
    # Existing fx advances first; newly emitted fx begins at source age zero.
    for fx: Node2D in _render_nodes:
        if not is_instance_valid(fx) or bool(fx.get("dead")):
            continue
        if fx is GoldBlobPrimitive:
            fx.call("step_gold",DT,2.5+float(_ticks+1)*DT)
        else:
            fx.call("step_gold",DT)
    for ring: Dictionary in _rings:
        ring["t"] = float(ring["t"]) + DT
    _rings = _rings.filter(func(r: Dictionary) -> bool:
        return float(r["t"]) < float(r["life"]))
    for light: Dictionary in _lights:
        light["t"] = float(light["t"]) + DT
    _lights = _lights.filter(func(l: Dictionary) -> bool:
        return float(l["t"]) < float(l["life"]))
    var newly: Array[Dictionary] = _sequence.advance(DT)
    for wave: Dictionary in newly:
        _total_waves += 1
        var sources: Array = wave["objects"]
        _total_sources += sources.size()
        for info: Dictionary in sources:
            var kind: String = String(info["kind"])
            var attrs: Dictionary = info["source"]
            if kind == "ring":
                var ring_payload := attrs.duplicate(true)
                ring_payload["t"] = 0.0
                _rings.append(ring_payload)
                continue
            var obj: Node2D = BLOB.new() if kind == "blob" else GLYPH.new()
            add_child(obj)
            if kind == "blob":
                obj.call("configure",attrs)
            else:
                obj.call("configure",kind,attrs)
            _render_nodes.append(obj)
            _total_visuals += 1
        # Deterministic center additions: same ring/light values as original
        # fxlib. Randomized contact/ground-ring Blob remain deliberately gated.
        var extras: Dictionary = CENTER.for_wave(wave)
        for ring_extra: Dictionary in extras["rings"]:
            _rings.append(ring_extra.duplicate(true))
            _central_large_ring_count += 1
        for light_extra: Dictionary in extras["lights"]:
            _lights.append(light_extra.duplicate(true))
        for cue: Dictionary in extras["contact_cues"]:
            _contact_cues.append(cue.duplicate(true))
    _ticks += 1

func _publish_post() -> void:
    if _post == null:
        return
    var ring_data := PackedVector4Array()
    var ring_power := PackedFloat32Array()
    var live_count := mini(MAX_RINGS,_rings.size())
    for i in range(MAX_RINGS):
        if i < live_count:
            var r: Dictionary = _rings[i]
            var progress := clampf(float(r["t"]) / float(r["life"]),0.0,1.0)
            var rad := lerpf(float(r["r0"]),float(r["r1"]),1.0-pow(1.0-progress,3.0))
            ring_data.append(Vector4(float(r["x"]),float(r["y"]),rad,float(r["wd"])))
            ring_power.append(float(r["s"])*(1.0-progress))
        else:
            ring_data.append(Vector4.ZERO)
            ring_power.append(0.0)
    _post.set_shader_parameter(&"u_ring",ring_data)
    _post.set_shader_parameter(&"u_ring_s",ring_power)
    _post.set_shader_parameter(&"u_nr",live_count)
    # Gold World.draw sorts active lights descending by CURRENT intensity,
    # then keeps first 12 in its WebGL post shader.
    var selected: Array[Dictionary] = _lights.duplicate(true)
    for lt: Dictionary in selected:
        var ratio: float = clampf(float(lt["t"])/float(lt["life"]),0.0,1.0)
        var hold: float = float(lt.get("hold",0.0))
        var weight: float = (1.0 if ratio<hold else (1.0-ratio)/(1.0-hold)) if hold>0.0 else pow(1.0-ratio,2.0)
        lt["weighted_intensity"] = float(lt["i"])*weight
    selected.sort_custom(func(a: Dictionary,b: Dictionary) -> bool:
        return float(a["weighted_intensity"])>float(b["weighted_intensity"]))
    var light_data := PackedVector4Array()
    var light_colors := PackedVector3Array()
    var lights_used := mini(12,selected.size())
    for i in range(12):
        if i < lights_used:
            var lt: Dictionary = selected[i]
            light_data.append(Vector4(float(lt["x"]),float(lt["y"])-float(lt.get("z",0.0)),float(lt["r"]),float(lt["weighted_intensity"])))
            light_colors.append(lt["c"])
        else:
            light_data.append(Vector4.ZERO)
            light_colors.append(Vector3.ZERO)
    _post.set_shader_parameter(&"u_light",light_data)
    _post.set_shader_parameter(&"u_light_c",light_colors)
    _post.set_shader_parameter(&"u_nl",lights_used)

func diagnostics() -> Dictionary:
    return {
        "wave_count":_total_waves,
        "source_count":_total_sources,
        "visual_count":_total_visuals,
        "ring_count":_rings.size(),
        "center_ring_count":_central_large_ring_count,
        "light_count":_lights.size(),
        "contact_cue_count":_contact_cues.size(),
        "center_ring_light_source_ported":true,
        "center_contact_damage_or_fx_ported":false,
        "ticks":_ticks,
        "center_randomized_contact_and_blob_unported":true,
        "source_full_cast_rng_unported":true
    }
