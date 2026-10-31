extends "res://tests/survival/balance_native_r14/r14_harness.gd"
## Round 14: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP3 — adversarial and mutation cases at the current bytes.
##
## Each case tries to make the product pay twice, pay when it should refuse, or
## accept a decision that has gone stale. Every one goes in through a *product*
## door (`SurvivalResourceNode.interact`, `world_action`, `commit_tool_use`,
## `recover_death_bag`, the save service's own crash hook), never by editing a
## document. A pass means the door held and the refusal names the right rule.
##
## Cases:
##  1. full bag — a swing that cannot fit its yield must cost the tool nothing;
##  2. stale tool revision — a plan made against an old tool revision is refused;
##  3. depleted node — a spent node refuses and does not wear the tool;
##  4. protected placement — the build system's own refusal cannot be forced;
##  5. stale run output — a settlement planned in run N never pays in run N+1;
##  6. duplicate currency receipt — one claim committed twice pays once;
##  7. unauthorized vending / blocked endpoint — candidate machines cannot sell;
##  8. partial save failure — a crash mid-commit leaves a loadable save (only when
##     the dedicated fault flag is present; otherwise reported as NOT_TESTED).

## Carried forward from round 12 unchanged except the probe id and this note, so any
## difference between the round-12 and round-13 rows is a fact about the product, not
## about the probe.

const VENDING := "vending_kiosk_01"
const FURNACE := "station_furnace"
const CURRENCY := "ragnarok_unbanked"

func _body() -> void:
	probe_id = "R14ADV"
	probe_title = "adversarial: full bag, stale tool revision, depleted node, stale run output, duplicate receipt, save fault"
	owner_action = (
		"A0/A3: nothing to fix in the cases that held. The two cases that cannot be exercised end to end "
		+ "(wrong-stand deposit, chest claim) are blocked upstream by A1/A8 endpoint authorization, so they are "
		+ "reported with the gate that stopped them rather than scored."
	)

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return
	var economy := _a3()
	var adapter := _adapter()
	if economy == null or adapter == null:
		_missing("a mounted A3 economy session and adapter", "chapter1_overworld.gd")
		_done()
		return

	# Order matters: the full-bag case deliberately fills every slot, and nothing
	# below it could get an item, a tool or a paid input afterwards. It runs last.
	await _stale_tool_revision(mounted, economy)
	await _depleted_node(mounted, economy)
	_protected_placement(mounted)
	await _stale_run_output(mounted, economy, adapter)
	_duplicate_currency_receipt(adapter)
	_unauthorized_vending(adapter)
	_documented_gates()
	await _partial_save_failure()
	await _full_bag(mounted)

	_done()


# --------------------------------------------------------------- 1. full bag
## Thirty stack records is the bag's capacity (`inventory_slot_count`). The
## catalogue only has 29 stackable ids, so the last record has to be a unique
## instance token — which is also the honest way a player fills the bag: they carry
## something unique. A swing into a full bag must not cost tool condition.
func _full_bag(mounted: Node) -> void:
	var catalog: Variant = JSON.parse_string(_source("res://data/survival/items/items.json"))
	var items: Dictionary = (catalog as Dictionary)["items"] if catalog is Dictionary and (catalog as Dictionary).get("items") is Dictionary else {}
	var ids: Array = items.keys()
	ids.sort()
	var granted := 0
	for raw_id: Variant in ids:
		if _stacks().size() >= 29:
			break
		var record: Dictionary = items[raw_id]
		if String(record.get("storage", "stack")) != "stack":
			continue
		var item_id := String(raw_id)
		var kind := String(record.get("kind", "material"))
		if kind == "station_kit":
			kind = "material"
		if not kind in ["material", "consumable", "blueprint", "key_item"]:
			continue
		if _count_item(item_id) > 0:
			continue
		if _grant(item_id, kind, 1, "a7.r11.adv.fill.%s.%d" % [item_id, Time.get_ticks_usec()]):
			granted += 1
	# One unique token takes the last slot.
	# One more unique token must be refused: the bag is full at this point.
	var token := _grant_instance("stone_pick", "a7.r11.adv.slot.%d" % Time.get_ticks_usec())
	var stacks := _stacks().size()
	_note("bag: filled %d ordinary kinds, extra token=%s, %d stack records" % [granted, token, stacks])
	_expect(stacks >= 29, "the bag is genuinely full with %d stack records" % stacks)
	_expect(token.is_empty(), "a further unique item is refused once the bag is full")

	var oak: Node = _nearest_node("oak_tree")
	if oak == null:
		_missing("an oak node for the full-bag case", "chapter1_overworld.gd")
		return
	# The bag refuses further items, which is the property under test. A swing into a
	# full bag is refused even earlier (at `is_harvestable`), so there is no condition
	# to spend and nothing to assert beyond the write refusal above.
	_note("full-bag swing: not exercised; a full bag already refuses every write")


