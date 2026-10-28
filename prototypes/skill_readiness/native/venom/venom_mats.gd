class_name VenomMats
extends RefCounted

## Native port of the ORIGINAL Venomwright `src/game/mats.ts`:
## the liquid material table (`MAT`), the vapour ramps (`VAP`) and every
## actor/prop palette (`PAL`). Values are transcribed exactly; nothing here is
## a re-tinted or "close enough" approximation.

const PX = preload("res://prototypes/skill_readiness/native/venom/venom_pixel.gd")
const M = preload("res://prototypes/skill_readiness/native/venom/venom_math.gd")
const DRAW = preload("res://prototypes/skill_readiness/native/venom/venom_draw.gd")


static func _base() -> Dictionary:
	return {"vw": 0, "hiT": 0.35, "hiW": 5, "dl": 16}


static func _mat(extra: Dictionary) -> Dictionary:
	var m: Dictionary = _base()
	for k in extra:
		m[k] = extra[k]
	return m


static func MAT() -> Dictionary:
	var P: Dictionary = M.P
	return {
		"acid": _mat({"outline": P["k0"], "rim": P["c1"], "rimLit": P["c3"],
				"ramp": [P["e0"], P["e1"], P["e2"], P["e3"], P["c0"], P["c1"]],
				"hi": P["c3"], "sh": P["e0"], "vein": P["c2"], "vw": 5, "dep": 7,
				"sc": 0.17, "fx": 7, "fy": 3, "amp": 0.55, "hiT": 0.3}),
		"venom": _mat({"outline": P["k0"], "rim": P["e3"], "rimLit": P["c1"],
				"ramp": [P["k0"], P["k1"], P["e0"], P["e1"], P["e2"], P["e3"]],
				"hi": P["c0"], "sh": P["k0"], "vein": P["c0"], "vw": 4, "dep": 8,
				"sc": 0.15, "fx": 5, "fy": 2, "amp": 0.6, "hiT": 0.3}),
		"leech": _mat({"outline": P["k0"], "rim": P["n3"], "rimLit": P["y0"],
				"ramp": [P["k0"], P["n0"], P["n1"], P["n2"], P["n3"], P["v0"], P["e1"]],
				"hi": P["y1"], "sh": P["k0"], "vein": P["y0"], "vw": 3, "dep": 6,
				"sc": 0.2, "fx": 9, "fy": 2, "amp": 0.55, "hiT": 0.3}),
		"verd": _mat({"outline": P["k0"], "rim": P["v2"], "rimLit": P["v3"],
				"ramp": [P["e0"], P["e1"], P["v0"], P["v1"], P["v2"], P["g1"], P["g2"]],
				"hi": P["v3"], "sh": P["e0"], "vein": P["g2"], "vw": 5, "dep": 7,
				"sc": 0.15, "fx": 8, "fy": 4, "amp": 0.7, "hiT": 0.3}),
		"merc": _mat({"outline": M.hex("#06181a"), "rim": P["y1"], "rimLit": P["w"],
				"ramp": [M.hex("#0a2a2c"), M.hex("#15484a"), M.hex("#3c8582"),
						M.hex("#8fc9c3"), M.hex("#d6fff8")],
				"hi": P["w"], "sh": M.hex("#06181a"), "vein": 0, "vw": 0, "dep": 4,
				"sc": 0.12, "fx": 4, "fy": 2, "amp": 0.3, "hiT": 0.15, "hiW": 6}),
		"bile": _mat({"outline": P["e0"], "rim": P["c3"], "rimLit": P["w"],
				"ramp": [P["g0"], P["g1"], P["g2"], P["c2"], P["c3"]],
				"hi": P["w"], "sh": P["g0"], "vein": P["c3"], "vw": 3, "dep": 6,
				"sc": 0.14, "fx": 3, "fy": 2, "amp": 0.5, "hiT": 0.3}),
		"rot": _mat({"outline": P["k0"], "rim": P["e1"], "rimLit": P["c0"],
				"ramp": [P["k0"], P["k1"], P["n0"], P["e0"], P["n1"], P["e1"]],
				"hi": P["c0"], "sh": P["k0"], "vein": P["m1"], "vw": 3, "dep": 7,
				"sc": 0.16, "fx": 4, "fy": 2, "amp": 0.6, "hiT": 0.3}),
		"brine": _mat({"outline": P["k0"], "rim": P["v1"], "rimLit": P["v3"],
				"ramp": [P["k0"], P["k1"], P["n0"], P["v0"], P["e0"], P["v1"]],
				"hi": P["v3"], "sh": P["k0"], "vein": P["y1"], "vw": 3, "dep": 6,
				"sc": 0.18, "fx": 10, "fy": 1, "amp": 0.6, "hiT": 0.3}),
		"magenta": _mat({"outline": P["k0"], "rim": P["m2"], "rimLit": P["w"],
				"ramp": [P["n0"], P["m0"], P["m1"], P["m2"], P["c2"]],
				"hi": P["w"], "sh": P["n0"], "vein": P["c2"], "vw": 3, "dep": 6,
				"sc": 0.16, "fx": 6, "fy": 3, "amp": 0.6, "hiT": 0.3}),
		"ink": _mat({"outline": P["k0"], "rim": P["n2"], "rimLit": P["v1"],
				"ramp": [P["k0"], P["k0"], P["k1"], P["n0"], P["n1"]],
				"hi": P["n3"], "sh": P["k0"], "vein": P["e2"], "vw": 2, "dep": 6,
				"sc": 0.2, "fx": 6, "fy": 2, "amp": 0.5, "hiT": 0.4}),
	}


