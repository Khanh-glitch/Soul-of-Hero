extends SceneTree

## Both ORIGINAL engine families must stay independent: separate logical
## resolutions, separate native raster density, separate RNG zero-seed policy
## and separate clocks. This test also exercises the ARCANA source-locked
## crack-scar primitive so the ARCANA ground layer is proven real.

const VENOM = preload("res://prototypes/skill_readiness/families/venom_family_runtime.gd")
const ARCANA = preload("res://prototypes/skill_readiness/families/arcana_family_runtime.gd")

var _failures: Array[String] = []


func _check(condition: bool, message: String) -> void:
	if not condition:
		_failures.append(message)
		push_error("GOLD93_FAMILY_CLOCK: " + message)


func _initialize() -> void:
	var venom := VENOM.new()
	var arcana := ARCANA.new()

	# --- independent logical / native resolutions ----------------------------
	_check(venom.logical_size() == Vector2i(600, 340), "Venomwright logical world must be 600x340")
	_check(arcana.logical_size() == Vector2i(480, 270), "ARCANA III logical world must be 480x270")
	_check(venom.default_density() == 2, "Venomwright native Ultra is k2")
	_check(venom.native_frame_size() == Vector2i(1200, 680),
			"Venomwright native Ultra frame must be 1200x680, never an upscaled 1x")
	_check(arcana.native_frame_size() == Vector2i(960, 540),
			"ARCANA III 2X frame must be 960x540")
	_check(venom.default_hz() == 60.0, "Venomwright authored clock is 60 Hz")
	_check(arcana.default_hz() == 60.0, "ARCANA III authored clock is 60 Hz")

	# --- RNG zero-seed policy differs per family (do not mix streams) --------
	var v0 := venom.make_rng(0)
	var a0 := arcana.make_rng(0)
	_check(v0.state == 0, "Venomwright zero seed stays 0")
	_check(a0.state == 1, "ARCANA III zero seed maps to 1")
	_check(venom.arcana_zero_seed_policy() == false, "Venomwright must not use the ARCANA seed policy")
	_check(arcana.arcana_zero_seed_policy() == true, "ARCANA III must use its own seed policy")

	# --- fixed clock determinism ---------------------------------------------
	var v1 := venom.headless_probe(20261028, 330)
	var v2 := venom.headless_probe(20261028, 330)
	_check(v1["rng_sum"] == v2["rng_sum"], "Venomwright RNG must be deterministic per seed")
	_check(absf(float(v1["rng_sum"]) - 165.0) < 20.0,
			"Venomwright RNG sum must sit at the uniform expectation, got %f" % float(v1["rng_sum"]))
	var a1 := arcana.headless_probe(20261028, 330)
	var a2 := arcana.headless_probe(20261028, 330)
	_check(a1["rng_sum"] == a2["rng_sum"], "ARCANA RNG must be deterministic per seed")
	# Both families share the SAME verified mulberry32 primitive, so a non-zero
	# seed produces the same arithmetic. What must differ is seed OWNERSHIP, not
	# the algorithm: the ARCANA zero-seed policy remaps 0 -> 1, Venom keeps 0.
	_check(venom.headless_probe(0, 16)["rng_sum"] != arcana.headless_probe(0, 16)["rng_sum"],
			"the zero-seed policy must keep the two families' streams distinct")
	# Each family must own an independent RNG instance, never a shared stream.
	var vi := venom.make_rng(20261028)
	var ai := arcana.make_rng(20261028)
	vi.next()
	_check(vi.state != ai.state,
			"each family must advance its own RNG instance, not a shared stream")

	# --- ARCANA source-locked crack-scar primitive ---------------------------
	var probe: Dictionary = arcana.scar_probe(20261027, 240.0, 135.0, 5, 40.0, 5.0,
			[0.0, 1.0, 3.5, 5.2])
	var rows: Array = probe.get("rows", [])
	_check(rows.size() == 4, "scar probe must cover four source ages")
	for row in rows:
		_check(String(row.get("geometry_sha256", "")).length() == 64, "geometry hash required")
		_check(String(row.get("draw_sha256", "")).length() == 64, "draw command hash required")
		_check(int(row.get("draw_commands", 0)) > 0, "original draw commands must be produced")
	var repeat: Dictionary = arcana.scar_probe(20261027, 240.0, 135.0, 5, 40.0, 5.0, [1.0])
	_check(repeat["rows"][0]["draw_sha256"] == rows[1]["draw_sha256"],
			"identical seed/age must reproduce the identical ARCANA draw stream")
	var other: Dictionary = arcana.scar_probe(7, 240.0, 135.0, 5, 40.0, 5.0, [1.0])
	_check(other["rows"][0]["draw_sha256"] != rows[1]["draw_sha256"],
			"a different seed must change the ARCANA scar")

	# --- surfaces attach and detach cleanly (no leaked nodes) ----------------
	var holder := Node2D.new()
	root.add_child(holder)
	_check(venom.attach(holder, 2), "Venomwright surfaces must attach")
	_check(venom.stats()["owned_nodes"] >= 4, "Venomwright owns every render surface")
	_check(arcana.attach(holder, 2), "ARCANA surfaces must attach")
	var released_v: int = venom.detach()
	var released_a: int = arcana.detach()
	_check(released_v >= 4, "Venomwright teardown must release every surface")
	_check(released_a >= 1, "ARCANA teardown must release the ground canvas")
	_check(int(venom.stats()["owned_nodes"]) == 0, "no owned node may survive detach")

	if _failures.is_empty():
		print("GOLD93_FAMILY_CLOCK: PASS / two independent original engines / 60Hz / separate RNG zero-seed policy / ARCANA source-locked scar / clean teardown")
		quit(0)
	else:
		print("GOLD93_FAMILY_CLOCK: FAIL / %d problem(s)" % _failures.size())
		quit(1)