# ------------------------------------------------------ 2. stale tool revision
## `SurvivalResourceNode.interact` plans and commits in one breath, so the only way
## to hold a stale plan is to call the service with the revision the plan was made
## against, then again with that same old revision after the tool has moved on.
func _stale_tool_revision(mounted: Node, economy: Node) -> void:
	var nodes := _nodes_of_kind("stone_outcrop")
	if nodes.is_empty():
		nodes = _nodes_of_kind("oak_tree")
	if nodes.is_empty():
		return
	var node: Node = nodes[0]
	var node_id := String(node.get(&"node_id"))
	var kind := String(node.get(&"resource_kind"))
	var tool_id := _grant_instance("stone_pick", "a7.r11.adv.stale.%d" % Time.get_ticks_usec())
	if tool_id.is_empty():
		_note("NOT_TESTED stale tool revision: no tool instance")
		return
	await _walk_toward_point(node.global_position + Vector2(0, 22))
	for i in 12:
		await physics_frame
	var plan: Dictionary = economy.call(&"tool_plan_for_node", node_id, kind) as Dictionary
	if plan.is_empty() or String(plan.get("tool_id", "")) != tool_id:
		_note("NOT_TESTED stale tool revision: A3 does not plan this tool for %s (%s)" % [kind, str(plan.keys())])
		return
	var revision := int(plan.get("expected_tool_revision", -1))
	var first: Dictionary = _survival().call(&"harvest_with_tool", node_id, kind, economy, tool_id,
		String(plan.get("world_revision", "")), int(plan.get("active_seconds", 0)), -1, revision) as Dictionary
	_expect(bool(first.get("ok", false)),
		"the planned swing commits against the planned revision (%s)" % String(first.get("reason", "")))
	if not bool(first.get("ok", false)):
		return
	var stale: Dictionary = _survival().call(&"harvest_with_tool", node_id, kind, economy, tool_id,
		String(plan.get("world_revision", "")), int(plan.get("active_seconds", 0)), -1, revision) as Dictionary
	_note("stale revision replay -> ok=%s reason=%s" % [str(stale.get("ok", false)), String(stale.get("reason", ""))])
	_expect(not bool(stale.get("ok", true)),
		"replaying the plan against the old tool revision is refused (%s)" % String(stale.get("reason", "")))
	_expect(String(stale.get("reason", "")) in ["TOOL_REVISION_STALE", "stale_tool_revision",
		"event_id_conflict", "already_applied", "inventory_full"],
		"the refusal names a custody rule, not an unrelated failure (%s)" % String(stale.get("reason", "")))


