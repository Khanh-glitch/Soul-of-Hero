extends SceneTree
## A3 adapter tests against the REAL SaveService, not a mock inventory.
## Station/time/skill producers are explicit NATIVE FIXTURE contracts. They are
## not A0 production placement, not an authoritative wall-clock, and not A4 Gold
## verification. Production catalog Cores remain BLOCKED_PENDING_A4.
const Economy = preload("res://game/survival/economy/economy_service.gd")
const WorldSources = preload("res://game/survival/economy/world_source_adapter.gd")
const Survival = preload("res://game/survival/survival_service.gd")
const TIME_CONTRACT := "soh.economy.active_tick.v1"
const SKILL_CONTRACT := "soh.economy.skill_attestation.v1"
const WORLD_CONTRACT := "soh.economy.world_host.v1"
var checks := 0
var failures: Array[String] = []
var save: Node
var eco: RefCounted
var stations := {}
var case_id := 0
var path := ""
var clock_session_index := 1
var clock_session_id := "fixture-session-1"
var clock_sequence := 0
var clock_station_ticks := {}
var clock_revisions := {}
var attestation_mode := "valid"
var world_session_index := 1
var world_session_id := "fixture-world-1"
var world_sequence := 0
var world_active_seconds := 0
var world_poi := "poi_crown_waystation"
var world_cell := Vector2i(408, 199)
var world_discovered := true
var world_revision := 1
var survival: Node

func _initialize() -> void:
	_run.call_deferred()

func _expect(value: bool, label: String) -> void:
	checks += 1
	if value:
		print("  ok    %s" % label)
	else:
		failures.append(label)
		print("  FAIL  %s" % label)

func _begin(label: String) -> void:
	case_id += 1
	print("[case %02d] %s" % [case_id, label])
	path = "user://tests/a3_economy_%d_%d.json" % [Time.get_ticks_usec(), case_id]
	_expect(bool(save.call(&"configure_storage", path, true)), "fresh authoritative save")
	stations = {}
	clock_session_index = 1
	clock_session_id = "fixture-session-1"
	clock_sequence = 0
	clock_station_ticks = {}
	clock_revisions = {"hand": "hand"}
	attestation_mode = "valid"
	world_session_index = 1
	world_session_id = "fixture-world-1"
	world_sequence = 0
	world_active_seconds = 0
	world_poi = "poi_crown_waystation"
	world_cell = Vector2i(408, 199)
	world_discovered = true
	world_revision = 1
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "catalog + real SaveService adapter")
	eco.configure_time_host(_host_time)
	eco.configure_world_host(_world_host)

func _resolve(id: String) -> Dictionary:
	return stations.get(id, {}).duplicate(true)

func _station(id: String, kind: String, tier := 1) -> void:
	stations[id] = {"ok": true, "station_id": id, "kind": kind, "tier": tier,
		"queue_capacity": 3, "operational": true, "condition": 100, "station_revision": "rev-1"}
	clock_revisions[id] = "rev-1"

func _host_time(station_id: String) -> Dictionary:
	return {"contract": TIME_CONTRACT, "station_id": station_id,
		"session_id": clock_session_id, "session_index": clock_session_index,
		"sequence": clock_sequence, "active_ticks": int(clock_station_ticks.get(station_id, 0)),
		"station_revision": String(clock_revisions.get(station_id, "rev-1"))}

func _tick(station_id: String, ticks: int, event_id: String) -> Dictionary:
	clock_station_ticks[station_id] = int(clock_station_ticks.get(station_id, 0)) + ticks
	clock_sequence += 1
	return eco.advance(station_id, _host_time(station_id), event_id)

func _reload(new_session := true) -> void:
	_expect(bool(save.call(&"reload_save")), "reload from disk")
	if new_session:
		clock_session_index += 1
		clock_session_id = "fixture-session-%d" % clock_session_index
		clock_sequence = 0
		clock_station_ticks = {}
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "reconfigure adapter after reload")
	eco.configure_time_host(_host_time)
	eco.configure_world_host(_world_host)

func _give(id: String, amount: int) -> void:
	var kind := String(eco.item(id).get("kind", "material"))
	if kind in ["station_kit", "equipment", "skill_core"]:
		kind = "material"
	_expect(bool(save.call(&"grant_inventory_item", id, kind, amount, "fixture.%d.%s.%d" % [case_id, id, Time.get_ticks_usec()])), "fixture grant " + id)

func _count(id: String) -> int:
	return int(eco.inventory_totals().get(id, 0))

func _snapshot() -> Dictionary:
	return save.call(&"get_snapshot")

func _finish_job(job_id: String, station := "bench") -> void:
	if job_id.is_empty():
		_expect(false, "finish_job received empty job_id")
		return
	for i in range(4):
		var js: Dictionary = eco.jobs()
		if not js.has(job_id) or String(js[job_id].status) == "ready":
			break
		var advanced: Dictionary = _tick(station, 600, "tick.%d.%s.%d" % [case_id, job_id, i])
		if not bool(advanced.ok):
			_expect(false, "advance production: " + String(advanced.get("reason", "")))
			return
	var collected: Dictionary = eco.collect(job_id, "collect.%d.%s" % [case_id, job_id])
	_expect(bool(collected.ok), "collect output")

func _earn_core_tech(prefix: String) -> void:
	_station("lab", "research")
	_give("knowledge_spares", 30); _give("iron_scrap", 3); _give("iron_ingot", 2)
	_give("research_notes", 3); _give("soul_ember", 2); _give("crypt_bone_shard", 2)
	for tid in ["tech_smelting", "tech_precision", "tech_core_binding"]:
		var tj: Dictionary = eco.research_technology(tid, "lab", prefix + "." + tid)
		_expect(bool(tj.ok), "earn prerequisite " + tid)
		_finish_job(tj.job_id, "lab")

func _fixture_skill_binding() -> Dictionary:
	return {"abstract_skill_id": "soh.core.venom", "original_skill_id": "NATIVE_FIXTURE_NOT_GOLD",
		"skill_version": "fixture-v1", "source_sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
		"verification_evidence_id": "native-fixture-only"}

func _install_fixture_skill_gate() -> void:
	# Mutates only this adapter's in-memory catalog copy, never data/ or A4 files.
	eco.catalog["items"]["core_venom"]["skill_readiness"] = "A4_VERIFIED"
	eco.catalog["items"]["core_venom"]["verified_skill_binding"] = _fixture_skill_binding()
	eco.configure_skill_attestor(_fixture_attestor)

func _fixture_attestor(request: Dictionary) -> Dictionary:
	if attestation_mode == "missing":
		return {}
	var a: Dictionary = request.duplicate(true)
	a["verification_status"] = "A4_VERIFIED"
	a["ready"] = true
	a["gameplay_commit_token"] = "fixture-commit-token"
	match attestation_mode:
		"synthetic_ready":
			return {"ready": true, "abstract_skill_id": request.get("abstract_skill_id", "")}
		"unverified":
			a["verification_status"] = "UNVERIFIED"
		"wrong_version":
			a["skill_version"] = "fixture-v2"
		"wrong_original_id":
			a["original_skill_id"] = "WRONG_SKILL"
		"wrong_abstract_id":
			a["abstract_skill_id"] = "soh.core.frost"
		"wrong_source":
			a["source_sha256"] = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
		"wrong_boundary":
			a["gameplay_boundary"] = "ui_preview"
		"wrong_context":
			a["context_sha256"] = "bad-context"
		"wrong_instance":
			a["instance_id"] = "soh_i_000000000000_ffffffff"
		"wrong_revision":
			a["expected_revision"] = int(request.get("expected_revision", 0)) + 1
		"empty_token":
			a["gameplay_commit_token"] = ""
	return a

