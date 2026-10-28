extends SceneTree
## Source Gold Pool.lit() original RGBA hashes, original src/game/fx.ts
## 600x340 Gfx l=Layer, k=1. Ten complete frames across two Pool kinds.
const SHADE=preload("res://prototypes/gold_pair/venom_source_pool_shade.gd")
const CASES=[
    ["trail",335.23,182.42,4.0,0.9,2,0.1,[
        [0.0,"d4d744195832b4421328d7a250974a25b40249c898fafe710da7a491227e30e6",1],
        [0.04,"090baf749f041cac388edd519629784cb4b56462b7c8b94b66f539bfe53b20b4",13],
        [0.1,"b595078e7645012080bdd37eb04fef994d3b7ea0382b038f6b8f0748766eb560",99],
        [0.45,"fa8520188ae9c909c9af89833cb13f10f131d67c2cba473719fd716cee722714",99],
        [0.88,"f6950594e9fd796819c41f8f3347144e9ec97427710d1a4ceb602d49fc30ffd7",99]
    ]],
    ["finisher",391.72,176.95,6.5,4.2,3,0.3,[
        [0.0,"5d08531ef1a5403b609442e972d8d28c50f2c61f60b5d6ea49df2d6d05c7b74c",1],
        [0.09,"b884738a90049b49a2aecff94cb3652f793ea14fa4a429d6ae63bc7359610617",13],
        [0.3,"bfa172cd5d161f0ca6b7cebd7db2ed72ae7fd301cf886b431e22ee1ba740fe13",243],
        [1.4,"bfa172cd5d161f0ca6b7cebd7db2ed72ae7fd301cf886b431e22ee1ba740fe13",243],
        [4.08,"3f5b301fae3c2cec087ce2e4b18bc925f0d9a0f66911b1aacfcf66c815caad9e",243]
    ]]
]
func _initialize()->void:
    var shader=SHADE.new()
    var checks:int=0
    for c in CASES:
        shader.begin(float(c[1]),float(c[2]),float(c[3]),float(c[4]),int(c[5]),float(c[6]))
        for row in c[7]:
            var rgba:PackedByteArray=shader.source_light_frame(float(row[0]))
            var hash:String=shader.full_rgba_sha(rgba)
            var n:int=0
            for i in range(3,rgba.size(),4):
                if rgba[i]!=0:n+=1
            if hash!=String(row[1]) or n!=int(row[2]):
                push_error("VENOM_POOL_LIGHT: %s age=%.3f Gold=%s native=%s pxGold=%d pxNative=%d" % [c[0],float(row[0]),String(row[1]),hash,int(row[2]),n])
                quit(1)
                return
            checks+=1
    if checks!=10:
        push_error("VENOM_POOL_LIGHT: incomplete source coverage")
        quit(1)
        return
    print("VENOM_POOL_LIGHT: PASS / 10 exact original Pool.lit() source 600x340 RGBA SHA256")
    quit(0)