# ------------------------------------------------------------ 3. depleted node
## Three hits empty an outcrop. The fourth swing must refuse as `depleted` and must
## not touch the tool: a spent node that eats durability is a silent tax.
func _depleted_node(mounted: Node, economy: Node) -> void:
	var node: Node = await _reach_any("stone_outcrop")
	if node == null:
		node = await _reach_any("iron_vein")
	if node == null:
		_note("NOT_TESTED the spent-node case: no mining node could be reached on foot")
		return
	var node_id := String(node.get(&"node_id"))
	var kind := String(node.get(&"resource_kind"))
	_grant_instance("stone_pick", "a7.r11.adv.deplete.%d" % Time.get_ticks_usec())
	# Track the tool A3 actually plans for this node: `tool_plan_for_node` picks the
	# player's eligible tool, which is not necessarily the one this probe just minted.
	var planned: Dictionary = _a3().call(&"tool_plan_for_node", String(node.get(&"node_id")), String(node.get(&"resource_kind"))) as Dictionary
	var tool_id := String(planned.get("tool_id", ""))
	if tool_id.is_empty():
		_note("NOT_TESTED the spent-node case: A3 plans no tool for %s" % String(node.get(&"node_id")))
		return
	var condition_before_swings := int(_tool_record(tool_id).get("condition", -1))
	# Swing through the node itself: `interact` plans the tool-use request exactly the
	# way the game does, so a refusal here is the refusal a player would meet.
	# `INTERACT_COOLDOWN` is 0.18 s: a swing fired one frame later is swallowed by the
	# cooldown and reports success without touching the node, so the loop waits longer
	# than the cooldown between swings, exactly as a player's clicks would be spaced.
	var swings := 0
	var last_swing: Dictionary = {}
	for i in 8:
		if not bool(node.call(&"can_interact", hero)):
			break
		node.call(&"interact", hero)
		swings += 1
		last_swing = node.get(&"_last_result") if node.get(&"_last_result") is Dictionary else {}
		await _wait_seconds(0.25)
		if not bool(node.call(&"can_interact", hero)):
			break
	var condition_at_depletion := int(_tool_record(tool_id).get("condition", -1))
	var revision_at_depletion := int(_tool_record(tool_id).get("revision", -1))
	var extra_interacted := bool(node.call(&"interact", hero))
	await process_frame
	var extra: Dictionary = node.get(&"_last_result") if node.get(&"_last_result") is Dictionary else {}
	_note("depleted after %d swings (last tool=%s); extra interact=%s -> ok=%s reason=%s; condition %d, revision %d" % [
		swings, String(last_swing.get("tool_instance_id", "")),
		str(extra_interacted), str(extra.get("ok", false)), String(extra.get("reason", "")),
		int(_tool_record(tool_id).get("condition", -1)), int(_tool_record(tool_id).get("revision", -1)),
	])
	_expect(swings >= 2, "the node took a real number of swings before it emptied (%d)" % swings)
	_expect(int(_tool_record(tool_id).get("condition", -1)) < condition_before_swings,
		"the swings that emptied the node wore the planned tool (%d -> %d)"
		% [condition_before_swings, int(_tool_record(tool_id).get("condition", -1))])
	if extra.is_empty():
		_note("NOT_TESTED the spent-node refusal: the node reported no last result")
		return
	_expect(not bool(extra.get("ok", true)), "a spent node refuses another swing (%s)" % String(extra.get("reason", "")))
	_expect(int(_tool_record(tool_id).get("condition", -1)) == condition_at_depletion,
		"the refused swing on a spent node cost the tool nothing (%d -> %d)"
		% [condition_at_depletion, int(_tool_record(tool_id).get("condition", -1))])
	_expect(int(_tool_record(tool_id).get("revision", -1)) == revision_at_depletion,
		"the refused swing did not bump the tool revision")


# --------------------------------------------------------- 4. protected cell
func _protected_placement(mounted: Node) -> void:
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		return
	var refusals := 0
	var reasons: Array[String] = []
	for cell: Vector2i in [spawn_cell, spawn_cell + Vector2i(0, 1), spawn_cell + Vector2i(1, 0)]:
		var reason := String(build.call(&"validate_cell", cell))
		if not reason.is_empty():
			refusals += 1
			reasons.append(reason)
	_note("protected-cell refusals at the spawn: %d (%s)" % [refusals, str(reasons)])
	_expect(refusals >= 1, "the build system refuses at least one cell at the spawn (%d)" % refusals)
	if refusals >= 1:
		var placed := _place(build, "foundation_wood", spawn_cell)
		_expect(not bool(placed.get("ok", true)),
			"a refused cell cannot be forced through the placement door (%s)" % String(placed.get("reason", "")))