func _run() -> void:
	save = root.get_node_or_null("SaveService")
	if save == null:
		print("A3 ECONOMY FAILED: SaveService autoload missing")
		quit(1); return
	# 01 starter chain and shared fuel/resource competition.
	_begin("hand -> furnace -> reserved smelt -> collect")
	_station("furnace", "furnace")
	_give("oak_wood", 2); _give("iron_scrap", 3)
	var charcoal: Dictionary = eco.enqueue("burn_charcoal", "furnace", "charcoal.1")
	_expect(bool(charcoal.ok), "charcoal enqueued")
	_expect(_count("oak_wood") == 0, "inputs reserved atomically")
	_expect(not bool(eco.enqueue("smelt_iron", "furnace", "iron.early").ok), "smelting refuses without committed fuel")
	_expect(bool(_tick("furnace", 4, "tick.4").ok), "partial trusted tick")
	_expect(_count("charcoal") == 0, "no early output")
	_finish_job(charcoal.job_id, "furnace")
	_expect(_count("charcoal") == 2, "charcoal output exact")
	var iron: Dictionary = eco.enqueue("smelt_iron", "furnace", "iron.1")
	_expect(bool(iron.ok), "smelting queued once fuel exists")
	_expect(_count("charcoal") == 1, "fuel reserved atomically")
	_finish_job(iron.job_id, "furnace")
	_expect(_count("charcoal") == 1 and _count("iron_ingot") == 1, "furnace outputs exact")
	# 02 prerequisites and duplicate command payload binding.
	_begin("station, knowledge, event identity")
	_give("oak_wood", 20); _give("iron_scrap", 2)
	_expect(not bool(eco.enqueue("burn_charcoal", "missing", "no.station").ok), "phantom station refused")
	_expect(not bool(eco.enqueue("craft_core_venom", "hand", "no.knowledge").ok), "unknown Core recipe refused")
	_station("bench", "workbench")
	var first: Dictionary = eco.enqueue("workbench_kit", "bench", "same.event")
	_expect(bool(first.ok), "first command accepted")
	var before := _snapshot()
	_expect(bool(eco.enqueue("workbench_kit", "bench", "same.event").get("duplicate", false)), "same event is idempotent")
	_expect(not bool(eco.enqueue("workbench_kit", "bench2", "same.event").ok), "same event different payload refused")
	_expect(_snapshot() == before, "replays leave save byte-equivalent")
	# 03 cancellation, full bag, reload and repeated collection.
	_begin("cancel / full output inventory / reload")
	_station("bench", "workbench")
	_give("oak_wood", 6); _give("iron_scrap", 2)
	var cancelled: Dictionary = eco.enqueue("workbench_kit", "bench", "cancel.job")
	_expect(bool(eco.cancel(cancelled.job_id, "cancel.once").ok), "cancel reserved job")
	_expect(_count("oak_wood") == 0, "refund remains in escrow, not duplicated in bag")
	for i in range(40):
		var filled: bool = bool(save.call(&"grant_inventory_item", "fixture_blocker_%02d" % i, "material", 1, "fixture.fill.%d.%d" % [case_id, i]))
		if not filled:
			break
	_expect(not bool(eco.collect(cancelled.job_id, "collect.full").ok), "full bag refuses collection")
	_reload()
	_expect(not bool(eco.collect(cancelled.job_id, "collect.full.after.reload").ok), "full bag still refuses after reload")
	_expect(bool(save.call(&"consume_inventory_item", "fixture_blocker_00", 1, "free.slot.0")), "free slot 0")
	_expect(bool(save.call(&"consume_inventory_item", "fixture_blocker_01", 1, "free.slot.1")), "free slot 1")
	_expect(bool(eco.collect(cancelled.job_id, "collect.now").ok), "escrow survives reload")
	_expect(bool(eco.collect(cancelled.job_id, "collect.now").get("duplicate", false)), "collection replay safe")
	_expect(_count("oak_wood") == 6 and _count("iron_scrap") == 2, "exact refund once")
	# 04 research specimen is separate from physical plan and knowledge.
	_begin("Core specimen sacrifice / permanent recipe / duplicate research")
	_earn_core_tech("case4")
	var core: Dictionary = eco.grant_instance("core_venom", "loot.core.1", 2, 30)
	_expect(bool(core.ok), "damaged finite Core owned")
	_expect(not bool(eco.known("craft_core_venom")), "owning Core does not learn recipe")
	var research: Dictionary = eco.research_recipe("craft_core_venom", "lab", "specimen", "research.core", core.instance_id)
	_expect(bool(research.ok), "specimen reserved for research")
	_expect(eco.owned_instances("core_venom").is_empty(), "specimen cannot also be cast")
	_finish_job(research.job_id, "lab")
	_expect(bool(eco.known("craft_core_venom")), "knowledge permanent in A0 map")
	_expect(int(eco.instance(core.instance_id).uses) == 2, "research does not consume cast charges")
	var spare_before := _count("knowledge_spares")
	_expect(not bool(eco.research_recipe("craft_core_venom", "lab", "targeted", "research.again").ok), "duplicate research refused without payment")
	_expect(_count("knowledge_spares") == spare_before, "no duplicate research cost")
	# 05 physical blueprint path.
	_begin("physical blueprint research")
	_earn_core_tech("case5")
	_give("plan_frost_core", 1)
	var bp: Dictionary = eco.research_recipe("craft_core_frost", "lab", "blueprint", "research.bp")
	_expect(bool(bp.ok) and _count("plan_frost_core") == 0, "blueprint consumed into escrow")
	_finish_job(bp.job_id, "lab")
	_expect(bool(eco.known("craft_core_frost")) and _count("core_frost") == 0, "knowledge is not a free Core")
	# 06 technology graph and targeted research.
	_begin("technology prerequisites")
	_station("lab", "research")
	_give("knowledge_spares", 20); _give("iron_scrap", 3); _give("iron_ingot", 2)
	_expect(not bool(eco.research_technology("tech_precision", "lab", "tech.out.of.order").ok), "prerequisite enforced")
	var t: Dictionary = eco.research_technology("tech_smelting", "lab", "tech.smelt")
	_finish_job(t.job_id, "lab")
	_expect(bool(eco.knows_technology("tech_smelting")), "technology learned")
	var t2: Dictionary = eco.research_technology("tech_precision", "lab", "tech.precision")
	_finish_job(t2.job_id, "lab")
	_expect(bool(eco.knows_technology("tech_precision")), "dependent technology learned")
	# 07 strict A4 attestation fixture: default blocked, negatives, atomic debit.
	_begin("A4 attestation / atomic finite-use debit (NATIVE FIXTURE ONLY)")
	var c: Dictionary = eco.grant_instance("core_venom", "loot.core.2", 2, 100)
	var cid: String = c.instance_id
	_expect(not bool(eco.commit_cast(cid, "cast.default.blocked", 0).ok), "production catalog Core remains blocked without A4 binding")
	_install_fixture_skill_gate()
	for mode in ["missing", "synthetic_ready", "unverified", "wrong_version", "wrong_original_id", "wrong_abstract_id", "wrong_source", "wrong_boundary", "wrong_context", "wrong_instance", "wrong_revision", "empty_token"]:
		attestation_mode = mode
		var bad: Dictionary = eco.commit_cast(cid, "cast.bad." + mode, 0, {"target": "enemy_1"})
		_expect(not bool(bad.ok), "attestation rejected: " + mode)
		_expect(int(eco.instance(cid).uses) == 2, "no charge debit for " + mode)
	attestation_mode = "valid"
	_expect(bool(eco.commit_cast(cid, "cast.one", 0, {"target": "enemy_1"}).ok), "verified fixture gate debits once")
	_expect(not bool(eco.commit_cast(cid, "cast.stale", 0, {"target": "enemy_1"}).ok), "stale revision refused")
	_expect(not bool(eco.commit_cast(cid, "cast.one", 0, {"target": "enemy_2"}).ok), "same cast id different context refused")
	_expect(bool(eco.commit_cast(cid, "cast.one", 0, {"target": "enemy_1"}).get("duplicate", false)), "cast replay does not debit")
	_expect(int(eco.instance(cid).uses) == 1, "exactly one charge consumed")
	_expect(bool(eco.commit_cast(cid, "cast.two", 1, {"target": "enemy_1"}).ok), "last charge")
	_expect(not bool(eco.commit_cast(cid, "cast.three", 2, {"target": "enemy_1"}).ok), "depleted Core refuses")
	# 08 repair never restores charges; reconstruction consumes shell + materials.
	_begin("repair / reconstruction conservation")
	_station("bench", "workbench", 2); _station("lab", "research")
	_give("iron_parts", 4); _give("binding_cloth", 4); _give("core_blank", 1); _give("venom_extract", 1); _give("knowledge_spares", 2)
	var shell: Dictionary = eco.grant_instance("core_venom", "fixture.shell", 0, 100)
	var shell_id: String = shell.instance_id
	var pick: Dictionary = eco.grant_instance("iron_pick", "fixture.pick", -1, 20)
	_expect(bool(eco.repair(pick.instance_id, "bench", "repair.pick").ok), "equipment repaired with materials")
	_expect(int(eco.instance(pick.instance_id).condition) == 100, "condition restored")
	_expect(not bool(eco.repair(shell_id, "bench", "repair.core").ok), "Core charge repair forbidden")
	_give("knowledge_spares", 30); _give("research_notes", 8); _give("soul_ember", 2); _give("crypt_bone_shard", 2); _give("iron_scrap", 3); _give("iron_ingot", 2)
	for tid in ["tech_smelting", "tech_precision", "tech_core_binding"]:
		var job: Dictionary = eco.research_technology(tid, "lab", "earn." + tid)
		_expect(bool(job.ok), "earn " + tid)
		_finish_job(job.job_id, "lab")
	var learn: Dictionary = eco.research_recipe("rebuild_core_venom", "lab", "targeted", "learn.rebuild")
	_expect(bool(learn.ok), "targeted reconstruction research")
	_finish_job(learn.job_id, "lab")
	var rebuild: Dictionary = eco.reconstruct_core("rebuild_core_venom", shell_id, "bench", "rebuild.job")
	_expect(bool(rebuild.ok), "reconstruction queued")
	_expect(eco.owned_instances("core_venom").is_empty(), "old shell reserved, not usable")
	_finish_job(rebuild.job_id, "bench")
	var fresh: Array[Dictionary] = eco.owned_instances("core_venom")
	_expect(fresh.size() == 1, "new Core identity, old shell consumed")
	if fresh.size() == 1:
		_expect(String(fresh[0].instance_id) != shell_id, "reconstruction creates a new token")
		_expect(int(fresh[0].uses) == 12, "reconstruction is manufacture, not free repair")
	# 09 lossy dismantling and full-inventory refusal.
	_begin("lossy recycling / no repair-recycle profit")
	_station("bench", "workbench")
	_give("iron_ingot", 1)
	var salvage_pick: Dictionary = eco.grant_instance("iron_pick", "fixture.salvage.pick", -1, 40)
	_expect(bool(eco.dismantle_stack("iron_ingot", 1, "bench", "salvage.ingot").ok), "ingot dismantled")
	_expect(_count("iron_ingot") == 0 and _count("iron_scrap") == 2, "3-scrap ingot returns only 2 scrap")
	var old_pick: String = salvage_pick.instance_id
	_expect(bool(eco.dismantle_instance(old_pick, "bench", "salvage.pick").ok), "unique equipment dismantled")
	_expect(eco.owned_instances("iron_pick").is_empty(), "unique token removed")
	_expect(not bool(eco.dismantle_instance(old_pick, "bench", "salvage.pick.again").ok), "cannot dismantle twice")
	# 10 legacy stack shapes and unknown economy namespace.
	_begin("legacy first/overflow stacks")
	_expect(bool(save.call(&"grant_inventory_item", "oak_wood", "material", 60, "legacy.overflow")), "60 legacy-compatible units")
	var stacks: Dictionary = save.call(&"get_inventory_stacks")
	_expect(stacks.has("oak_wood") and not stacks["oak_wood"].has("item_id"), "first stack key is item id")
	_expect(stacks.has("oak_wood_stack_2") and stacks["oak_wood_stack_2"].get("item_id") == "oak_wood", "overflow stack explicit id")
	_expect(_count("oak_wood") == 60, "adapter counts both canonical shapes")
	# 11 farming is seed-neutral and consumes compost; no rare catalyst generation.
	_begin("cultivation closed seed loop")
	_station("garden", "garden")
	_give("moonleaf_seed", 1); _give("compost", 1)
	var grow: Dictionary = eco.enqueue("grow_moonleaf", "garden", "grow.1")
	_finish_job(grow.job_id, "garden")
	_expect(_count("moonleaf_seed") == 1 and _count("moonleaf") == 3 and _count("compost") == 0, "seed returned once, compost consumed")
	_expect(_count("ancient_catalyst") == 0, "farm cannot create exploration catalyst")
	# 12 pause/interruption and no offline progress.
	_begin("station interruption / active ticks only")
	_station("furnace", "furnace")
	_give("oak_wood", 2)
	var paused: Dictionary = eco.enqueue("burn_charcoal", "furnace", "pause.job")
	stations["furnace"]["operational"] = false
	_expect(bool(_tick("furnace", 100, "pause.tick").ok), "disabled station receipt accepted without progress")
	_expect(String(eco.jobs()[paused.job_id].status) == "paused", "job paused without output")
	_reload()
	stations["furnace"]["operational"] = true
	_finish_job(paused.job_id, "furnace")
	_expect(_count("charcoal") == 2, "paused job resumes exactly once after reload")
	# 13 unique token quantity/kind corruption fails closed.
	_begin("unique token quantity/kind corruption")
	var qcore: Dictionary = eco.grant_instance("core_venom", "fixture.qty.core", 2, 100)
	var qid: String = qcore.instance_id
	var corrupt_qty := func(candidate: Dictionary) -> bool:
		candidate["inventory"]["item_stacks"][qid]["quantity"] = 2
		return true
	_expect(bool(save.call(&"transact_once", "corrupt.qty", corrupt_qty)), "fixture corrupts token quantity through SaveService")
	_expect(not bool(eco.ownership_audit().ok), "quantity=2 token audit fails")
	_expect(eco.owned_instances("core_venom").is_empty(), "quantity=2 token not reported owned")
	_expect(_count("core_venom") == 0, "quantity=2 token excluded from totals")
	_expect(not bool(eco.commit_cast(qid, "cast.qty", 0).ok), "cast refuses quantity=2 token")
	_expect(not bool(eco.repair(qid, "bench", "repair.qty").ok), "repair refuses quantity=2 token")
	_expect(not bool(eco.dismantle_instance(qid, "bench", "dismantle.qty").ok), "dismantle refuses quantity=2 token")
	_expect(not bool(eco.wear(qid, 1, "wear.qty").ok), "wear refuses quantity=2 token")
	_reload(false)
	_expect(not bool(eco.ownership_audit().ok), "quantity corruption persists after reload")
	var corrupt_kind := func(candidate: Dictionary) -> bool:
		candidate["inventory"]["item_stacks"][qid]["quantity"] = 1
		candidate["inventory"]["item_stacks"][qid]["kind"] = "material"
		return true
	_expect(bool(save.call(&"transact_once", "corrupt.kind", corrupt_kind)), "fixture corrupts token kind")
	_expect(not bool(eco.ownership_audit().ok), "wrong-kind token audit fails")
	_expect(not bool(eco.commit_cast(qid, "cast.kind", 0).ok), "cast refuses wrong-kind token")
	# 14 orphan record/token and generic SaveService drop blocker.
	_begin("orphan record/token / generic drop is A0 blocker")
	var ocore: Dictionary = eco.grant_instance("core_venom", "fixture.orphan.core", 2, 100)
	var oid: String = ocore.instance_id
	_expect(bool(save.call(&"drop_inventory_item", oid, 1, "generic.drop.token")), "generic SaveService drop currently succeeds (A0 must guard)")
	_expect(not bool(eco.ownership_audit().ok), "A3 detects orphan attribute record after generic drop")
	_expect(not bool(eco.commit_cast(oid, "cast.orphan", 0).ok), "cast refuses orphan record")
	_reload(false)
	_expect(not bool(eco.ownership_audit().ok), "orphan record persists after reload")
	_expect(bool(save.call(&"grant_inventory_item", "soh_i_999999999999_deadbeef", "key_item", 1, "generic.orphan.token")), "generic orphan token grant")
	_expect(not bool(eco.ownership_audit().ok), "A3 detects orphan physical token")
	_expect(eco.owned_instances().is_empty(), "orphan token not reported owned")
	# 15 generic transfer/merge blocker and recovery by reversing generic transfer.
	_begin("generic transfer/merge is A0 blocker")
	var tcore: Dictionary = eco.grant_instance("core_venom", "fixture.transfer.core", 2, 100)
	var tid: String = tcore.instance_id
	_expect(bool(save.call(&"home_transfer_to_storage", "item_stack", tid, "generic.transfer.out")), "generic home transfer currently succeeds (A0 must guard)")
	_expect(not bool(eco.ownership_audit().ok), "A3 detects unique token outside bag")
	_expect(not bool(eco.commit_cast(tid, "cast.transfer", 0).ok), "cast refuses transferred token")
	_expect(bool(save.call(&"home_transfer_to_bag", "item_stack", tid, "generic.transfer.back")), "generic transfer back restores physical token")
	_expect(bool(eco.ownership_audit().ok), "restored token passes audit")
	_expect(bool(eco.wear(tid, 1, "wear.restored").ok), "restored token usable again")
	var merge_token := func(candidate: Dictionary) -> bool:
		return bool(save.call(&"add_items_to_candidate", candidate, tid, "key_item", 1, {}))
	_expect(bool(save.call(&"transact_once", "generic.merge.token", merge_token)), "generic candidate merge currently succeeds (A0 must guard)")
	_expect(not bool(eco.ownership_audit().ok), "A3 detects merged quantity=2 token")
	_expect(not bool(eco.commit_cast(tid, "cast.merge", 1).ok), "cast refuses merged token")
	_reload(false)
	_expect(not bool(eco.ownership_audit().ok), "merged token persists after reload")
	_expect(bool(save.call(&"remove_items_from_candidate", _snapshot(), tid, 1)), "fixture candidate removal sanity")
	var merge_undo := func(candidate: Dictionary) -> bool:
		return bool(save.call(&"remove_items_from_candidate", candidate, tid, 1))
	_expect(bool(save.call(&"transact_once", "generic.merge.undo", merge_undo)), "fixture removes one merged copy")
	_expect(bool(eco.ownership_audit().ok), "quantity restored to one by fixture, not by A3 normalization")
	# 16 escrowed specimen cannot be duplicated by generic grant.
	_begin("escrow token duplication fails closed")
	_earn_core_tech("case16")
	var ecore: Dictionary = eco.grant_instance("core_venom", "fixture.escrow.core", 2, 100)
	var eid: String = ecore.instance_id
	var eres: Dictionary = eco.research_recipe("craft_core_venom", "lab", "specimen", "escrow.research", eid)
	_expect(bool(eres.ok), "specimen escrowed")
	_expect(bool(save.call(&"grant_inventory_item", eid, "key_item", 1, "generic.duplicate.escrow")), "generic duplicate escrow token grant")
	_expect(not bool(eco.ownership_audit().ok), "A3 detects escrow record with physical token")
	_expect(not bool(eco.collect(eres.job_id, "collect.escrow.bad").ok), "A3 refuses operation while escrow duplicated")
	_expect(bool(save.call(&"consume_inventory_item", eid, 1, "generic.duplicate.escrow.undo")), "fixture removes duplicate token")
	_expect(bool(eco.ownership_audit().ok), "escrow invariant restored")
	_expect(bool(eco.cancel(eres.job_id, "cancel.escrow").ok), "escrowed specimen cancellable")
	_expect(bool(eco.collect(eres.job_id, "collect.escrow.refund").ok), "specimen refund collected once")
	_expect(eco.owned_instances("core_venom").size() == 1, "exactly one specimen returned")
	# 17 authoritative active-tick host negatives.
	_begin("trusted time host / no caller ticks / no free progress")
	_station("furnace", "furnace")
	_give("oak_wood", 2)
	var tj: Dictionary = eco.enqueue("burn_charcoal", "furnace", "time.job")
	_expect(bool(tj.ok), "time job queued")
	_expect(not bool(eco.advance("furnace", 600, "old.int.api").ok), "old caller-supplied integer ticks rejected")
	var forged: Dictionary = _host_time("furnace")
	forged["ticks"] = 600
	_expect(not bool(eco.advance("furnace", forged, "forged.ticks").ok), "extra ticks field rejected")
	forged = _host_time("furnace")
	forged["active_ticks"] = 9999
	_expect(not bool(eco.advance("furnace", forged, "forged.clock").ok), "forged active_ticks rejected against host")
	eco.configure_time_host(Callable())
	_expect(not bool(eco.advance("furnace", _host_time("furnace"), "no.host").ok), "missing time host fails closed")
	eco.configure_time_host(_host_time)
	var no_elapsed: Dictionary = eco.advance("furnace", _host_time("furnace"), "no.elapsed")
	_expect(not bool(no_elapsed.ok) and String(no_elapsed.reason) == "no_elapsed_time", "new event id with no elapsed clock rejected")
	_expect(bool(_tick("furnace", 4, "time.partial").ok), "trusted partial tick accepted")
	var receipt: Dictionary = _host_time("furnace")
	_expect(bool(eco.advance("furnace", receipt, "time.partial").get("duplicate", false)), "duplicate tick event idempotent")
	_expect(not bool(eco.advance("furnace", receipt, "time.partial.new").ok), "same clock new event id rejected")
	_expect(not bool(_tick("furnace", 601, "time.quantum").ok), "oversized tick quantum rejected")
	# Re-synchronize the fixture host to the last committed baseline. Rejected
	# transactions must not leave the fixture clock ahead of the save.
	var persisted_time: Dictionary = eco.document().get("time", {})
	var persisted_station: Dictionary = (persisted_time.get("stations", {}) as Dictionary).get("furnace", {})
	clock_station_ticks["furnace"] = int(persisted_station.get("active_ticks", 0))
	clock_sequence = int(persisted_time.get("sequence", 0))
	clock_sequence -= 1
	_expect(not bool(eco.advance("furnace", _host_time("furnace"), "time.stale.sequence").ok), "regressed host sequence rejected")
	clock_sequence += 1
	clock_session_id = "conflicting-session"
	_expect(not bool(eco.advance("furnace", _host_time("furnace"), "time.session.conflict").ok), "same session index different id rejected")
	clock_session_id = "fixture-session-1"
	_finish_job(tj.job_id, "furnace")
	_expect(_count("charcoal") == 2, "trusted time eventually completes job")
	_give("oak_wood", 2)
	var rj: Dictionary = eco.enqueue("burn_charcoal", "furnace", "reload.time.job")
	_reload()
	var first_after_reload: Dictionary = _tick("furnace", 600, "reload.time.first")
	_expect(bool(first_after_reload.ok) and int(first_after_reload.get("applied_ticks", -1)) == 0, "new session establishes baseline without offline catch-up")
	_expect(String(eco.jobs()[rj.job_id].status) != "ready", "no instant finish after reload")
	_finish_job(rj.job_id, "furnace")
	_expect(_count("charcoal") == 4, "post-reload active time only")
	# 18 station removal, power, revision, mixed kinds, queue fairness, cancel/resume.
	_begin("station lifecycle / queue fairness / escrow recovery")
	_station("multi", "furnace")
	_give("oak_wood", 8); _give("iron_scrap", 3); _give("charcoal", 2)
	var s1: Dictionary = eco.enqueue("burn_charcoal", "multi", "station.job.1")
	_expect(bool(_tick("multi", 4, "station.partial").ok), "station partial progress")
	stations["multi"]["operational"] = false
	_expect(bool(_tick("multi", 100, "station.off").ok), "power-off receipt accepted")
	_expect(String(eco.jobs()[s1.job_id].status) == "paused", "power-off pauses job")
	_expect(int(eco.jobs()[s1.job_id].elapsed) == 4, "disabled time not accrued")
	stations["multi"]["operational"] = true
	_expect(bool(_tick("multi", 1, "station.on").ok), "power-on receipt accepted")
	_expect(int(eco.jobs()[s1.job_id].elapsed) == 5, "only new active tick accrued")
	stations.erase("multi")
	_expect(bool(_tick("multi", 100, "station.removed").ok), "removed station receipt accepted without progress")
	_expect(String(eco.jobs()[s1.job_id].status) == "paused", "removed station pauses job")
	_expect(bool(eco.cancel(s1.job_id, "station.cancel.removed").ok), "removed station job cancellable")
	_expect(bool(eco.collect(s1.job_id, "station.collect.removed").ok), "removed station escrow recoverable")
	_expect(_count("oak_wood") == 8, "removed station refund exact")
	_station("multi", "furnace")
	var s2: Dictionary = eco.enqueue("burn_charcoal", "multi", "station.job.2")
	_expect(bool(_tick("multi", 4, "station.rev.partial").ok), "revision job partial")
	stations["multi"]["station_revision"] = "rev-2"
	clock_revisions["multi"] = "rev-2"
	_expect(bool(_tick("multi", 10, "station.rev.changed").ok), "station revision change accepted")
	_expect(String(eco.jobs()[s2.job_id].status) == "paused", "revision change pauses old job")
	_expect(bool(_tick("multi", 600, "station.rev.resume").ok), "revision baseline resumes")
	_expect(bool(eco.collect(s2.job_id, "station.rev.collect").ok), "revision job collectible")
	stations["multi"]["kind"] = "workbench"
	var s3: Dictionary = eco.enqueue("burn_charcoal", "multi", "station.kind.mismatch")
	_expect(not bool(s3.ok), "wrong station kind cannot enqueue furnace recipe")
	stations["multi"]["kind"] = "furnace"
	stations["multi"]["queue_capacity"] = 1
	var q1: Dictionary = eco.enqueue("burn_charcoal", "multi", "queue.1")
	_expect(bool(q1.ok), "first queue slot used")
	_expect(not bool(eco.enqueue("burn_charcoal", "multi", "queue.2").ok), "queue capacity enforced")
	stations["multi"]["queue_capacity"] = 3
	var q2: Dictionary = eco.enqueue("burn_charcoal", "multi", "queue.2")
	_expect(bool(q2.ok), "second queue slot used")
	_expect(bool(_tick("multi", 10, "queue.fairness").ok), "bounded queue tick accepted")
	_expect(String(eco.jobs()[q1.job_id].status) == "ready", "first job finishes before second")
	_expect(int(eco.jobs()[q2.job_id].elapsed) > 0, "remaining time advances second job fairly")
	_finish_job(q1.job_id, "multi")
	_finish_job(q2.job_id, "multi")
	# 19 unique output quantity and malformed/legacy namespace migration.
	_begin("instance output qty=1 / malformed legacy state")
	var original_outputs: Dictionary = eco.catalog["recipes"]["craft_core_venom"]["outputs"].duplicate(true)
	eco.catalog["recipes"]["craft_core_venom"]["outputs"]["core_venom"] = 2
	_expect(not bool(eco.enqueue("craft_core_venom", "hand", "output.qty.two").ok), "instance output quantity=2 rejected")
	eco.catalog["recipes"]["craft_core_venom"]["outputs"] = original_outputs
	var corrupt_schema := func(candidate: Dictionary) -> bool:
		candidate["survival_economy"] = {"schema": 99}
		return true
	_expect(bool(save.call(&"transact_once", "corrupt.schema", corrupt_schema)), "fixture writes unsupported economy schema")
	_expect(eco.document().is_empty(), "unsupported schema document fails closed")
	_expect(not bool(eco.grant_instance("iron_pick", "bad.schema.grant").ok), "mutations refuse unsupported schema")
	_reload(false)
	_expect(not bool(eco.grant_instance("iron_pick", "bad.schema.reload").ok), "unsupported schema persists after reload")
	var legacy_v1 := func(candidate: Dictionary) -> bool:
		candidate["survival_economy"] = {"schema": 1, "instances": {}, "jobs": {}, "technologies": {}, "commands": {}, "counter": 0}
		return true
	_expect(bool(save.call(&"transact_once", "legacy.v1", legacy_v1)), "fixture writes valid v1 legacy namespace")
	_reload(false)
	var migrated: Dictionary = eco.grant_instance("iron_pick", "legacy.v1.grant")
	_expect(bool(migrated.ok), "valid v1 namespace migrates on successful mutation")
	_expect(int(eco.document().get("schema", 0)) == 2, "namespace migrated to schema 2")
	_expect(eco.document().has("time"), "migration adds bounded time namespace")
	var corrupt_instance := func(candidate: Dictionary) -> bool:
		candidate["survival_economy"]["instances"][migrated.instance_id] = {"instance_id": migrated.instance_id}
		return true
	_expect(bool(save.call(&"transact_once", "corrupt.instance", corrupt_instance)), "fixture writes malformed instance record")
	_expect(not bool(eco.wear(migrated.instance_id, 1, "wear.malformed").ok), "malformed instance record fails closed")
	# 20 save-growth compaction: no new commands map, collected jobs erased.
	_begin("save growth compaction / native micro-measure")
	var gpick: Dictionary = eco.grant_instance("iron_pick", "growth.pick", -1, 100)
	var growth_before := JSON.stringify(_snapshot()).length()
	var receipts_before := (_snapshot().get("applied_transactions", {}) as Dictionary).size()
	for i in range(30):
		_expect(bool(eco.wear(gpick.instance_id, 1, "growth.wear.%d" % i).ok), "growth wear %d" % i)
	var growth_after := JSON.stringify(_snapshot()).length()
	var receipts_after := (_snapshot().get("applied_transactions", {}) as Dictionary).size()
	_expect((eco.document().get("commands", {}) as Dictionary).is_empty(), "new operations do not grow duplicate commands map")
	_expect(receipts_after - receipts_before == 30, "one SaveService receipt per transaction")
	_expect(growth_after > growth_before, "save growth measurable")
	print("A3_NATIVE_SAVE_GROWTH bytes_before=%d bytes_after=%d delta=%d transactions=30" % [growth_before, growth_after, growth_after - growth_before])
	_station("bench", "workbench")
	_give("oak_wood", 6); _give("iron_scrap", 2)
	var gjob: Dictionary = eco.enqueue("workbench_kit", "bench", "growth.job")
	_finish_job(gjob.job_id, "bench")
	_expect(not eco.jobs().has(gjob.job_id), "collected job escrow compacted out of namespace")
	_case_21_canonical_world_sources()
	_case_22_world_atomicity_and_failed_save()
	_case_23_source_to_research_to_output_chain()
	_case_24_world_adversarial_clock_identity_and_conservation()
	_case_25_quarry_fail_closed_and_hidden_projection()
	_case_26_one_time_crates_and_basic_tool_research_policy()
	# End-to-end report.
	if failures.is_empty():
		print("A3 ECONOMY ADAPTER PASSED - %d checks / %d cases" % [checks, case_id])
		quit(0)
	else:
		print("A3 ECONOMY ADAPTER FAILED - %d/%d" % [failures.size(), checks])
		for f in failures: print("  - " + f)
		quit(1)

