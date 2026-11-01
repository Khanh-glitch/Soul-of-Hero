"""Instrument a disposable genuine world capture, never production combat."""
import pathlib,sys
root=pathlib.Path(sys.argv[1])
graph=root/'prototypes/arcana_fusion20/renderer/source_a/a_chain_verdict_graph.gd'
g=graph.read_text();g=g.replace('var c_channel := CChainChannel.new()\n','var c_channel := CChainChannel.new()\nvar _r17_trace: Array = []\n',1)
sig='func _bolt(fb: AFramebuffer, a: Vector2, b: Vector2, t: float, seed: int, width: float, k: float, rough: float, branch_count: int = 5, glow_k: float = -1.0) -> void:\n'
assert g.count(sig)==1
g=g.replace(sig,sig+'''    _r17_trace.append({"a": [a.x, a.y], "b": [b.x, b.y], "t": t, "seed": seed, "width": width, "k": k, "rough": rough, "branch_count": branch_count, "glow_k": glow_k})
''',1)
sig='func render(fb: AFramebuffer, t: float) -> void:\n';assert g.count(sig)==1
g=g.replace(sig,sig+'    _r17_trace.clear()\n',1);graph.write_text(g)
p=root/'prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd'
s=p.read_text();needle='''        "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y]})
    return true
'''
assert s.count(needle)==1
s=s.replace(needle,'''        "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y]})
    # Source frame coordinates only: real moving actors, no fake battlefield.
    var render_host := host.get("renderer") as Arcana20Renderer
    var live_source := render_host._casts.get(cast_id) as ASourcePlayer if render_host != null else null
    if is_instance_valid(live_source) and live_source._spell.has_method("source_raster_uncontained_nodes"):
        var coords: Array = []
        for point in live_source._spell.nodes:
            coords.append([point.x + live_source._raster_offset.x, point.y + live_source._raster_offset.y] if point != null else null)
        samples[-1]["r17_source_tick"] = live_source._tick
        samples[-1]["r17_actor_nodes"] = coords
        samples[-1]["r17_source_size"] = [live_source._fb.width, live_source._fb.height]
        samples[-1]["r17_source_offset"] = [live_source._raster_offset.x, live_source._raster_offset.y]
        samples[-1]["r17_uncontained_nodes"] = live_source._spell.source_raster_uncontained_nodes()
        if OS.get_environment("AVFX_R17_WIDE_FULL") == "1":
            var best: Dictionary = {}
            var best_score := -1.0
            for item in live_source._spell._r17_trace:
                var q: Dictionary = item
                var a := Vector2(q.a[0], q.a[1])
                var b := Vector2(q.b[0], q.b[1])
                var score := a.distance_to(b) * maxf(0.0, float(q.k))
                if score > best_score:
                    best_score = score
                    best = q
            samples[-1]["r17_chosen_bolt"] = best
            var stem := "r17_full_%05d" % (samples.size() - 1)
            var raw := FileAccess.open(path + "/" + stem + ".rgb32f", FileAccess.WRITE)
            raw.store_buffer(live_source._fb.buf.to_byte_array())
            raw.close()
            var coverage := FileAccess.open(path + "/" + stem + ".coverage32f", FileAccess.WRITE)
            coverage.store_buffer(live_source._fb.world_coverage.to_byte_array())
            coverage.close()
            samples[-1]["r17_full_source_field"] = stem + ".rgb32f"
            samples[-1]["r17_full_source_coverage"] = stem + ".coverage32f"
    return true
''',1)
p.write_text(s)
print('A09_WINDOW_CAPTURE_INSTRUMENTED disposable real-route capture')
