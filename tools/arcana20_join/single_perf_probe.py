"""Adapt both disposable revisions' overlap probe to measure one #10 cast.

Only the diagnostic test harness is edited in the throwaway checkout: source
algorithms and owner files are untouched. Refuse unknown probe layouts.
"""
import pathlib, sys
p=pathlib.Path(sys.argv[1])/'prototypes/arcana_fusion20/renderer/arcana20_overworld_join_test.gd'
s=p.read_text(); start=s.index('func _overlap_frame_probe('); end=s.index('\n## Live real-world input probe.', start)
body=s[start:end]
changes=[
 ('var accepted_2 := renderer.cast_skill(id2, player.global_position, enemy.global_position)', 'var accepted_2 := true # no #02 cast in this diagnostic', 1),
 ('mount.active_viewers(id2) > 0 and ', '', 3),
 ('not renderer._casts.has(id2) or ', '', 1),
 ('"scope": "concurrent #02+#%02d sampled frames', '"scope": "single #%02d sampled frames', 1),
 ('"overlap_frames": overlapping_frames', '"sample_frames": overlapping_frames', 1),
 ('JOIN_RENDERED_FRAME_PERF ', 'JOIN_RENDERED_SINGLE_PERF ', 1),
 ('overlap_frame_perf.json', 'single_frame_perf.json', 1),
 ('overlap_perf_live_', 'single_perf_live_', 2),
]
for old,new,count in changes:
 actual=body.count(old)
 if actual!=count: raise SystemExit(f'Unexpected probe layout: {old!r}, expected {count}, got {actual}')
 body=body.replace(old,new)
body=body.replace('overlap perf casts accepted','single cast accepted').replace('overlap screenshot has both live source viewers','single screenshot has live source viewer').replace('both source viewers persist across overlap screenshot','single source viewer persists across screenshot').replace('overlap perf produced multiple actually concurrent rendered frames','single cast produced multiple active rendered frames').replace('overlap visuals have no damage authority','single visual has no damage authority').replace('overlap cancellation removes both source viewers','single cancellation removes source viewer')
p.write_text(s[:start]+body+s[end:])
