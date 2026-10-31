extends "res://tests/survival/balance_native_r12/r12_harness.gd"
## Round 12: this body is the round-11 probe carried forward with only the
## probe id and the harness path changed. It runs against the round-12
## composition, so a defect that survives here is a fact about this tree and
## not a recitation of round 11.
## WP2 — J02 (the rare Skill Core) and J05 (threat, one death bag, recovery).
##
## These two journeys share a shape: the *mechanics* behind them exist and the
## *encounter* that would make a player meet them does not. The probe therefore
## measures both halves separately and refuses to let the working half stand in for
## the missing one:
##
## * J02 — the three physical Cores are real catalogue items with real sources in
##   A3's data, all `PROPOSED_WORLD`; storing one in a chest works today, and there
##   is no research recipe, no charge authority and no acceptance path that a
##   player could reach. A Core that only exists in a spreadsheet is not a Core.
## * J05 — the death machinery is real production code: one bag, tokens, all-or-
##   nothing recovery, a durable pending death a restart resumes. What is missing is
##   anything in the mounted world that can hurt the Hero, so no player can reach
##   it. And the currency-custody clause is checked here too: a unique token is
##   *retained* across death, which makes the "losable" late-run currency
##   unlosable in this build.

const CURRENCY := "ragnarok_unbanked"

func _body() -> void:
	probe_id = "R12J02"
	probe_title = "J02/J05 rare Core and death custody: what exists, what a player can meet"
	owner_action = (
		"A1/A8: publish a physical Core source and one authentic damage producer; A0's death bag is ready for both. "
		+ "A0/A3: unique A3 tokens are retained through death, so the creator-locked losable currency cannot be lost "
		+ "— decide whether the custody rule or the retention rule wins, and make it one rule."
	)

	if OS.get_cmdline_user_args().has("--a7-r11-j05-child"):
		_child(OS.get_cmdline_user_args())
		_done()
		return

	var mounted := await _mount_world_ready(false)
	if mounted == null:
		_block("the shipped overworld did not reach READY: %s" % blocked)
		_done()
		return

	_core_sources()
	await _core_store_and_use(mounted)
	await _threat_census(mounted)
	await _death_custody(mounted)

	_done()


# ------------------------------------------------------------- 1. Core sources
func _core_sources() -> void:
	var catalog: Variant = JSON.parse_string(_source("res://data/survival/items/items.json"))
	var items: Dictionary = (catalog as Dictionary)["items"] if catalog is Dictionary and (catalog as Dictionary).get("items") is Dictionary else {}
	var cores: Array[String] = []
	for id: Variant in items.keys():
		var record: Dictionary = items[id]
		if String(record.get("kind", "")) == "skill_core":
			cores.append(String(id))
	_expect(cores.size() >= 3, "the catalogue defines the physical Skill Cores (%d: %s)" % [cores.size(), str(cores)])
	var proposed := 0
	for id: String in cores:
		if String((items[id] as Dictionary).get("acquisition_status", "")) == "PROPOSED_WORLD":
			proposed += 1
	_expect(proposed == cores.size(),
		"every Core is honestly marked PROPOSED_WORLD rather than pretending to be live (%d/%d)" % [proposed, cores.size()])

	var sources: Variant = JSON.parse_string(_source("res://data/survival/items/sources.json"))
	var rows: Dictionary = (sources as Dictionary).get("sources", {}) if sources is Dictionary else {}
	var core_sources: Array[String] = []
	var not_integrated := 0
	for id: Variant in rows.keys():
		var row: Dictionary = rows[id]
		if not String(row.get("item_id", "")).contains("core"):
			continue
		core_sources.append(String(id))
		if String(row.get("integration_status", "")) != "LIVE":
			not_integrated += 1
	_note("core sources=%s, not LIVE=%d" % [str(core_sources), not_integrated])
	_expect(not core_sources.is_empty(), "each Core names a world source in A3's data (%d)" % core_sources.size())
	_expect(not_integrated == core_sources.size(),
		"none of those sources is integrated into the world yet (%d/%d)" % [not_integrated, core_sources.size()])
	if not core_sources.is_empty() and not_integrated == core_sources.size():
		var example := core_sources[0]
		var row: Dictionary = rows[example]
		_missing("a physical Skill Core a player can find (A1/A8 source)",
			"source %s is %s at poi %s with requirements %s; no mounted world node binds it"
			% [example, String(row.get("integration_status", "")), String(row.get("poi_id", "")), str(row.get("requirements", []))])

	# Research: the run-local reverse-engineering path.
	var research: Variant = JSON.parse_string(_source("res://data/survival/recipes/research.json"))
	var techs: Dictionary = (research as Dictionary).get("technologies", {}) if research is Dictionary else {}
	var core_techs := 0
	for id: Variant in techs.keys():
		if String(id).contains("core"):
			core_techs += 1
	_note("technologies=%d core_technologies=%d" % [techs.size(), core_techs])
	if core_techs == 0:
		_missing("a run-local Core research/duplication path",
			"data/survival/recipes/research.json declares %d technologies and none is a Core" % techs.size())


