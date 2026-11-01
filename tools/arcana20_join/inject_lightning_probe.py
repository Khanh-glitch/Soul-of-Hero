"""Instrument disposable playtest sources; never rewrite elected source archives.

The renderer's output and timing functions are left unchanged. Record actual
moving actor endpoints, original per-bolt parameters and the exact A source
fields used for a displayed frame. PNG and raw-field I/O perturb performance.
"""
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
a = root / 'prototypes/arcana_fusion20/renderer/source_a'
p = a / 'a_chain_verdict_graph.gd'
s = p.read_text()
s = s.replace('var host: ASourcePlayer\n', 'var host: ASourcePlayer\nvar _r17_trace: Array = []\n', 1)
old_sig = 'func _bolt(fb: AFramebuffer, a: Vector2, b: Vector2, t: float, seed: int, width: float, k: float, rough: float, branch_count: int = 5) -> void:\n'
new_sig = old_sig.replace('branch_count: int = 5)', 'branch_count: int = 5, glow_k: float = -1.0)')
needle = new_sig if new_sig in s else old_sig
assert s.count(needle) == 1
trace = '''    if OS.get_environment("AVFX_R17_TRACE") == "1":
        _r17_trace.append({"a": [a.x, a.y], "b": [b.x, b.y], "t": t, "seed": seed, "width": width, "k": k, "rough": rough, "branch_count": branch_count%s})
''' % (', "glow_k": glow_k' if needle == new_sig else '')
s = s.replace(needle, needle + trace, 1)
needle = 'func render(fb: AFramebuffer, t: float) -> void:\n'
assert s.count(needle) == 1
s = s.replace(needle, needle + '    _r17_trace.clear()\n', 1)
p.write_text(s)

p = a / 'a_volt_carousel_fusion.gd'
s = p.read_text()
s = s.replace('var include_bolts := true\n', 'var include_bolts := true\nvar _r17_trace: Array = []\n', 1)
needle = '    if not include_bolts or k <= 0.01: return\n'
assert s.count(needle) == 1
trace = '''    if OS.get_environment("AVFX_R17_TRACE") == "1":
        _r17_trace.append({"a": [x0, y0], "b": [x1, y1], "t": t, "seed": seed, "width": width, "k": k, "rough": chaos, "branch_count": %s})
''' % ('_c_branch_count(Vector2(x0, y0).distance_to(Vector2(x1, y1)))' if 'static func _c_branch_count(' in s else '1')
s = s.replace(needle, needle + trace, 1)
needle = 'func render(fb: AFramebuffer, t: float) -> void:\n'
assert s.count(needle) == 1
s = s.replace(needle, needle + '    _r17_trace.clear()\n', 1)
p.write_text(s)

p = root / 'prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd'
s = p.read_text()
s = s.replace('var capture_start_usec := 0\n', '''var capture_start_usec := 0
var _r17_targets: Array[int] = [84, 138, 198, 246, 305, 324, 345]
var _r17_next := 0
''', 1)
needle = '    var index := samples.size()\n'
assert s.count(needle) == 1
s = s.replace(needle, '''    if OS.get_environment("AVFX_R17_TRACE") == "1" and _r17_next < _r17_targets.size():
        var renderer := host.get("renderer") as Arcana20Renderer
        var source := renderer._casts.get(cast_id) as ASourcePlayer if renderer != null else null
        if is_instance_valid(source) and source._tick >= _r17_targets[_r17_next]:
            var trace: Array = source._spell.get("_r17_trace")
            var best: Dictionary = {}
            var best_score := -1.0
            for v in trace:
                var bolt: Dictionary = v
                var a := Vector2(float(bolt.a[0]), float(bolt.a[1]))
                var b := Vector2(float(bolt.b[0]), float(bolt.b[1]))
                var score := a.distance_to(b) * maxf(0.0, float(bolt.k))
                if score > best_score:
                    best_score = score
                    best = bolt
            var stamp := "r17_%03d" % source._tick
            var field := FileAccess.open(path + "/" + stamp + ".rgb32f", FileAccess.WRITE)
            field.store_buffer(source._fb.buf.to_byte_array())
            field.close()
            var cover := FileAccess.open(path + "/" + stamp + ".coverage32f", FileAccess.WRITE)
            cover.store_buffer(source._fb.world_coverage.to_byte_array())
            cover.close()
            var influence := FileAccess.open(path + "/" + stamp + ".influence8", FileAccess.WRITE)
            influence.store_buffer(source._fb.world_influence)
            influence.close()
            var actors: Array = []
            for n in host.get("spawned"):
                if is_instance_valid(n): actors.append([n.global_position.x, n.global_position.y])
            var f := source.source_pass_frame()
            var transform := f.source_to_world
            var viewport_transform := get_viewport().get_canvas_transform()
            var report := {"skill": int(OS.get_environment("AVFX_LIVE_SKILL")), "light": OS.get_environment("AVFX_LIVE_LIGHT"),
                "requested_tick": _r17_targets[_r17_next], "source_tick": source._tick,
                "source_time": source.source_time(), "frame_index": samples.size(), "trace_count": trace.size(),
                "chosen_bolt": best, "chosen_score": best_score, "player": [player.global_position.x, player.global_position.y],
                "enemies": actors, "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y],
                "camera_zoom": [camera.zoom.x, camera.zoom.y], "source_scale": source._scale,
                "source_to_world": [transform.x.x, transform.x.y, transform.y.x, transform.y.y, transform.origin.x, transform.origin.y],
                "canvas_transform": [viewport_transform.x.x, viewport_transform.x.y, viewport_transform.y.x, viewport_transform.y.y, viewport_transform.origin.x, viewport_transform.origin.y],
                "exposure": source._fb.exposure, "bloom": source._fb.bloom_amt,
                "timing_note": "source tick last rendered before frame_post_draw; synchronous diagnostic I/O affects cadence"}
            var info := FileAccess.open(path + "/" + stamp + ".json", FileAccess.WRITE)
            info.store_string(JSON.stringify(report, "  "))
            info.close()
            print("R17_SOURCE_SNAPSHOT ", JSON.stringify(report))
            _r17_next += 1
''' + needle, 1)
needle = '''        "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y]})
    return true
'''
assert s.count(needle) == 1
s = s.replace(needle, '''        "camera": [camera.get_screen_center_position().x, camera.get_screen_center_position().y]})
    # Record one real connector at every displayed frame for the explicitly
    # isolated C-vs-native-vs-world sequence. No source frames are invented.
    if OS.get_environment("AVFX_R17_TRACE") == "1":
        var render_host := host.get("renderer") as Arcana20Renderer
        var live_source := render_host._casts.get(cast_id) as ASourcePlayer if render_host != null else null
        if is_instance_valid(live_source):
            var all_bolts: Array = live_source._spell.get("_r17_trace")
            var selected_bolt: Dictionary = {}
            var selected_score := -1.0
            for item in all_bolts:
                var bolt: Dictionary = item
                var a := Vector2(float(bolt.a[0]), float(bolt.a[1]))
                var b := Vector2(float(bolt.b[0]), float(bolt.b[1]))
                var score := a.distance_to(b) * maxf(0.0, float(bolt.k))
                if score > selected_score:
                    selected_score = score
                    selected_bolt = bolt
            samples[-1]["r17_source_tick"] = live_source._tick
            samples[-1]["r17_chosen_bolt"] = selected_bolt
    return true
''', 1)
p.write_text(s)
print('R17 disposable diagnostic instrumentation installed')