# ---------------------------------------------------------------------------
# V3 world-source fixtures. The host receipt below is a NATIVE FIXTURE for the
# A0-owned authoritative world/active-session clock, discovery and stand cell.
# It is not a production mount and not a UI authorization flag.
# ---------------------------------------------------------------------------
func _world_host(poi_id: String) -> Dictionary:
	return {"contract": WORLD_CONTRACT, "poi_id": poi_id, "discovered": world_discovered,
		"hero_cell": world_cell, "active_seconds": world_active_seconds,
		"session_id": world_session_id, "session_index": world_session_index,
		"sequence": world_sequence, "world_revision": world_revision}

func _world_tick(seconds: int, event_id: String) -> Dictionary:
	world_active_seconds += seconds
	world_sequence += 1
	world_revision += 1
	return eco.advance_world_time(world_poi, event_id)

func _world_act(action_id: String, instance_id: String, event_id: String) -> Dictionary:
	var request := {"poi_id": world_poi, "action_id": action_id}
	if not instance_id.is_empty():
		request["instance_id"] = instance_id
	return eco.world_action(request, event_id)

func _move(poi_id: String, cell: Vector2i) -> void:
	world_poi = poi_id
	world_cell = cell

func _craft(recipe_id: String, station_id: String, event_id: String) -> void:
	var job: Dictionary = eco.enqueue(recipe_id, station_id, event_id)
	_expect(bool(job.get("ok", false)), "enqueue " + recipe_id + ": " + String(job.get("reason", "")))
	if bool(job.get("ok", false)):
		_finish_job(String(job.job_id), station_id)

