extends "res://prototypes/gold_fidelity/hairline_source_components_lab.gd"

## Gate 7 GOLD-derived COMPONENT COMPOSITE:
## Original ground CPU writes, 14 plates, 13 live rupture waves, plus S01 Ribbon
## which uses World.Ribbon original triangles and all-style fragment shaders.
## This remains a 480x270 source-pose fixture, NOT the full production skill.
## Real actor animation, ALL original RNG interleaving, hitstop, contact and
## camera synchronization are not implemented in this scene.
const WAVE_LAYER = preload("res://prototypes/gold_fidelity/gold_s01_live_wave_layer.gd")
const RIBBON = preload("res://prototypes/gold_fidelity/gold_source_ribbon.gd")
const SEAM = preload("res://prototypes/gold_fidelity/gold_s01_seam_timeline.gd")
const RUPTURE_START := 2.5
var _live_waves: GoldS01LiveWaveLayer
var _gold_seam: GoldSourceRibbon
var _seam_seed := 0.9286294893827289
var _seam_random_sign := -1.0

func _ready() -> void:
    super._ready()
    # One 480x270 viewport, original layer 5 for Ribbon, 100 for post shader.
    var source_stage: Node = _viewport.get_child(0)
    _live_waves = WAVE_LAYER.new()
    _live_waves.name = "LiveSourceRuptureWaves"
    source_stage.add_child(_live_waves)
    _live_waves.bind_post(_post_material)
    _gold_seam = RIBBON.new()
    _gold_seam.name = "OriginalSourceRibbon"
    source_stage.add_child(_gold_seam)
    _gold_seam.configure({"w":1.5,"style":4,"wprof":2,"seed":_seam_seed,
        "extra":1.0,"wobF":50.0,"life":3.6,"layer":5})
    set_gold_time(_time)

## Source cast must supply the actual WebGL RNG seed and per-tick random sign.
## The initial values are ONLY the seed/flicker fixture used for reference CI;
## callers cannot treat them as production RNG parity across a whole skill.
func set_gold_ribbon_rng(seed_value: float, sign_value: float) -> void:
    _seam_seed = seed_value
    _seam_random_sign = signf(sign_value)
    if _gold_seam != null:
        _gold_seam.source_seed = _seam_seed
        set_gold_time(_time)

func set_gold_time(t: float) -> void:
    super.set_gold_time(t)
    if _live_waves != null:
        _live_waves.seek_seconds(maxf(0.0,_time-RUPTURE_START))
    if _gold_seam != null:
        var s: Dictionary = SEAM.state_at(_time,_seam_random_sign)
        _gold_seam.source_width = float(s["source_width"])
        _gold_seam.source_wobble = float(s["source_wobble"])
        _gold_seam.source_life = float(s["source_life"])
        _gold_seam.source_fade_mode = int(s["source_fade_mode"])
        _gold_seam.set_source_frame(float(s["source_age"]),
            s["source_points"],bool(s["source_live"]),
            float(s["source_end_age"]),float(s["world_time"]))

func wave_diagnostics() -> Dictionary:
    return _live_waves.diagnostics() if _live_waves != null else {}

func ribbon_diagnostics() -> Dictionary:
    if _gold_seam == null:
        return {}
    var d: Dictionary = _gold_seam.source_summary()
    d["visible"] = _gold_seam.visible
    d["source_rng_fixture_only"] = true
    return d
