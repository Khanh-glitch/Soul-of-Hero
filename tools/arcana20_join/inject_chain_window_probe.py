"""Instrument a disposable genuine world capture, never production combat."""
import pathlib,sys
p=pathlib.Path(sys.argv[1])/'prototypes/arcana_fusion20/renderer/playtest/arcana20_live_capture.gd'
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
    return true
''',1)
p.write_text(s)
print('A09_WINDOW_CAPTURE_INSTRUMENTED disposable real-route capture')