func _begin_live(label: String) -> void:
	case_id += 1
	print("[case %02d] %s" % [case_id, label])
	var root_save := get_root().get_node_or_null("SaveService")
	if root_save == null:
		root_save = SaveService.new()
		root_save.name = "SaveService"
		get_root().add_child(root_save)
	save = root_save
	path = "user://tests/a3_live_%d_%d.json" % [Time.get_ticks_usec(), case_id]
	_expect(bool(save.call(&"configure_storage", path, true)), "live authoritative save")
	survival = get_root().get_node_or_null("SurvivalService")
	if survival == null:
		survival = Survival.new()
		survival.name = "SurvivalService"
		get_root().add_child(survival)
	_expect(bool(survival.call(&"load_catalog")), "live survival catalog")
	stations = {}
	clock_session_index = 1
	clock_session_id = "fixture-session-1"
	clock_sequence = 0
	clock_station_ticks = {}
	clock_revisions = {"hand": "hand"}
	world_session_index = 1
	world_session_id = "fixture-world-1"
	world_sequence = 0
	world_active_seconds = 0
	world_poi = "poi_crown_waystation"
	world_cell = Vector2i(408, 199)
	world_discovered = true
	world_revision = 1
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "live catalog + SaveService adapter")
	eco.configure_time_host(_host_time)
	eco.configure_world_host(_world_host)

