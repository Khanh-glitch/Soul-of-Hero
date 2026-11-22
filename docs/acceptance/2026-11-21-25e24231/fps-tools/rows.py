import json,sys
for l in open(sys.argv[1]):
    r=json.loads(l); c=r['cb']; g=r.get('regions') or {}
    print(f"{r['label']:15s} {r['atMin']:4} fps {r['fps']:5} cb {c['mean']:6} p95 {c['p95']:5} p99 {c['p99']:6} max {c['max']:6} >33 {c['over33']:4} tick {r['tick']:5} needs {r['tickNeeds']:4} geo {r['compileGeo']:4} draw {r['draw']:5} save {r['save']:4} react {r.get('react')} gc {r['gc']} | {g.get('requested')}/{g.get('received')}/{g.get('served')}/{g.get('dropped')}/{g.get('waiting')}")
