extends SceneTree

## ARCANA III foundation gate: native ArcanaUtil vs the ORIGINAL util.ts
## executed under Node (reference/arcana_node/results/vectors.json).
## RNG must match bit-exactly (same mulberry32); ease/noise compared at 1e-9.
## This proves the family RNG/timing foundation only — NOT Pixi visual parity.
## Pass line: "GOLD93_ARCANA_REFERENCE: PASS".

const UTIL = preload("res://prototypes/skill_readiness/native/arcana/arcana_util.gd")

var _failures: int = 0


func _check(ok: bool, label: String) -> void:
	if not ok:
		_failures += 1
		print("GOLD93_ARCANA_REFERENCE FAIL: " + label)


func _close(a: float, b: float, tol: float) -> bool:
	return absf(a - b) <= tol


func _init() -> void:
	var path := "res://prototypes/skill_readiness/reference/arcana_node/results/vectors.json"
	var f := FileAccess.open(path, FileAccess.READ)
	_check(f != null, "vectors.json exists")
	if f == null:
		quit(1)
		return
	var data: Dictionary = JSON.parse_string(f.get_as_text())
	f.close()
	for seed in [1, 7, 0, 12345]:
		var u = UTIL.new()
		u.reseed(seed)
		var exp: Array = data["rng_seed_%d" % seed]
		for i in range(exp.size()):
			var got: float = u.rand()
			if got != float(exp[i]):
				print("GOLD93_ARCANA_RNG seed=%d step=%d got=%0.17f exp=%0.17f" % [seed, i, got, float(exp[i])])
			_check(got == float(exp[i]), "rng seed %d step %d bit-exact" % [seed, i])
	var ts: Array = [0.0, 0.1, 0.25, 0.5, 0.75, 0.9, 1.0]
	for name in data["ease"].keys():
		var exp2: Array = data["ease"][name]
		for i in range(ts.size()):
			_check(_close(UTIL.ease(name, ts[i]), float(exp2[i]), 1e-9), "ease %s t=%s" % [name, str(ts[i])])
	for i in range(ts.size()):
		_check(_close(UTIL.prog(ts[i] * 10.0, 2.3, 3.8), float(data["prog"][i]), 1e-9), "prog %d" % i)
		_check(_close(UTIL.sstep(1.3, 3.2, 1.3 + ts[i] * 1.9), float(data["sstep"][i]), 1e-9), "sstep %d" % i)
	for i in range(5):
		_check(_close(UTIL.hash1([0.0, 1.0, 7.0, 42.0, 1000.0][i]), float(data["hash1"][i]), 1e-9), "hash1 %d" % i)
	var h2in: Array = [[0.0, 0.0], [1.0, 2.0], [7.0, 13.0], [100.0, 50.0]]
	var vnin: Array = [[0.0, 0.0], [1.5, 2.5], [7.25, 13.75], [100.5, 50.25]]
	for i in range(4):
		_check(_close(UTIL.hash2(h2in[i][0], h2in[i][1]), float(data["hash2"][i]), 1e-9), "hash2 %d" % i)
		_check(_close(UTIL.vnoise(vnin[i][0], vnin[i][1]), float(data["vnoise"][i]), 1e-9), "vnoise %d" % i)
	print("GOLD93_ARCANA_REFERENCE: %s | failures %d" % ["PASS" if _failures == 0 else "FAIL", _failures])
	quit(0 if _failures == 0 else 1)