func _harvest(node_id: String, kind: String, hits: int, stamp: int) -> void:
	for i in range(hits):
		var result: Dictionary = survival.call(&"harvest", node_id, kind, stamp + i)
		_expect(bool(result.get("ok", false)), "live harvest %s %d: %s" % [node_id, i, String(result.get("reason", ""))])

func _case_21_canonical_world_sources() -> void:
	_begin("canonical A1 locker / ledger / cache / deadfall / relay")
	var before := _count("iron_scrap")
	_move("poi_crown_waystation", Vector2i(408, 199))
	var locker: Dictionary = _world_act("pry_locker", "", "w21.locker")
	_expect(bool(locker.ok) and String(locker.result) == "SUCCESS", "locker succeeds")
	_expect((locker.granted_items as Dictionary).is_empty(), "locker grants ZERO physical items")
	_expect((locker.granted_capabilities as Array).has("cap_salvage"), "locker grants cap_salvage")
	_expect(_count("iron_scrap") == before and _count("knowledge_spares") == 0, "locker does not mint materials")
	_expect(eco.has_capability("cap_salvage"), "capability projection")
	var locker_dup: Dictionary = _world_act("pry_locker", "", "w21.locker")
	_expect(bool(locker_dup.ok) and String(locker_dup.result) == "ALREADY_APPLIED", "same-event locker replay is idempotent")
	var locker_new_event: Dictionary = _world_act("pry_locker", "", "w21.locker.again")
	_expect(bool(locker_new_event.ok) and String(locker_new_event.result) == "ALREADY_APPLIED", "one-time locker cannot be re-granted")
	_move("poi_crown_waystation", Vector2i(410, 202))
	var ledger: Dictionary = _world_act("seal_ledger", "", "w21.ledger")
	_expect(bool(ledger.ok) and (ledger.granted_items as Dictionary).is_empty(), "ledger grants capability only")
	_expect(eco.has_capability("cap_seal_1"), "ledger grants cap_seal_1")
	# Relay before timber: real material cost, no partial consumption.
	_move("poi_crown_relay_shed", Vector2i(442, 234))
	var scrap_before_relay := _count("iron_scrap")
	var relay_missing: Dictionary = _world_act("hand_crank_bypass", "", "w21.relay.missing")
	_expect(not bool(relay_missing.ok) and String(relay_missing.reason) == "MISSING_ITEM:oak_wood", "relay rejects missing timber")
	_expect(_count("iron_scrap") == scrap_before_relay and not eco.has_capability("cap_power_1"), "missing-cost relay is atomic")
	# Outside renewable cache owns the canonical materials.
	_move("poi_crown_waystation", Vector2i(406, 202))
	var cache1: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w21.cache.1")
	_expect(bool(cache1.ok) and String(cache1.result) == "SUCCESS", "cache claim 1 by canonical si:* world instance")
	_expect(int((cache1.granted_items as Dictionary).get("iron_scrap", 0)) == 3, "cache grants canonical 3 scrap")
	_expect(int((cache1.granted_items as Dictionary).get("knowledge_spares", 0)) == 2, "cache grants canonical 2 spares")
	_expect(String(cache1.transaction_key) == "a1slice:poi_crown_waystation:cache_restock:1", "canonical A1 transaction key")
	var projection: Dictionary = eco.world_projection("poi_crown_waystation")
	var cache_projection: Dictionary = {}
	for raw: Variant in projection.get("sources", []):
		if String((raw as Dictionary).instance_id) == "si:r_ashen_crown:waystation_cache:01":
			cache_projection = raw
	_expect(int(cache_projection.get("claim_count", 0)) == 1 and not bool(cache_projection.get("ready", true)), "cache cooldown projected read-only")
	_expect(String(cache_projection.get("interaction_node_id", "")) == "node_waystation_cache", "projection exposes pinned node alias")
	var alias_early: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.alias")
	_expect(not bool(alias_early.ok) and String(alias_early.reason) == "COOLDOWN", "node_* alias resolves to the same physical cache, not a second source")
	var early: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w21.cache.early")
	_expect(not bool(early.ok) and String(early.reason) == "COOLDOWN", "cache rejects before active-time cooldown")
	_world_tick(1799, "w21.time.1799")
	var still: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.still")
	_expect(not bool(still.ok) and int(still.get("remaining_active_seconds", 0)) == 1, "cooldown uses cumulative ACTIVE seconds")
	_world_tick(1, "w21.time.1")
	var cache2: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.2")
	_expect(bool(cache2.ok) and String(cache2.transaction_key) == "a1slice:poi_crown_waystation:cache_restock:2", "cache generation 2 after 1800 active seconds via node alias")
	var replay_after_generation: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w21.cache.1")
	_expect(bool(replay_after_generation.ok) and String(replay_after_generation.result) == "ALREADY_APPLIED", "same event_id replay stays idempotent after generation advances")
	_expect(String(replay_after_generation.transaction_key) == "a1slice:poi_crown_waystation:cache_restock:1", "replay returns the original canonical key, not the current generation")
	# Offline / new session must not credit wall-clock time.
	world_session_index += 1
	world_session_id = "fixture-world-2"
	world_active_seconds = 0
	world_sequence = 0
	_world_tick(0, "w21.newsession")
	var offline: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.offline")
	_expect(not bool(offline.ok) and String(offline.reason) == "COOLDOWN", "new session does not skip cooldown")
	_world_tick(1800, "w21.time.session2")
	var cache3: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.3")
	_expect(bool(cache3.ok), "cooldown persists across sessions and completes with active time")
	# Approach deadfall is a separate physical source instance.
	_move("poi_crown_waystation", Vector2i(398, 201))
	var deadfall: Dictionary = _world_act("gather_deadfall", "node_waystation_approach_deadfall", "w21.deadfall")
	_expect(bool(deadfall.ok) and int((deadfall.granted_items as Dictionary).get("oak_wood", 0)) == 2, "deadfall grants 2 oak")
	var wrong_instance: Dictionary = _world_act("cache_restock", "node_waystation_approach_deadfall", "w21.wrong")
	_expect(not bool(wrong_instance.ok), "source identity is class+region+poi+instance, not action name alone")
	# Relay now spends real materials for permanent power capability.
	_move("poi_crown_relay_shed", Vector2i(442, 234))
	var scrap_before := _count("iron_scrap")
	var oak_before := _count("oak_wood")
	var relay: Dictionary = _world_act("hand_crank_bypass", "", "w21.relay")
	_expect(bool(relay.ok) and eco.has_capability("cap_power_1"), "relay grants cap_power_1")
	_expect(_count("iron_scrap") == scrap_before - 2 and _count("oak_wood") == oak_before - 1, "relay consumes 2 scrap + 1 oak")
	var relay_state: Dictionary = eco.world_projection("poi_crown_relay_shed").get("state", {})
	_expect(bool(relay_state.get("bus_powered", false)) and bool(relay_state.get("bypass_installed", false)), "relay writes A1 site state")
	# Reload preserves capabilities, receipts, cooldowns and site state.
	_reload()
	_expect(eco.has_capability("cap_salvage") and eco.has_capability("cap_seal_1") and eco.has_capability("cap_power_1"), "capabilities survive reload")
	_move("poi_crown_waystation", Vector2i(406, 202))
	var after_reload: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w21.cache.3")
	_expect(bool(after_reload.ok) and String(after_reload.result) == "ALREADY_APPLIED", "canonical receipt survives reload")

