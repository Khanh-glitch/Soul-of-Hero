class_name GoldRuptureSequence
extends RefCounted

## The original S01 wave layout and 60Hz release cadence, not 13 copied GIFs.
## Source: src/skills/skills1.ts S01 delayed rupture loop.
## Maintains ONE RNG across waves; reset/seek is deterministic.
## Central wave extra contact/light/ring is explicitly NOT yet ported.
const SOURCE_SCHEDULE = preload("res://prototypes/gold_fidelity/gold_rupture_schedule.gd")
const SOURCE_EMITTER = preload("res://prototypes/gold_fidelity/gold_source_wave_emitter.gd")
const FIXED_DT := 1.0 / 60.0
const EPSILON := 0.000001
var seed: int
var offset: Vector2
var elapsed := 0.0
var cursor := 0
var emitter: GoldSourceWaveEmitter
var schedule: Array[Dictionary] = []
var emitted: Array[Dictionary] = []

func _init(rng_seed: int = 0x20261027, world_offset: Vector2 = Vector2.ZERO) -> void:
    reset(rng_seed,world_offset)

func reset(rng_seed: int, world_offset: Vector2 = Vector2.ZERO) -> void:
    seed = rng_seed
    offset = world_offset
    elapsed = 0.0
    cursor = 0
    emitter = SOURCE_EMITTER.new(seed)
    schedule = SOURCE_SCHEDULE.source_waves(offset)
    emitted.clear()

func advance(dt: float) -> Array[Dictionary]:
    var frame_waves: Array[Dictionary] = []
    elapsed += maxf(0.0,dt)
    while cursor < schedule.size() and float(schedule[cursor]["delay"]) <= elapsed + EPSILON:
        var wave: Dictionary = schedule[cursor]
        var objects: Array[Dictionary] = emitter.spawn_standard_wave(wave["position"],int(wave["side"]))
        var event: Dictionary = {
            "order":cursor,
            "delay":float(wave["delay"]),
            "position":wave["position"],
            "k":int(wave["k"]),
            "side":int(wave["side"]),
            # Critical: emitter reuses .objects and clears it on the next wave.
            # Keep a deep-copy of original live object INITIAL STATES, not pixels.
            "objects":objects.duplicate(true),
            "central_additions_missing":int(wave["k"])==0
        }
        frame_waves.append(event)
        emitted.append(event)
        cursor += 1
    return frame_waves

func advance_ticks(ticks: int) -> Array[Dictionary]:
    var all: Array[Dictionary] = []
    for i in range(maxi(ticks,0)):
        all.append_array(advance(FIXED_DT))
    return all

func seek_fixed(ticks: int) -> Array[Dictionary]:
    reset(seed,offset)
    return advance_ticks(ticks)

func completed() -> bool:
    return cursor == schedule.size()