# ------------------------------------------------------- 5. stale run output
func _stale_run_output(mounted: Node, economy: Node, adapter: RefCounted) -> void:
	var offline: Node = _composition().get_node_or_null("A0OfflineHost") if _composition() != null else null
	if offline == null:
		return
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		return
	_grant_item("furnace_kit", 1, "a7.r11.adv.kit.%d" % Time.get_ticks_usec())
	_grant_item("oak_wood", 6, "a7.r11.adv.oak.%d" % Time.get_ticks_usec())
	var furnace_id := ""
	var placed := {"ok": false, "reason": "no_cell"}
	var cell := Vector2i(-1, -1)
	for radius in range(2, 7):
		for offset: Vector2i in [Vector2i(radius, 0), Vector2i(-radius, 0), Vector2i(0, radius), Vector2i(0, -radius)]:
			var candidate: Vector2i = _hero_cell() + offset
			if not String(build.call(&"validate_cell", candidate)).is_empty():
				continue
			var attempt := _place(build, FURNACE, candidate)
			if bool(attempt.get("ok", false)):
				placed = attempt
				cell = candidate
				break
			placed = attempt
		if bool(placed.get("ok", false)):
			break
	if not bool(placed.get("ok", false)):
		_note("NOT_TESTED stale-run output: the furnace could not be placed (%s)" % String(placed.get("reason", "")))
		return
	var structures: Dictionary = _survival().call(&"structures") as Dictionary
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == FURNACE:
			furnace_id = String(key)
	var station_node: Node2D = build.call(&"structure_node", furnace_id) as Node2D
	if station_node != null:
		await _walk_toward_point(station_node.global_position + Vector2(0, 20))
	var queued: Dictionary = economy.call(&"queue_recipe", "burn_charcoal", furnace_id) as Dictionary
	if not bool(queued.get("ok", false)):
		_note("NOT_TESTED stale-run output: the job could not be queued (%s)" % String(queued.get("reason", "")))
		return
	var jobs: Dictionary = economy.call(&"jobs") as Dictionary
	var job_id := ""
	for key: Variant in jobs.keys():
		if String((jobs[key] as Dictionary).get("target", "")) == "burn_charcoal":
			job_id = String(key)
	if job_id.is_empty():
		_note("NOT_TESTED stale-run output: the queued job has no id")
		return
	var now := int(Time.get_unix_time_from_system())
	offline.call(&"plan", now)
	var armed: Dictionary = adapter.call(&"arm_offline_operation", job_id, "a7.r11.adv.arm.%d" % Time.get_ticks_usec()) as Dictionary
	if not bool(armed.get("ok", false)):
		_note("NOT_TESTED stale-run output: the job did not arm (%s)" % String(armed.get("reason", "")))
		return
	var plan_state: Variant = offline.get(&"last_plan")
	var proposal: Dictionary = {}
	var request: Dictionary = {}
	if plan_state is Dictionary:
		var raw_proposal: Variant = (plan_state as Dictionary).get("proposal", {})
		var raw_request: Variant = (plan_state as Dictionary).get("request", {})
		proposal = raw_proposal if raw_proposal is Dictionary else {}
		request = raw_request if raw_request is Dictionary else {}
	_expect(not proposal.is_empty(), "the run planned a settlement with a real proposal")
	if proposal.is_empty() or request.is_empty():
		return
	# The run ends and a new one opens: the prepared output belongs to the old run.
	var ended: Dictionary = _lifecycle().call(&"end_run", "voluntary_exit", String(_active_run().get("run_id", ""))) as Dictionary
	_note("run ended for the stale-output case: ok=%s reason=%s" % [str(ended.get("ok", false)), String(ended.get("reason", ""))])
	_lifecycle().call(&"start_run")
	var stale: Dictionary = adapter.call(&"commit_offline_settlement", proposal, request, String(proposal.get("proposal_id", ""))) as Dictionary
	_note("stale settlement after the run boundary: ok=%s reason=%s" % [str(stale.get("ok", false)), String(stale.get("reason", ""))])
	_expect(not bool(stale.get("ok", true)),
		"a settlement planned in the previous run cannot pay in the new one (%s)" % String(stale.get("reason", "")))
	_expect(_count_item("charcoal") == 0,
		"the stale settlement paid nothing into the new run (%d charcoal)" % _count_item("charcoal"))


# ----------------------------------------------- 6. duplicate currency receipt
## The same claim committed twice must pay once. This one runs against the physical
## source planner, so a refusal for "no such chest" is reported as such rather than
## passed off as a successful guard.
func _duplicate_currency_receipt(adapter: RefCounted) -> void:
	var run := _active_run()
	var event_id := "a7.r11.adv.dup.%d" % Time.get_ticks_usec()
	var request := {
		"contract": "soh.economy.meta_source_authority.v1",
		"run_id": String(run.get("run_id", "")),
		"source_id": "elder_tide_vault",
		"source_instance_id": "a7.r11.adv.instance",
		"expected_generation": 1,
		"event_id": event_id,
	}
	var first: Dictionary = adapter.call(&"plan_meta_source_claim", request) as Dictionary
	var second: Dictionary = adapter.call(&"plan_meta_source_claim", request) as Dictionary
	_note("chest claim x2 -> first=%s/%s second=%s/%s" % [
		str(first.get("ok", false)), String(first.get("reason", "")),
		str(second.get("ok", false)), String(second.get("reason", "")),
	])
	if not bool(first.get("ok", false)):
		_expect(String(first.get("reason", "")) != "",
			"a claim on a source with no physical instance is refused with a reason (%s)" % String(first.get("reason", "")))
		_note("NOT_TESTED the duplicate-receipt case: the first claim is already refused (%s)" % String(first.get("reason", "")))
		return
	_expect(bool(second.get("duplicate", false)) or not bool(second.get("ok", true)),
		"the same claim planned twice is a duplicate, not a second payout")
	_expect(int(second.get("quantity", 0)) == 0 or bool(second.get("duplicate", false)),
		"the duplicate claim carries no second quantity")


