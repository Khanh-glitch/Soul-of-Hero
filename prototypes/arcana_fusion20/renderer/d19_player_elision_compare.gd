## Actual D player fixed-step batching: compare source fields, post metadata,
## RNG and synchronous event/contact snapshots against eager rendering.
extends SceneTree
class Ledger extends RefCounted:
    var events: Array = []
    var contacts: Array = []
    func on_event(kind: StringName, pos: Vector2, time: float, player: DSourcePlayer) -> void:
        var fx := player._eng.fx
        events.append({"kind":kind,"pos":pos,"time":time,"rgb":fx.buf.duplicate(),"influence":fx.world_influence.duplicate(),"warp":fx.world_warp.duplicate()})
    func on_contact(kind: StringName, pos: Vector2, time: float) -> void:
        contacts.append([kind,pos,time])
    func cancel_on_event(_kind: StringName, _pos: Vector2, _time: float, player: DSourcePlayer) -> void:
        player.stop()
func _initialize() -> void:
    call_deferred("_run")
func _run() -> void:
    var eager := DSourcePlayer.new()
    var skipped := DSourcePlayer.new()
    var a := Ledger.new()
    var b := Ledger.new()
    for p in [eager, skipped]:
        p.world_pass_mode = true
        p.render_enabled = false
        root.add_child(p)
        p.set_process(false)
        p.begin(Vector2(100,140),Vector2(220,150))
    eager.elide_intermediate_raster = false
    skipped.elide_intermediate_raster = true
    eager.visual_event.connect(a.on_event.bind(eager))
    skipped.visual_event.connect(b.on_event.bind(skipped))
    eager.visual_contact.connect(a.on_contact)
    skipped.visual_contact.connect(b.on_contact)
    var counts := [1,2,3,8,4,7,8,1,6]
    var iteration := 0
    while eager._active and iteration < 1000:
        var dt := float(counts[iteration % counts.size()]) * DSourcePlayer.STEP
        eager.advance(dt)
        skipped.advance(dt)
        var x := eager._eng.fx
        var y := skipped._eng.fx
        var f := eager.source_pass_frame()
        var expected_out := 1.0 - clampf((eager.source_time()-DConstellationEngine.OUT_START)/(DConstellationEngine.DURATION-DConstellationEngine.OUT_START),0.0,1.0)
        if absf(f.d_warp_fade-expected_out) > 0.0000001 or f.d_warp_fade != skipped.source_pass_frame().d_warp_fade:
            push_error("D19 authored world warp fade mismatch at tick %d" % eager._tick)
            quit(1)
            return
        if eager._tick != skipped._tick or eager._acc != skipped._acc or eager._active != skipped._active or eager._events != skipped._events or eager._eng._nodes != skipped._eng._nodes or eager._eng._edges != skipped._eng._edges or eager._eng._pulses != skipped._eng._pulses or x._pool != y._pool or x.rng.s != y.rng.s or x.buf != y.buf or x.world_influence != y.world_influence or x.world_warp != y.world_warp or x.world_warp_influence != y.world_warp_influence or x.world_bends != y.world_bends or x.flash_amt != y.flash_amt or x.flash_col != y.flash_col or x.shake != y.shake or x.bloom_gain != y.bloom_gain or x.warp_amt != y.warp_amt or x.decal_fade != y.decal_fade or a.events != b.events or a.contacts != b.contacts:
            push_error("D19 player elision mismatch at tick %d" % eager._tick)
            quit(1)
            return
        iteration += 1
    if eager._active or a.events.size() != 8 or a.contacts.size() != 1:
        push_error("D19 player elision did not reach natural completion or lost authored signals")
        quit(1)
        return
    var cancelled := DSourcePlayer.new()
    cancelled.world_pass_mode = true
    cancelled.render_enabled = false
    root.add_child(cancelled)
    cancelled.set_process(false)
    cancelled.begin(Vector2(100,140),Vector2(220,150))
    var cancel_ledger := Ledger.new()
    cancelled.visual_event.connect(cancel_ledger.cancel_on_event.bind(cancelled))
    while cancelled._active and cancelled._tick < 100:
        cancelled.advance(8.0 * DSourcePlayer.STEP)
    if cancelled._active or cancelled._tick != 72:
        push_error("D19 callback cancellation processed later fixed steps")
        quit(1)
        return
    cancelled.visual_event.disconnect(cancel_ledger.cancel_on_event.bind(cancelled))
    cancelled.begin(Vector2(100,140),Vector2(220,150))
    cancelled.advance(DSourcePlayer.STEP)
    if not cancelled._active or cancelled._tick != 1:
        push_error("D19 restart after callback cancellation failed")
        quit(1)
        return
    cancelled.stop()
    cancelled.queue_free()
    print("D19_PLAYER_ELISION_RESULT ",JSON.stringify({"ticks":eager._tick,"calls":iteration,"events":a.events.size(),"contacts":a.contacts.size(),"callback_cancel_tick":72,"restart_tick":1,"exact":true,"scope":"batched actual DSourcePlayer, exact D fields and synchronous callback snapshots on neutral source; not visual world approval"}))
    eager.queue_free()
    skipped.queue_free()
    await process_frame
    print("D19_PLAYER_ELISION_COMPLETE")
    quit()
