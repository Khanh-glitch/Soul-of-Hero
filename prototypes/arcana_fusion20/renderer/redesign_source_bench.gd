## Phase-matched diagnostic for changed #14/#18 source rendering only.
## CPU headless; no animation history, world composition, uploads, GPU, FPS,
## or target-device claim. Same code is copied into both pinned checkouts.
extends SceneTree

func _initialize() -> void:
    for item in [
        {"id": 14, "spell": ARedesignSpells2.SporeNebulaR.new(), "times": [3.6, 5.4, 5.7]},
        {"id": 18, "spell": ARedesignSpells2.ChronoshardR.new(), "times": [3.2, 6.4, 7.0]},
    ]:
        var spell: Variant = item.spell
        spell.setup()
        for time in item.times:
            var t: float = time
            var elapsed: Array[float] = []
            var frame: AFramebuffer
            for rep in range(11):
                var started := Time.get_ticks_usec()
                frame = AFramebuffer.new()
                frame.track_world_fields = true
                spell.render(frame, t)
                var ms := float(Time.get_ticks_usec() - started) / 1000.0
                if rep > 0: elapsed.append(ms)
            # Hash every authored source field after the timed render. The
            # benchmark intentionally has no update history; this equality is
            # per selected static time, not complete lifecycle parity.
            var h := HashingContext.new()
            h.start(HashingContext.HASH_SHA256)
            h.update(frame.buf.to_byte_array())
            h.update(frame.world_coverage.to_byte_array())
            h.update(frame.world_multiplier.to_byte_array())
            h.update(frame.world_warp.to_byte_array())
            h.update(frame.world_influence)
            print("REDESIGN_FIELDS id=%d t=%.1f sha256=%s" % [int(item.id), t, h.finish().hex_encode()])
            elapsed.sort()
            print("REDESIGN_BENCH id=%d t=%.1f samples=%d p50_ms=%.3f p95_ms=%.3f" % [int(item.id), t, elapsed.size(), elapsed[elapsed.size() / 2], elapsed[elapsed.size() - 1]])
    print("REDESIGN_BENCH_PASS isolated CPU only")
    quit(0)
