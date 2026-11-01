## Check the source's full black ink is represented as a global blackout,
## while the authored light remains independent and original source is intact.
extends SceneTree
func _initialize() -> void: call_deferred("_run")
func _run() -> void:
    var fx := CEventHorizon.new()
    fx.setup()
    for tick in range(1, 361): fx.update(1.0 / 60.0, float(tick) / 60.0)
    var reference := CFrame.new()
    var world := CFrame.new()
    world.track_world_fragments = true
    reference.clear()
    world.clear()
    fx.render(reference, 6.0)
    fx.render(world, 6.0)
    if not world.stage_blackout or reference.stage_blackout or reference.light != world.light:
        push_error("C17 blackout stage signal or source light mismatch")
        quit(1)
        return
    for p in range(CFrame.N):
        var i := p * 4
        if reference.ink[i] != 0.0 or reference.ink[i + 1] != 0.0 or reference.ink[i + 2] != 0.0 or reference.ink[i + 3] != 1.0 or world.ink[i + 3] != 0.0:
            push_error("C17 stage ink reconstruction mismatch at pixel %d" % p)
            quit(1)
            return
    if world.world_influence.count(1) != 1:
        push_error("C17 full stage blackout was marked as transformed local ink")
        quit(1)
        return
    world.clear()
    if world.stage_blackout:
        push_error("C17 stage blackout not cleared between frames")
        quit(1)
        return
    print("C17_STAGE_BLACKOUT_PASS original full-stage black and later authored light separated; not visual approval")
    quit()