func _case_22_world_atomicity_and_failed_save() -> void:
	_begin("world claim capacity / failed-save atomicity")
	_move("poi_crown_waystation", Vector2i(408, 199))
	_expect(bool(_world_act("pry_locker", "", "w22.locker").ok), "locker capability before capacity test")
	# Fill every authoritative bag slot with a full stack. This is fixture setup
	# through SaveService, not an A3 inventory implementation.
	var fill := func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		var stacks := {}
		for i in range(30):
			stacks["a3_fill_%02d" % i] = {"item_id": "oak_wood", "kind": "material", "quantity": 999,
				"metadata": {"source": "native_fixture_capacity"}}
		inventory["item_stacks"] = stacks
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "w22.fill", fill)), "fixture fills bag capacity")
	_move("poi_crown_waystation", Vector2i(406, 202))
	var full_before := JSON.stringify(_snapshot())
	var full: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w22.full")
	_expect(not bool(full.ok) and String(full.reason) == "inventory_full", "full bag rejects whole claim")
	_expect(JSON.stringify(_snapshot()) == full_before, "capacity failure changes no inventory, cooldown or receipt")
	var clear := func(candidate: Dictionary) -> bool:
		var inventory: Dictionary = candidate.get("inventory", {}).duplicate(true)
		inventory["item_stacks"] = {}
		candidate["inventory"] = inventory
		return true
	_expect(bool(save.call(&"transact_once", "w22.clear", clear)), "fixture clears bag")
	# Real I/O failure: a directory at the SaveService .tmp path makes the
	# authoritative write fail. No A0 test-only interruption hook is required.
	var tmp_abs := ProjectSettings.globalize_path(path + ".tmp")
	_expect(DirAccess.make_dir_recursive_absolute(tmp_abs) == OK, "fixture creates .tmp write obstruction")
	var fail_before := JSON.stringify(_snapshot())
	var failed: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w22.failedsave")
	_expect(not bool(failed.ok) and String(failed.reason) == "save_failed", "failed authoritative save rejects claim")
	_expect(JSON.stringify(_snapshot()) == fail_before, "failed save leaves inventory/world/receipt unchanged")
	DirAccess.remove_absolute(tmp_abs)
	var retry: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w22.retry")
	_expect(bool(retry.ok) and int((retry.granted_items as Dictionary).get("iron_scrap", 0)) == 3, "retry after I/O repair grants exactly once")
	var retry_dup: Dictionary = _world_act("cache_restock", "node_waystation_cache", "w22.retry")
	_expect(bool(retry_dup.ok) and String(retry_dup.result) == "ALREADY_APPLIED", "retry receipt is idempotent")