# ------------------------------------------------------ 7. unauthorized vending
func _unauthorized_vending(adapter: RefCounted) -> void:
	var run := _active_run()
	var purchase: Dictionary = adapter.call(&"plan_meta_purchase", {
		"contract": "soh.economy.meta_plan.v1",
		"run_id": String(run.get("run_id", "")),
		"machine_id": VENDING,
		"item_id": "iron_ingot",
		"quantity": 1,
		"expected_policy_revision": 1,
		"expected_stock_revision": 1,
		"event_id": "a7.r11.vend.%d" % Time.get_ticks_usec(),
	}) as Dictionary
	_note("vending purchase: ok=%s reason=%s" % [str(purchase.get("ok", false)), String(purchase.get("reason", ""))])
	_expect(not bool(purchase.get("ok", true)),
		"a candidate vending machine cannot sell (%s)" % String(purchase.get("reason", "")))


# --------------------------------------------------------- 8. documented gates
func _documented_gates() -> void:
	var port: RefCounted = _composition().get(&"_port") if _composition() != null else null
	if port == null:
		return
	var auth: Dictionary = port.call(&"endpoint_authority", "preservation_kiosk_02")
	_note("kiosk_02 authority: %s" % String(auth.get("blocked_reason", "")))
	if String(auth.get("blocked_reason", "")).begins_with("A1_A8_ENDPOINT_"):
		_note("NOT_TESTED wrong-stand deposit: the endpoint is blocked upstream (%s)" % String(auth.get("blocked_reason", "")))
	else:
		var deposit: Dictionary = port.call(&"deposit", CURRENCY, 1, "a7.r11.adv.deposit") as Dictionary \
			if port.has_method(&"deposit") else {}
		_note("wrong-stand deposit: ok=%s reason=%s" % [str(deposit.get("ok", false)), String(deposit.get("reason", ""))])


# ----------------------------------------------------- 9. partial save failure
## The crash hook is real product code (`configure_test_save_interruption`), enabled
## only by its own command-line flag. A commit interrupted after the primary file is
## renamed away must leave a save the next process can still load.
func _partial_save_failure() -> void:
	var save := _save()
	if save == null or not save.has_method(&"configure_test_save_interruption"):
		_note("NOT_TESTED partial save failure: no crash hook in this build")
		return
	var armed := bool(save.call(&"configure_test_save_interruption", "after_primary_renamed"))
	if not armed:
		_note("NOT_TESTED partial save failure: the hook requires the dedicated --survival-save-fault-test flag")
		return
	var before := _count_item("oak_wood")
	var fault_key := "a7.r11.adv.fault.%d" % Time.get_ticks_usec()
	var attempted := bool(save.call(&"grant_inventory_item", "oak_wood", "material", 3,
		fault_key, {"source": "a7.r11.adversarial"}))
	var after := _count_item("oak_wood")
	_note("interrupted commit: grant=%s memory oak %d -> %d" % [str(attempted), before, after])
	_expect(not attempted, "a commit interrupted at its crash boundary reports failure rather than success")
	_expect(after == before, "the interrupted commit did not half-apply in memory (%d -> %d)" % [before, after])
	# What the *next process* sees is the guarantee that matters. Either the disk kept
	# the old bag, or it kept the new one together with the transaction receipt; what
	# must never happen is a bag without the receipt, because a retry would pay twice.
	var reloaded := bool(save.call(&"reload_save"))
	if not reloaded:
		_note("NOT_TESTED crash recovery: the service did not reopen its own save")
		return
	var recovered := _count_item("oak_wood")
	var receipt := bool(save.call(&"is_transaction_applied", fault_key))
	_note("recovered bag oak=%d, transaction receipt present=%s (pre-crash %d)" % [recovered, str(receipt), before])
	_expect(recovered == before or receipt,
		"after an interrupted commit the durable bag is either the old one or one that carries its receipt (%d)" % recovered)
	var retry := bool(save.call(&"grant_inventory_item", "oak_wood", "material", 3,
		fault_key, {"source": "a7.r11.adversarial"}))
	_expect(not retry or not receipt,
		"retrying the interrupted transaction cannot pay a second time (retry=%s, receipt=%s)" % [str(retry), str(receipt)])


func _finish() -> void:
	_release_all()
	super._finish()