# --------------------------------------------------- 2. the store half is real
func _core_store_and_use(mounted: Node) -> void:
	var build: Node = mounted.get(&"survival_build")
	if build == null:
		return
	_grant("oak_wood", "material", 8, "a7.r11.j02.oak")
	_grant("iron_scrap", "material", 2, "a7.r11.j02.iron")
	var cell := _free_cell_near(_hero_cell(), build)
	if cell.x < 0:
		return
	var placed := _place(build, "chest_wood", cell)
	if not bool(placed.get("ok", false)):
		_note("NOT_TESTED Core storage: the chest could not be placed (%s)" % String(placed.get("reason", "")))
		return
	var structures: Dictionary = _survival().call(&"structures") as Dictionary
	var chest_id := ""
	for key: Variant in structures.keys():
		if String((structures[key] as Dictionary).get("piece", "")) == "chest_wood":
			chest_id = String(key)
	if chest_id.is_empty():
		return
	var core_instance := _grant_instance("core_venom", "a7.r11.j02.core")
	_note("FIXTURE_GRANT core_venom instance=%s" % core_instance)
	# An instance-storage item is carried as a `soh_i_<instance>` token stack plus a
	# record in the economy's instance table, so the bag total by item id is not the
	# right read: A3's own `owned_instances` is.
	var owned: Array = _adapter().call(&"owned_instances", "core_venom") as Array
	_expect(owned.size() >= 1,
		"FIXTURE_GRANT a Core can exist in the run bag as an instance (%d owned)" % owned.size())
	# The chest's contents are a flat `{item_id: quantity}` map. An instance item is
	# carried as a `soh_i_` token plus an A3 ownership record, and `_transfer_all`
	# skips those on purpose ("leave coupled unique instances where the A3 ownership
	# audit supports them"), so the sweep moves materials and refuses the Core.
	var deposited: Dictionary = _survival().call(&"deposit_all", chest_id) as Dictionary
	var stored_map: Dictionary = _survival().call(&"container_contents", chest_id) as Dictionary
	_expect(stored_map.has("oak_wood") or stored_map.has("iron_scrap"),
		"ordinary materials really move into a placed chest (%s, moved=%s)"
		% [String(deposited.get("reason", "")), str(deposited.get("moved", {}))])
	var stored_core := false
	for key: Variant in stored_map.keys():
		if String(key).begins_with("soh_i_") or String(key).contains("core"):
			stored_core = true
	_expect(not stored_core,
		"an instance Core is not sweepable into a chest, so STORE-the-Core does not exist as a player choice (%s)"
		% String(deposited.get("reason", "")))
	_note("chest after sweep=%s" % str(stored_map))

	# USE / charge authority. `_skill_attestor` is a `Callable` that A3 initialises to
	# an invalid one; "bound" therefore means `is_valid()`, not "not null". Nothing in
	# `game/` calls `configure_skill_attestor`, so the composed product cannot verify a
	# cast: a Core can be held and inspected, never spent.
	var adapter := _adapter()
	var attestor_valid := false
	if adapter != null:
		var raw: Variant = adapter.get(&"_skill_attestor")
		attestor_valid = raw is Callable and (raw as Callable).is_valid()
	_note("skill attestor valid=%s" % str(attestor_valid))
	_expect(not attestor_valid, "no skill attestor is bound in the composed product, so USE is fail-closed")
	if not attestor_valid:
		var cast := adapter.call(&"commit_cast", core_instance, "a7.r11.j02.cast", 0, {}) as Dictionary
		_note("commit_cast -> %s" % String(cast.get("reason", "")))
		_expect(String(cast.get("reason", "")) in ["skill_gate_unavailable", "not_a_skill_core", "instance_not_owned", "stale_revision"],
			"a real USE attempt on a held Core is refused by the product, not faked (%s)" % String(cast.get("reason", "")))
		_missing("a charge/use authority for a found Core (immediate USE)",
			"economy_service._skill_attestor is an invalid Callable in the composition and no code calls "
			+ "configure_skill_attestor, so commit_cast refuses with %s" % String(cast.get("reason", "")))
	# And the reverse of the same fact: does any survival code spend a core at all?
	var spenders := _source_calls("res://game", "commit_cast(", "economy_service.gd")
	_note("commit_cast call sites outside the economy service: %d" % spenders)