func _case_23_source_to_research_to_output_chain() -> void:
	_begin_live("no-Core multi-source -> paid stations -> basic-tool research -> iron_pick -> reload")
	# Native fixture, NOT a player journey: _move/_world_tick/_harvest are direct
	# fixture seams. It proves the A3 transaction chain can be funded without a
	# Core, without 7 forced cache claims, and without inventing iron_ore from an
	# A0 iron_vein (that live node yields iron_scrap). Physical pacing is modeled
	# separately in progression_v5.py and still requires A0 mount + human review.
	_move("poi_crown_waystation", Vector2i(408, 199))
	_expect(bool(_world_act("pry_locker", "", "w23.locker").ok), "chain locker")
	_move("poi_crown_waystation", Vector2i(410, 202))
	_expect(bool(_world_act("seal_ledger", "", "w23.ledger").ok), "chain ledger")
	# Renewable notes crate 01 keeps its exact 1 note / 1800 active-second rate.
	_move("poi_crown_waystation", Vector2i(395, 220))
	var note1: Dictionary = _world_act("salvage_roadside_notes", "si:r_ashen_crown:roadside_supply:01", "w23.notes.0")
	_expect(bool(note1.ok) and int((note1.granted_items as Dictionary).get("research_notes", 0)) == 1, "roadside crate 01 grants 1 research note")
	# One-time A1 crates 02/03 provide an early, non-renewable alternative route.
	_move("poi_crown_waystation", Vector2i(400, 217))
	var crate02: Dictionary = _world_act("salvage_roadside_supplies_02", "si:r_ashen_crown:roadside_supply:02", "w23.crate02")
	_expect(bool(crate02.ok) and int((crate02.granted_items as Dictionary).get("iron_scrap", 0)) == 3 and int((crate02.granted_items as Dictionary).get("knowledge_spares", 0)) == 2, "one-time crate 02 grants 3 scrap + 2 spares")
	_move("poi_crown_waystation", Vector2i(402, 221))
	var crate03: Dictionary = _world_act("salvage_roadside_timber_03", "si:r_ashen_crown:roadside_supply:03", "w23.crate03")
	_expect(bool(crate03.ok) and int((crate03.granted_items as Dictionary).get("oak_wood", 0)) == 2 and int((crate03.granted_items as Dictionary).get("research_notes", 0)) == 1, "one-time crate 03 grants 2 oak + 1 note")
	# Four canonical cache claims (three 1800s active waits) replace seven claims.
	_move("poi_crown_waystation", Vector2i(406, 202))
	for i in range(4):
		if i > 0:
			_world_tick(1800, "w23.cache.wait.%d" % i)
		var claim: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w23.cache.%d" % i)
		_expect(bool(claim.ok), "chain cache claim %d" % i)
	_expect(_count("iron_scrap") == 15 and _count("knowledge_spares") == 10, "crate02 + 4 cache claims = 15 scrap / 10 spares")
	_expect(_count("research_notes") == 2, "crate01 + crate03 = 2 real notes, no legacy ember")
	_expect(_count("soul_ember") == 0 and _count("crypt_bone_shard") == 0, "no legacy catalyst grant in the no-Core chain")
	_move("poi_crown_waystation", Vector2i(398, 201))
	_expect(bool(_world_act("gather_deadfall", "node_waystation_approach_deadfall", "w23.deadfall").ok), "chain deadfall")
	# Live A0 SurvivalService nodes supply bulk oak/stone/reed/scrap. iron_vein and
	# scrap_pile both yield iron_scrap in the pinned catalog; neither yields ore.
	var stamp := 1700000000
	_harvest("a3_oak_1", "oak_tree", 3, stamp); _harvest("a3_oak_2", "oak_tree", 3, stamp + 10); _harvest("a3_oak_3", "oak_tree", 3, stamp + 20)
	_harvest("a3_stone_1", "stone_outcrop", 3, stamp + 30); _harvest("a3_stone_2", "stone_outcrop", 3, stamp + 40)
	_harvest("a3_reed_1", "reed_clump", 2, stamp + 50); _harvest("a3_reed_2", "reed_clump", 2, stamp + 60)
	_harvest("a3_iron_0", "iron_vein", 2, stamp + 70); _harvest("a3_iron_1", "iron_vein", 2, stamp + 80)
	_harvest("a3_scrap_0", "scrap_pile", 2, stamp + 90); _harvest("a3_scrap_1", "scrap_pile", 2, stamp + 100)
	_expect(_count("iron_scrap") == 23 and _count("oak_wood") == 22 and _count("stone_chunk") == 12 and _count("reed_fibre") == 4, "live node totals are scrap, not invented ore")
	# Physical home storage round trip through the real SaveService API.
	var oak_before_storage := _count("oak_wood")
	_expect(bool(save.call(&"home_transfer_to_storage", &"item_stack", "oak_wood", "w23.store.oak")), "store oak in home storage")
	_expect(_count("oak_wood") == 0, "oak physically leaves bag")
	_expect(bool(save.call(&"home_transfer_to_bag", &"item_stack", "oak_wood", "w23.withdraw.oak")), "withdraw oak from home storage")
	_expect(_count("oak_wood") == oak_before_storage, "storage round trip conserves oak")
	# Relay is a real material sink, not a free capability.
	_move("poi_crown_relay_shed", Vector2i(442, 234))
	_expect(bool(_world_act("hand_crank_bypass", "", "w23.relay").ok), "chain relay consumes 2 scrap + 1 oak")
	# Paid hand/workbench/furnace/research chain. Scrap smelting is the bootstrap;
	# no tech_smelting or iron_ore is required for the basic iron_pick.
	_craft("workbench_kit", "hand", "w23.workbench_kit")
	_station("bench", "workbench")
	_craft("furnace_kit", "hand", "w23.furnace_kit")
	_station("furnace", "furnace")
	for i in range(2):
		_craft("burn_charcoal", "furnace", "w23.charcoal.%d" % i)
	for i in range(4):
		_craft("smelt_iron", "furnace", "w23.ingot.%d" % i)
	_expect(_count("iron_ingot") == 4 and _count("charcoal") == 0, "scrap + charcoal bootstrap 4 ingots without a Core")
	_craft("research_kit", "bench", "w23.research_kit")
	_station("lab", "research")
	_craft("weave_cloth", "bench", "w23.cloth")
	# Basic-tool targeted research uses the explicit A3 recipe override (3 spares
	# + 1 note). Advanced targeted research still defaults to 6 spares + 2 notes.
	var research: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "w23.research.pick")
	_expect(bool(research.ok), "basic-tool targeted research enqueued: " + String(research.get("reason", "")))
	if bool(research.ok):
		_finish_job(String(research.job_id), "lab")
	_expect(eco.known("iron_pick"), "iron_pick recipe permanently learned")
	var repeat: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "w23.research.pick.again")
	_expect(not bool(repeat.ok) and String(repeat.reason) == "already_known", "learned knowledge is not consumed/repeated")
	_craft("iron_pick", "bench", "w23.craft.pick")
	var picks := 0
	for raw: Variant in (eco.document().get("instances", {}) as Dictionary).values():
		if String((raw as Dictionary).get("item_id", "")) == "iron_pick":
			picks += 1
	_expect(picks == 1, "one physical iron_pick output")
	_expect(_count("iron_scrap") == 4 and _count("knowledge_spares") == 4 and _count("research_notes") == 1 and _count("oak_wood") == 5 and _count("stone_chunk") == 4 and _count("reed_fibre") == 1 and _count("binding_cloth") == 1 and _count("iron_ingot") == 0, "exact leftover inventory after paid chain")
	_expect(_count("core_ember") == 0 and _count("core_frost") == 0 and _count("core_venom") == 0, "no Skill Core was required or granted")
	var learned_before := eco.known("iron_pick")
	var world_before: Dictionary = eco.world_document()
	_reload()
	_expect(eco.known("iron_pick") == learned_before, "recipe knowledge survives reload")
	_expect(eco.has_capability("cap_power_1") and bool((eco.world_document().get("pois", {}) as Dictionary).has("poi_crown_relay_shed")), "world capabilities/state survive reload")
	var picks_after := 0
	for raw: Variant in (eco.document().get("instances", {}) as Dictionary).values():
		if String((raw as Dictionary).get("item_id", "")) == "iron_pick":
			picks_after += 1
	_expect(picks_after == 1, "physical output survives reload without duplication")
	_expect(int((world_before.get("clock", {}) as Dictionary).get("active_seconds", -1)) == int((eco.world_document().get("clock", {}) as Dictionary).get("active_seconds", -2)), "cumulative active world clock survives reload")

