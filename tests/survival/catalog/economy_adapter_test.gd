extends SceneTree
## A3 adapter tests against the REAL SaveService, not a mock inventory.
## Station/time/skill producers are explicit NATIVE FIXTURE contracts. They are
## not A0 production placement, not an authoritative wall-clock, and not A4 Gold
## verification. Production catalog Cores remain BLOCKED_PENDING_A4.
const Economy = preload("res://game/survival/economy/economy_service.gd")
const TIME_CONTRACT := "soh.economy.active_tick.v1"
const SKILL_CONTRACT := "soh.economy.skill_attestation.v1"
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
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "catalog + real SaveService adapter")
	eco.configure_time_host(_host_time)

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
	# End-to-end report.
	if failures.is_empty():
		print("A3 ECONOMY ADAPTER PASSED - %d checks / %d cases" % [checks, case_id])
		quit(0)
	else:
		print("A3 ECONOMY ADAPTER FAILED - %d/%d" % [failures.size(), checks])
		for f in failures: print("  - " + f)
		quit(1)
