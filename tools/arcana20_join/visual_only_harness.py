"""Remove the old test-only R4 damage stimulus from a disposable checkout.
The production owner bridge and historical visual sources are never edited.
"""
import pathlib,sys
p=pathlib.Path(sys.argv[1])/'prototypes/arcana_fusion20/renderer/arcana20_overworld_join_test.gd'
s=p.read_text()
start=s.find('    var hit: bool = r4.call(&"request_hit"')
if start != -1:
    end=s.index('    if OS.has_environment("ARCANA20_PHASE_FIRST"):', start)
    s=s[:start]+'    check(int(enemy.get("health")) == hp_before, "visual-only test leaves actor HP unchanged")\n'+s[end:]
    p.write_text(s)
if 'r4.call(&"request_hit"' in p.read_text():
    raise SystemExit('unexpected combat request in test harness')
