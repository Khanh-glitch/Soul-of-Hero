"""Inspect original GPU h11 at each case center; RGBA8 quantized diagnostic."""
import json,math,pathlib,sys
p=pathlib.Path(sys.argv[1]);cases=json.loads(pathlib.Path('tools/arcana19_sprite_compare/cases.json').read_text())
for c in cases:
    raw=(p/f"{c['name']}.original.hash.rgba8").read_bytes()
    x=round(c['x']);y=round(c['y']);i=((269-y)*480+x)*4
    seed=c['opts'].get('seed',c['x']*.173+c['y']*.31)
    def h(n):
        v=math.sin(n*127.1)*43758.5453
        return v-math.floor(v)
    print('D19_SPRITE_HASH '+json.dumps({'case':c['name'],'seed':seed,'gpu_rgba8':list(raw[i:i+4]),'native_double_h11':[h(seed),h(seed+3.7)],'scope':'fragment h11 GPU results quantized to RGBA8, backend-dependent; not a replacement or coverage test'}))
