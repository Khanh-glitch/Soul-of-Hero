extends SceneTree

## ORIGINAL user ZIP src/game/fx.ts Pool.gnd/lit at REAL Ultra k=2.
## Actual TS Field Float32 1200x680 + original pixel.ts Layer colors
## + Gold additive light pass. 21 full binary SHA256 (7 times x 3 buffers).
## k1 old oracles are separately rerun in this CI; no fake resize.
const SHADE=preload("res://prototypes/gold_pair/venom_source_pool_shade.gd")
const CASES=[
    ["trail",335.23,182.42,4.0,0.9,2,0.1,[
        [0.04,"4d86c47072df7b006b477ad6586bd1493d0eff60119786d402b8305a8b905a3c","945881962714802dd72aeaeb2c8dc9d9a94fa59ca9d39fd40e6ea1d067694ab8","90bddf11eb6e4a235ee9092ba01aec2deea9072b56aaafe02a1143f577e9f4de"],
        [0.1,"17dc12c971d1b6f8fc7aa2b00336e5f4765df0f9edb6529419ee990d230b961e","39164b29e84411fc23eb0e43955282f13bcae53da6ceafcf88a3cd821940b8e0","b12bac0758c751f2a9ff7e0f9b13ad8e405f7f23bfcf386e2ba4541f1be53430"],
        [0.45,"279d97f7651a4a397895b9b3ab0149d1a7d2d8cf008fcd2fdca77d30094e4341","87aa409bc7c6c1ffaa2d4d098e4ff83b7483afa887b180ec88b4b28111ee9a0c","ddb73567d7a9d957b696922bb0d20d173802b1290fe8d9c35a96944e1b17b8dd"]
    ]],
    ["finisher",391.72,176.95,6.5,4.2,3,0.3,[
        [0.09,"672539f11b13a8a173824f3eed292227fa71b999103e10b237aa7286a7055075","408641f2fcf4b9b9fde9a07e8a21daeb844be332bf3d560390f0df3041e6a14c","841c6c09cec7e8bd21f105e254e1619340859699b64470d1a11339fcce61e2f6"],
        [0.3,"9e406958411c53528615b0cf540c875763acfa24abb1ce815d82c048f51e2ec6","288881cb08a4c40ff67351a37f1a46c9359eeac449828f52d57eb85c1e3962f3","045802ee258ba128adffee04eaa1c42f95c1de6e629b5485d16a448c7b3c8df5"],
        [1.4,"baaabd556de8330ee0cceb8c0800b7b67a635909d8662ff7044f95747e42508a","9aadea1413c02c0d60430ad1a79d92f55afc41e2b83ba658d1e39a4ac9af1516","045802ee258ba128adffee04eaa1c42f95c1de6e629b5485d16a448c7b3c8df5"],
        [4.08,"96f0a140a990f42572f9da2c17edbdcd4d3eb55b8e9089fe0aea50ef8b10daf7","160634ea80c2be16cbb85bca2ae9f1b6cce5cd3daa892a5c40311860802f2588","c12f4c45c36a16829d19dbf7f147f46adb7d3db1b55d4cba67536b01bc42af0a"]
    ]]
]

func _initialize()->void:
    var checked:int=0
    for c in CASES:
        var shade=SHADE.new(2)
        shade.begin(float(c[1]),float(c[2]),float(c[3]),float(c[4]),int(c[5]),float(c[6]))
        for p in c[7]:
            var age:float=float(p[0])
            var pixels:PackedByteArray=shade.source_frame(age,age+0.53)
            var light:PackedByteArray=shade.source_light_frame(age)
            if pixels.size()!=1200*680*4 or light.size()!=1200*680*4:
                _fail("actual original Ultra raster 1200x680 not allocated")
                return
            var got:Array[String]=[
                shade.pool.source_hash(),
                shade.full_rgba_sha(pixels),
                shade.full_rgba_sha(light)
            ]
            for i in range(3):
                var want:String=String(p[i+1])
                if got[i]!=want:
                    _fail("Gold Ultra %s age %.3f %s original=%s Godot=%s" % [c[0],age,["Float32 Field","Pool.gnd RGBA","Pool.lit RGBA"][i],want,got[i]])
                    return
                checked+=1
    if checked!=21:
        _fail("only %d / 21 Ultra source checkpoints" % checked)
        return
    print("VENOM_POOL_ULTRA: PASS / 21 exact original Gold 1200x680 SHA256 / Float32 SDF + ground RGBA + additive glow")
    quit(0)

func _fail(message:String)->void:
    push_error("VENOM_POOL_ULTRA: "+message)
    quit(1)