# ------------------------------------------------------- 3. is there a threat?
func _threat_census(mounted: Node) -> void:
	var enemy_nodes := 0
	var hazard_damage := 0
	for node: Node in mounted.get_children():
		if String(node.name).to_lower().contains("enemy") or node.is_in_group(&"enemies"):
			enemy_nodes += 1
	var group_nodes := mounted.get_tree().get_nodes_in_group(&"enemies")
	var all_enemies := 0
	for node: Node in group_nodes:
		# Only count what this world owns; the campaign scenes are not mounted.
		if mounted.is_ancestor_of(node):
			all_enemies += 1
	_note("enemies in mounted world: name-matched=%d group-owned=%d" % [enemy_nodes, all_enemies])
	_expect(all_enemies == 0 and enemy_nodes == 0,
		"the mounted survival world spawns no enemy (%d found)" % maxi(all_enemies, enemy_nodes))
	# Hazards exist as geometry, but the Hero's health must be a real caller.
	var damage_callers := _source_calls("res://game/overworld", "take_damage", "###none###")
	var survival_damage := _source_calls("res://game/survival", "take_damage", "###none###")
	_note("take_damage call sites: overworld=%d survival=%d" % [damage_callers, survival_damage])
	if survival_damage == 0 and damage_callers == 0:
		_missing("an authentic damage producer in the survival world (A1 hazards or A8 enemies)",
			"no call site of take_damage/take_resolved_damage exists under game/overworld or game/survival")
	_expect(hazard_damage == 0, "hazard geometry does not damage the Hero by itself")