static func VAP() -> Dictionary:
	var P: Dictionary = M.P
	return {
		"green": [P["e0"], P["e1"], P["e2"], P["c0"]],
		"dark": [P["k0"], P["k1"], P["e0"], P["e1"]],
		"pale": [P["e2"], P["c0"], P["c2"], P["c3"]],
		"steam": [P["v0"], P["v2"], P["v3"], P["y2"]],
		"dust": [P["i3"], P["i2"], P["i1"], P["i0"]],
		"indigo": [P["n0"], P["n1"], P["n2"], P["n3"]],
		"gold": [P["g0"], P["g1"], P["c2"], P["g2"]],
	}


static func PAL() -> Dictionary:
	var P: Dictionary = M.P
	return {
		"glass": DRAW.pal(M.hex("#0b2d2e"), P["v0"], P["v1"], P["v2"], P["v3"]),
		"glassHi": DRAW.pal(M.hex("#0b2d2e"), P["v1"], P["v2"], P["v3"], P["y2"]),
		"chitin": DRAW.pal(P["k0"], P["n1"], P["n2"], P["n3"], P["c1"]),
		"chitinHot": DRAW.pal(P["k0"], M.hex("#2a1d12"), M.hex("#6a4a1c"),
				P["g1"], P["g2"]),
		"cer": DRAW.pal(M.hex("#26242e"), P["i2"], P["i1"], P["i0"], P["w"]),
		"cerB": DRAW.pal(P["n0"], M.hex("#2f3f80"), M.hex("#4f6bc0"),
				M.hex("#9fb8f0"), P["w"]),
		"copper": DRAW.pal(P["u0"], P["u0"], P["u1"], P["u2"], P["g2"]),
		"toad": DRAW.pal(P["k0"], P["e0"], P["e1"], P["e2"], P["c1"]),
		"toadSac": DRAW.pal(P["e0"], M.hex("#8fb04a"), M.hex("#c8d878"),
				M.hex("#eef2b0"), P["w"]),
		"leech": DRAW.pal(P["k0"], P["n0"], P["n1"], P["m0"], P["m2"]),
		"seed": DRAW.pal(M.hex("#3a3326"), P["i2"], P["i1"], P["i0"], P["w"]),
		"liquid": DRAW.pal(P["k0"], P["e1"], P["e3"], P["c1"], P["c3"]),
		"gold": DRAW.pal(P["u0"], P["g0"], P["g1"], P["g2"], P["w"]),
		"merc": DRAW.pal(M.hex("#06181a"), M.hex("#15484a"), M.hex("#4c8f8a"),
				M.hex("#b5e6df"), P["w"]),
		"rot": DRAW.pal(P["k0"], P["k1"], P["e0"], P["e1"], P["c0"]),
		"crys": DRAW.pal(M.hex("#0b2d3a"), P["v0"], P["y0"], P["y1"], P["y2"]),
		"iron": DRAW.pal(P["k0"], M.hex("#3a3a46"), M.hex("#5d5d70"),
				M.hex("#8d8da3"), P["w"]),
		"imp": DRAW.pal(M.hex("#1a0b10"), P["r0"], P["r1"], P["r2"], P["r3"]),
		"crab": DRAW.pal(M.hex("#1a0f08"), P["u0"], P["u1"], P["u2"], P["g2"]),
		"bone": DRAW.pal(M.hex("#14110d"), P["i3"], P["i2"], P["i1"], P["i0"]),
		"hood": DRAW.pal(M.hex("#0b0a10"), M.hex("#1b1a28"), M.hex("#2b2940"),
				M.hex("#46436a"), M.hex("#7a76b0")),
		"stone": DRAW.pal(P["k0"], M.hex("#2a2420"), M.hex("#4a403a"),
				M.hex("#7a6a5a"), P["i1"]),
		"brute": DRAW.pal(M.hex("#150808"), P["r0"], M.hex("#7a2b2b"),
				M.hex("#b0473a"), P["r3"]),
	}
