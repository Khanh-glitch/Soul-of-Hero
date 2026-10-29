extends SceneTree
## A3 adapter tests against the REAL SaveService, not a mock inventory.
## Station resolver is an explicit A0 contract fixture; no production placement,
## world loot, Gold rendering, or human playability is claimed by this suite.
const Economy = preload("res://game/survival/economy/economy_service.gd")
var checks := 0
var failures: Array[String] = []
var save: Node
var eco: RefCounted
var stations := {}
var case_id := 0
var path := ""

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
	eco = Economy.new()
	_expect(eco.configure(save, _resolve), "catalog + real SaveService adapter")

func _resolve(id: String) -> Dictionary:
	return stations.get(id, {}).duplicate(true)

func _station(id: String, kind: String, tier := 1) -> void:
	stations[id] = {"ok": true, "station_id": id, "kind": kind, "tier": tier,
		"queue_capacity": 3, "operational": true, "condition": 100}

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
		_expect(false, "finish_job received empty job_id (prior enqueue/research failed)")
		return
	_expect(bool(eco.advance(station, 1000, "tick.%d.%s.%d" % [case_id, job_id, Time.get_ticks_usec()]).ok), "advance production")
	var collected: Dictionary = eco.collect(job_id, "collect.%d.%s" % [case_id, job_id])
	_expect(bool(collected.ok), "collect output")
	if not bool(collected.ok):
		print("DEBUG collect failed job=", job_id, " result=", collected, " state=", eco.jobs().get(job_id, {}))

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
	_expect(bool(eco.advance("furnace", 4, "tick.4").ok), "partial tick")
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
	# Fill the real SaveService bag until it refuses another distinct stack.
	for i in range(40):
		var filled: bool = bool(save.call(&"grant_inventory_item", "fixture_blocker_%02d" % i, "material", 1, "fixture.fill.%d.%d" % [case_id, i]))
		if not filled:
			break
	_expect(not bool(eco.collect(cancelled.job_id, "collect.full").ok), "full bag refuses collection")
	_expect(bool(save.call(&"reload_save")), "reload from disk")
	eco = Economy.new(); eco.configure(save, _resolve)
	_expect(not bool(eco.collect(cancelled.job_id, "collect.full.after.reload").ok), "full bag still refuses after reload")
	_expect(bool(save.call(&"consume_inventory_item", "fixture_blocker_00", 1, "free.slot.0")), "free slot 0")
	_expect(bool(save.call(&"consume_inventory_item", "fixture_blocker_01", 1, "free.slot.1")), "free slot 1")
	_expect(bool(eco.collect(cancelled.job_id, "collect.now").ok), "escrow survives reload")
	_expect(bool(eco.collect(cancelled.job_id, "collect.now").get("duplicate", false)), "collection replay safe")
	_expect(_count("oak_wood") == 6 and _count("iron_scrap") == 2, "exact refund once")
	# 04 research specimen is separate from physical plan and knowledge.
	_begin("Core specimen sacrifice / permanent recipe / duplicate research")
	_station("lab", "research")
	_give("knowledge_spares", 30); _give("iron_scrap", 3); _give("iron_ingot", 2)
	_give("research_notes", 3); _give("soul_ember", 2); _give("crypt_bone_shard", 2)
	for tid in ["tech_smelting", "tech_precision", "tech_core_binding"]:
		var tj: Dictionary = eco.research_technology(tid, "lab", "case4." + tid)
		_expect(bool(tj.ok), "earn prerequisite " + tid)
		_finish_job(tj.job_id, "lab")
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
	_station("lab", "research")
	_give("knowledge_spares", 30); _give("iron_scrap", 3); _give("iron_ingot", 2)
	_give("research_notes", 3); _give("soul_ember", 2); _give("crypt_bone_shard", 2)
	for tid in ["tech_smelting", "tech_precision", "tech_core_binding"]:
		var tj: Dictionary = eco.research_technology(tid, "lab", "case5." + tid)
		_expect(bool(tj.ok), "earn prerequisite " + tid)
		_finish_job(tj.job_id, "lab")
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
	# 07 cast atomicity: blocked A4, stale revision, successful commit, replay.
	_begin("A4 gate / atomic finite-use debit")
	var c: Dictionary = eco.grant_instance("core_venom", "loot.core.2", 2, 100)
	var cid: String = c.instance_id
	var blocked: Callable = func(_id: String) -> Dictionary: return {"ready": false}
	_expect(not bool(eco.commit_cast(cid, "cast.blocked", 0, blocked).ok), "unverified A4 skill cannot debit")
	_expect(int(eco.instance(cid).uses) == 2, "blocked cast preserves charges")
	var verified: Callable = func(id: String) -> Dictionary: return {"ready": true, "abstract_skill_id": id, "evidence": "test-only-attestation"}
	_expect(bool(eco.commit_cast(cid, "cast.one", 0, verified).ok), "verified gate debits once")
	_expect(not bool(eco.commit_cast(cid, "cast.stale", 0, verified).ok), "stale revision refused")
	_expect(bool(eco.commit_cast(cid, "cast.one", 0, verified).get("duplicate", false)), "cast replay does not debit")
	_expect(int(eco.instance(cid).uses) == 1, "exactly one charge consumed")
	_expect(bool(eco.commit_cast(cid, "cast.two", 1, verified).ok), "last charge")
	_expect(not bool(eco.commit_cast(cid, "cast.three", 2, verified).ok), "depleted Core refuses")
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
	else:
		print("DEBUG learn=", learn, " rebuild=", rebuild, " jobs=", eco.jobs(), " shell=", eco.instance(shell_id))
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
	_expect(bool(eco.advance("furnace", 1000, "pause.tick").ok), "offline station tick accepted")
	_expect(String(eco.jobs()[paused.job_id].status) == "paused", "job paused without output")
	_expect(bool(save.call(&"reload_save")), "paused job reload")
	eco = Economy.new(); eco.configure(save, _resolve)
	stations["furnace"]["operational"] = true
	_finish_job(paused.job_id, "furnace")
	_expect(_count("charcoal") == 2, "paused job resumes exactly once")
	# End-to-end report.
	if failures.is_empty():
		print("A3 ECONOMY ADAPTER PASSED - %d checks / %d cases" % [checks, case_id])
		quit(0)
	else:
		print("A3 ECONOMY ADAPTER FAILED - %d/%d" % [failures.size(), checks])
		for f in failures: print("  - " + f)
		quit(1)