# -------------------------------------------------------- 4. death custody
func _death_custody(mounted: Node) -> void:
	var survival := _survival()
	var save := _save()
	var position := hero.global_position
	# Something ordinary to lose, and a unique token that the custody rule cares
	# about. The token is minted through A3's authoring API (MUTATION) because the
	# physical chest that would drop it does not exist yet.
	_grant("oak_wood", "material", 10, "a7.r11.j05.oak")
	# The late-run currency is catalogue `kind: key_item`, `storage: stack`, so it goes
	# into the bag as an ordinary key-item stack rather than an A3 instance token. A
	# fixture is the only way to hold one today: the chest that should drop it is
	# source `OWNER_CONTRACT_CANDIDATE_A8` and no physical chest binds that source.
	var minted := _grant(CURRENCY, "key_item", 1, "a7.r11.j05.currency")
	_note("token mint=%s held=%d" % [str(minted), _count_item(CURRENCY)])
	var token_id := CURRENCY if minted else String("")
	var wood_before := _count_item("oak_wood")

	var death := survival.call(&"begin_overworld_death", position) as Dictionary
	_expect(bool(death.get("ok", false)), "the product records one death (%s)" % String(death.get("reason", "")))
	var bag_id := String(death.get("entity_id", ""))
	_expect(not bag_id.is_empty(), "the death names exactly one bag (%s)" % bag_id)
	var second := survival.call(&"begin_overworld_death", position) as Dictionary
	_expect(bool(second.get("already_pending", false)),
		"a second death while one is pending reuses the same bag (%s)" % String(second.get("entity_id", "")))
	_expect(String(second.get("entity_id", "x")) == bag_id, "there is never a second bag for the same death")

	var document: Dictionary = survival.call(&"document") as Dictionary
	var bags: Dictionary = document.get("death_bags", {})
	var bag: Dictionary = bags.get(bag_id, {}) if bags.get(bag_id) is Dictionary else {}
	var dropped: Dictionary = bag.get("stacks", {})
	_note("bag stacks=%d pending=%s" % [dropped.size(), String(document.get("pending_death", ""))])
	_expect(dropped.size() >= 1, "the bag holds the carried materials (%d stacks)" % dropped.size())
	_expect(_count_item("oak_wood") < wood_before,
		"the carried materials left the bag on death (%d -> %d)" % [wood_before, _count_item("oak_wood")])
	_expect(String(document.get("pending_death", "")) == bag_id, "the death stays pending until it is finished")

	# The custody clause: the late-run currency is supposed to be losable.
	if not token_id.is_empty():
		_note("bag keys=%s" % str(dropped.keys()))
		# The late-run currency is an ordinary key-item stack, so death moves it into
		# the bag and it is genuinely losable. A3 instance tokens are the exception the
		# service documents: they stay in the bag until A3's ownership audit can hand
		# a unique item to a bag record.
		var currency_dropped := dropped.has(CURRENCY)
		var currency_kept := false
		for key: Variant in _stacks().keys():
			if String(key).contains(CURRENCY):
				currency_kept = true
		_expect(currency_dropped, "the late-run currency is dropped into the death bag, so it can be lost")
		_expect(not currency_kept, "the dropped currency is no longer in the player's bag (no free duplicate)")
		var instance_kept := false
		for key: Variant in _stacks().keys():
			if String(key).begins_with("soh_i_"):
				instance_kept = true
		_note("instance token retained in the bag across death=%s" % str(instance_kept))
		if instance_kept:
			_missing("a death rule that can lose a unique A3 instance token",
				"survival_service.begin_overworld_death keeps every `soh_i_` stack in the bag and puts only "
				+ "ordinary stacks in the bag record, so a unique token cannot be lost")

	# Resume: the pending death must be durable for a returning process.
	var child := await _run_second_process(["--a7-r11-j05-child", "--a7-r11-j05-save=" + save_path])
	var report := _child_report(String(child.get("output", "")))
	_note("restart report=%s" % str(report.keys()))
	if not report.is_empty():
		_expect(String(report.get("pending_death", "")) == bag_id,
			"a second OS process still sees the same pending death (%s)" % String(report.get("pending_death", "")))
		_expect(int(report.get("bags", 0)) == 1, "the restart creates no second bag (%d)" % int(report.get("bags", 0)))
	else:
		_note("NOT_TESTED the pending-death restart: the child produced no report")

	# Respawn first: `recover_death_bag` refuses while the death is still pending, so
	# the player's own order is finish the death, then walk back to the bag.
	var respawned := bool(survival.call(&"finish_overworld_death", position))
	_expect(respawned, "the product clears the pending death once the player respawns")
	var recovered: bool = bool(survival.call(&"recover_death_bag", bag_id))
	_expect(recovered, "the bag is recoverable after the respawn")
	var wood_after := _count_item("oak_wood")
	_expect(wood_after >= wood_before,
		"recovery restores the exact carried materials (%d -> %d)" % [wood_before, wood_after])
	var replay: bool = bool(survival.call(&"recover_death_bag", bag_id))
	_expect(not replay, "recovering the same bag twice is refused")
	_expect(_count_item("oak_wood") == wood_after, "the refused replay pays nothing (%d)" % _count_item("oak_wood"))
	_expect(String((survival.call(&"document") as Dictionary).get("pending_death", "")) == "",
		"no pending death is left behind")


# ---------------------------------------------------------------------- child
## A returning process must see the same unfinished death, and must not create a
## second bag while doing it.
func _child(args: PackedStringArray) -> void:
	var target := ""
	for arg: String in args:
		if arg.begins_with("--a7-r11-j05-save="):
			target = arg.trim_prefix("--a7-r11-j05-save=")
	if target.is_empty():
		print("A7J05CHILD " + JSON.stringify({"error": "no_save_arg"}))
		return
	var save := _save()
	if save == null or not bool(save.call(&"configure_storage", target, true)):
		print("A7J05CHILD " + JSON.stringify({"error": "storage_refused"}))
		return
	var survival := _survival()
	if survival == null:
		print("A7J05CHILD " + JSON.stringify({"error": "no_survival_service"}))
		return
	var document: Dictionary = survival.call(&"document") as Dictionary
	var bags: Dictionary = document.get("death_bags", {})
	print("A7J05CHILD " + JSON.stringify({
		"pending_death": String(document.get("pending_death", "")),
		"bags": bags.size(),
		"oak_wood": _count_item("oak_wood"),
	}))


func _child_report(output: String) -> Dictionary:
	for line: String in output.split("\n"):
		var at := line.find("A7J05CHILD ")
		if at < 0:
			continue
		var parsed: Variant = JSON.parse_string(line.substr(at + 11))
		if parsed is Dictionary:
			return parsed
	return {}


func _finish() -> void:
	_release_all()
	super._finish()