func _case_24_world_adversarial_clock_identity_and_conservation() -> void:
	_begin("adversarial world clock / session / identity / conservation")
	# Pure host validators accept native Vector2i and JSON integer cells, but
	# reject float/bool/string spoofing that could round into a stand cell.
	_expect(WorldSources.is_cell(Vector2i(408, 199)), "Vector2i host cell accepted")
	_expect(WorldSources.is_cell([408, 199]), "integer array host cell accepted")
	_expect(not WorldSources.is_cell([408.0, 199.0]), "float cell rejected")
	_expect(not WorldSources.is_cell([true, 199]), "bool cell rejected")
	_expect(not WorldSources.is_cell("408,199"), "string cell rejected")
	_expect(WorldSources.cell_matches(Vector2i(406, 202), [[406, 202]]), "Vector2i matches authored stand")
	_expect(not WorldSources.cell_matches(Vector2i(406, 203), [[406, 202]]), "adjacent cell is out of range")
	_move("poi_crown_waystation", Vector2i(408, 199))
	_expect(bool(_world_act("pry_locker", "", "w24.locker").ok), "locker before adversarial cache")
	_move("poi_crown_waystation", Vector2i(406, 202))
	var first: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w24.cache.1")
	_expect(bool(first.ok), "first cache claim")
	var before := JSON.stringify(_snapshot())
	# Caller cannot inject UI authorization flags or rewards.
	var spoof_request := eco.world_action({"poi_id": "poi_crown_waystation", "action_id": "cache_restock",
		"instance_id": "si:r_ashen_crown:waystation_cache:01", "ready": true, "rewards": {"core_ember": 1}}, "w24.ui.spoof")
	_expect(not bool(spoof_request.ok) and String(spoof_request.reason).begins_with("invalid_world_request_field"), "UI flags/rewards cannot authorize a claim")
	_expect(JSON.stringify(_snapshot()) == before, "UI spoof changes no state")
	# Same event id with a different physical request is a conflict, not a replay.
	var conflict: Dictionary = _world_act("cache_restock", "node_waystation_approach_deadfall", "w24.cache.1")
	_expect(not bool(conflict.ok) and String(conflict.reason) == "event_id_conflict", "event id cannot be reused for a different source")
	# Active-time quantum spoof: a huge jump is rejected without consuming cooldown.
	world_active_seconds += 3601
	world_sequence += 1
	var quantum: Dictionary = eco.advance_world_time("poi_crown_waystation", "w24.quantum")
	_expect(not bool(quantum.ok) and String(quantum.reason) == "world_time_quantum_exceeded", "host time quantum spoof rejected")
	_expect(JSON.stringify(_snapshot()) == before, "quantum spoof leaves save unchanged")
	world_active_seconds -= 3601
	world_sequence -= 1
	# Sequence rollback and clock regression are rejected.
	_world_tick(10, "w24.tick10")
	var after_tick := JSON.stringify(_snapshot())
	world_sequence -= 1
	var stale_seq: Dictionary = eco.advance_world_time("poi_crown_waystation", "w24.staleseq")
	_expect(not bool(stale_seq.ok) and String(stale_seq.reason) == "stale_world_sequence", "stale host sequence rejected")
	world_sequence += 1
	world_active_seconds -= 1
	var regress: Dictionary = eco.advance_world_time("poi_crown_waystation", "w24.regress")
	_expect(not bool(regress.ok) and String(regress.reason) == "world_clock_regressed", "host clock regression rejected")
	world_active_seconds += 1
	_expect(JSON.stringify(_snapshot()) == after_tick, "clock attacks conserve the committed snapshot")
	# A new session may baseline a large host counter, but it cannot credit that
	# counter as elapsed active time or skip the remaining cooldown.
	world_session_index += 1
	world_session_id = "fixture-world-spoof-session"
	world_active_seconds = 999999
	world_sequence = 0
	var baseline: Dictionary = eco.advance_world_time("poi_crown_waystation", "w24.newsession.baseline")
	_expect(bool(baseline.ok), "new session baselines host counter")
	var offline: Dictionary = _world_act("cache_restock", "si:r_ashen_crown:waystation_cache:01", "w24.newsession.claim")
	_expect(not bool(offline.ok) and String(offline.reason) == "COOLDOWN", "spoofed session counter does not skip cooldown")
	# Partial relay cost must not consume the affordable material.
	_move("poi_crown_relay_shed", Vector2i(442, 234))
	_give("iron_scrap", 2)
	var scrap_before := _count("iron_scrap")
	var partial: Dictionary = _world_act("hand_crank_bypass", "", "w24.relay.partial")
	_expect(not bool(partial.ok) and String(partial.reason) == "MISSING_ITEM:oak_wood", "relay rejects partial cost")
	_expect(_count("iron_scrap") == scrap_before and not eco.has_capability("cap_power_1"), "partial cost consumes nothing and grants no capability")
	# Permanent knowledge is not revoked by a failed craft or world attack.
	_station("lab", "research")
	_give("knowledge_spares", 6); _give("research_notes", 2)
	var research: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "w24.research")
	_expect(bool(research.ok), "research enqueued for conservation check")
	if bool(research.ok):
		_finish_job(String(research.job_id), "lab")
	_expect(eco.known("iron_pick"), "knowledge learned")
	var failed_craft: Dictionary = eco.enqueue("iron_pick", "bench", "w24.craft.missing")
	_expect(not bool(failed_craft.ok), "craft without inputs fails")
	_expect(eco.known("iron_pick"), "failed craft does not erase permanent recipe knowledge")

func _case_25_quarry_fail_closed_and_hidden_projection() -> void:
	_begin("A8 Quarry fail-closed + undiscovered projection privacy")
	var hidden: Dictionary = eco.world_projection("poi_crown_waystation")
	_expect(String(hidden.get("visibility", "")) == "HIDDEN" and (hidden.get("sources", []) as Array).is_empty(), "undiscovered POI hides private source/reward metadata")
	var quarry: Dictionary = eco.world_action({"poi_id": "poi_crown_south_quarry", "action_id": "brace_east_shelf"}, "w25.quarry.brace")
	_expect(not bool(quarry.ok) and String(quarry.reason) == "unknown_world_poi", "unauthorized Quarry POI is rejected")
	var quarry_cost: Dictionary = eco.world_action({"poi_id": "poi_crown_south_quarry", "action_id": "extract_outcrop", "cost_quantity": 1, "reward_quantity": 2}, "w25.quarry.extract")
	_expect(not bool(quarry_cost.ok) and String(quarry_cost.reason).begins_with("invalid_world_request_field"), "caller cannot price/authorize Quarry through request fields")
	var quarry_projection: Dictionary = eco.world_projection("poi_crown_south_quarry")
	_expect(quarry_projection.is_empty(), "Quarry has no read-only economy projection until authorized")
	_move("poi_crown_waystation", Vector2i(408, 199))
	_expect(bool(_world_act("pry_locker", "", "w25.locker").ok), "locker discovers Waystation")
	var discovered: Dictionary = eco.world_projection("poi_crown_waystation")
	_expect(String(discovered.get("visibility", "")) == "DISCOVERED" and not (discovered.get("sources", []) as Array).is_empty(), "discovered POI exposes actionable read-only sources")

func _case_26_one_time_crates_and_basic_tool_research_policy() -> void:
	_begin("one-time A1 crates, exhausted projection, and basic-tool research override")
	_move("poi_crown_waystation", Vector2i(400, 217))
	var first: Dictionary = _world_act("salvage_roadside_supplies_02", "si:r_ashen_crown:roadside_supply:02", "w26.crate02.first")
	_expect(bool(first.ok), "one-time crate 02 first claim succeeds")
	var before := JSON.stringify(_snapshot())
	var again: Dictionary = _world_act("salvage_roadside_supplies_02", "si:r_ashen_crown:roadside_supply:02", "w26.crate02.again")
	_expect(bool(again.ok) and String(again.result) == "ALREADY_APPLIED", "new event cannot reclaim one-time crate 02")
	_expect(JSON.stringify(_snapshot()) == before, "exhausted one-time claim changes no inventory/cooldown/receipt")
	var replay: Dictionary = _world_act("salvage_roadside_supplies_02", "si:r_ashen_crown:roadside_supply:02", "w26.crate02.first")
	_expect(bool(replay.ok) and String(replay.result) == "ALREADY_APPLIED", "same-event one-time replay remains idempotent")
	_move("poi_crown_waystation", Vector2i(408, 199))
	_expect(bool(_world_act("pry_locker", "", "w26.locker").ok), "discover Waystation for projection")
	var projection: Dictionary = eco.world_projection("poi_crown_waystation")
	var crate_entry := {}
	for raw: Variant in (projection.get("sources", []) as Array):
		if String((raw as Dictionary).get("binding_id", "")) == "a1_roadside_salvage_02_v5":
			crate_entry = raw
	_expect(int(crate_entry.get("max_claims", 0)) == 1 and bool(crate_entry.get("exhausted", false)) and not bool(crate_entry.get("ready", true)), "A6 projection marks one-time crate exhausted, not cooling down")
	# Basic iron_pick research is cheaper than advanced targeted research, but it
	# still pays real spares/notes and still requires a physical research station.
	_station("lab", "research")
	_give("knowledge_spares", 2); _give("research_notes", 1)
	var poor: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "w26.research.poor")
	_expect(not bool(poor.ok) and String(poor.reason) == "insufficient_inputs", "basic-tool research rejects 2 spares + 1 note")
	_give("knowledge_spares", 1)
	var paid: Dictionary = eco.research_recipe("iron_pick", "lab", "targeted", "w26.research.paid")
	_expect(bool(paid.ok), "basic-tool research accepts exactly 3 spares + 1 note")
	if bool(paid.ok):
		_finish_job(String(paid.job_id), "lab")
	_expect(_count("knowledge_spares") == 0 and _count("research_notes") == 0, "basic-tool research consumes the override cost exactly")
	# A recipe without an override keeps the advanced default 6 spares + 2 notes.
	_give("knowledge_spares", 5); _give("research_notes", 2)
	var advanced_poor: Dictionary = eco.research_recipe("salvage_hammer", "lab", "targeted", "w26.research.advanced.poor")
	_expect(not bool(advanced_poor.ok) and String(advanced_poor.reason) == "insufficient_inputs", "advanced targeted research still rejects 5 spares + 2 notes")
	_give("knowledge_spares", 1)
	var advanced: Dictionary = eco.research_recipe("salvage_hammer", "lab", "targeted", "w26.research.advanced")
	_expect(bool(advanced.ok), "advanced targeted research still requires 6 spares + 2 notes")
