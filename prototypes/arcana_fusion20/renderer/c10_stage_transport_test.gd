## Decompose the exact original Thunderloom source stage operations without
## replacing source geometry. This is a field test, not a visual approval.
extends SceneTree
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var fx := CThunderloom.new()
    fx.setup()
    var original := CFrame.new()
    var world := CFrame.new()
    world.track_world_fragments = true
    var targets := [260, 264, 275, 285, 288, 290, 294, 300, 310, 330]
    for tick in range(1, 331):
        var t := float(tick) / 60.0
        fx.update(1.0 / 60.0, t)
        if tick not in targets: continue
        original.clear()
        world.clear()
        fx.render(original, t)
        fx.render(world, t)
        if original.ink != world.ink or original.light != world.light or original.ground != world.ground:
            push_error("Thunderloom non-stage source fields changed at tick %d" % tick)
            quit(1)
            return
        var maxerr := 0.0
        for y in range(CFrame.H):
            for x in range(CFrame.W):
                var i := (y * CFrame.W + x) * 4
                var reconstructed_x := world.disp[i] + world.stage_scanlines[y * 2]
                var reconstructed_s := world.disp[i + 2] * world.stage_shade
                var reconstructed_c := world.disp[i + 3] + world.stage_scanlines[y * 2 + 1]
                maxerr = maxf(maxerr, absf(original.disp[i] - reconstructed_x))
                maxerr = maxf(maxerr, absf(original.disp[i + 1] - world.disp[i + 1]))
                maxerr = maxf(maxerr, absf(original.disp[i + 2] - reconstructed_s))
                maxerr = maxf(maxerr, absf(original.disp[i + 3] - reconstructed_c))
        if maxerr > 0.000002:
            push_error("Thunderloom stage transport reconstruction failed tick %d max %g" % [tick, maxerr])
            quit(1)
            return
        if tick >= 264 and tick <= 294:
            for corner in [0, CFrame.W - 1, CFrame.N - CFrame.W, CFrame.N - 1]:
                if world.world_influence[corner] != 0:
                    push_error("Whole source border incorrectly transported as local geometry at tick %d" % tick)
                    quit(1)
                    return
        print("C10_STAGE_TRANSPORT ", JSON.stringify({"tick":tick,"shade":world.stage_shade,"local_pixels":world.world_influence.count(1),"max_reconstruction_error":maxerr}))
    print("C10_STAGE_TRANSPORT_PASS source buffers preserved; separate explicit viewport-stage contract")
    quit()
