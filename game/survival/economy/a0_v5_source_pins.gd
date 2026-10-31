extends RefCounted
## A0 composition fence: A3 owner files are copied byte-for-byte from A3 PR #19
## head 35214ed8f555350b83bd8985e9bec7512f3181e8 (V7 two-layer economy, tool
## use and prepared offline operations). No UI can select this manifest.
##
## Why this fence moved (Round 11 WP1): the previous fence pinned A3 4bfba38d
## (V5). A7 independently measured `items.json` at `cd1a27c4` on a composed A3
## tree while A0 still pinned `cc3c1165`; the real cause was that A0 had not
## adopted the A3 V7 owner bytes that added the physical `ragnarok_unbanked`
## token and the `soh.economy.tool_use.v1` / `soh.economy.offline_plan.v1`
## planners. Nothing below is an A0 rewrite: every hash is the sha256 of the
## unmodified A3 file at that owner head, and the two planners are A3-authored
## files placed at their own canonical paths so their own preloads resolve.
const A3_OWNER_COMMIT := "35214ed8f555350b83bd8985e9bec7512f3181e8"
const DATA := {
	"res://data/survival/items/items.json": "cd1a27c48078a69489904e86182dc63750941d9fc296830f711dd5d574615520",
	"res://data/survival/items/sources.json": "bc88143efb61f2202ae37c96373e07a1643cc29b7fc9a38abc84e4958fe2b984",
	"res://data/survival/items/world_source_bindings.v3.json": "7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b",
	"res://data/survival/recipes/recipes.json": "4dbf48da0dbb841bedd3333f0def33f328af4ed55c0e1f919b4a19cc3385539c",
	"res://data/survival/recipes/research.json": "6cca178ac00a99e4d2acfa441869331d325d9bb4d7d1637709b0692db5d512b2",
	"res://data/survival/recipes/stations.json": "aa05487252b8064729252994954eb73007fe525d2201f8aa725065dd0ee01851",
	"res://data/survival/recipes/offline_operations.v1.json": "222b0551754999bc6ee136ecfb81c4254531d393eca73a9fe5e3e5acaaaae94d",
	"res://data/survival/recipes/meta_economy.v1.json": "bbe1095ca589a767742bf0a54ffd4f012d2135410713baa274bafee97cbf91bf",
	"res://data/survival/items/meta_display_names.v1.json": "bc5dc5173a13ffcea691289c860baa5532c79b246ad4685ecc2572f75c707c59",
	"res://data/survival/connector/a0_legacy/world_source_bindings.c23292be.v3.json": "b1d291d035c9e543e69281da268b378c8e1bb498be561b2f15e67c840792b353",
}
const SCRIPTS := {
	"res://game/survival/economy/vendor/a3_economy_service.gd": "109c268036bb92e5dcca2d23ec5f5c1664e1f8645c01abf189d6b5c90f06302c",
	"res://game/survival/economy/world_source_adapter.gd": "8bab244159e17acc34d51a22ab05112090e4f08f146511aa5c61683c7d999a47",
	"res://game/survival/economy/vendor/a3_world_source_c23292be.gd": "689a9b89dba4d756387b6b5c5f09b54d90ff0a787395f5e2fb523da496836efe",
	"res://game/survival/economy/offline_operation_planner.gd": "11ba4037cc08be1b3eb8839c541f9ee02b3a2e0c5dc4eaaa99ff379c47f433bc",
	"res://game/survival/economy/meta_economy_planner.gd": "35e88cc0166c5cf154287583756838b40de9df0682a1ad423ccef5f0138429e3",
}

static func verify() -> String:
	for path: String in DATA:
		if not FileAccess.file_exists(path) or FileAccess.get_sha256(path) != DATA[path]:
			return "a3_data_pin_mismatch:" + path
	for path: String in SCRIPTS:
		var script := load(path) as Script
		if script == null: return "a3_script_missing:" + path
		# Tokenized release scripts cannot expose source bytes. Export CI must
		# verify these exact source hashes before Godot compiles the package.
		if not script.source_code.is_empty() and script.source_code.sha256_text() != SCRIPTS[path]:
			return "a3_script_pin_mismatch:" + path
	return ""


## A stale fence must refuse the whole economy session rather than silently run
## an older A3 formula/loot set. This is the one place the diagnostic lives so
## the composition root and the negative regression report the same reason.
static func verify_or_reason() -> String:
	var error: String = verify()
	if error.is_empty():
		return ""
	return "A3_OWNER_BYTES_STALE:" + error + "@" + A3_OWNER_COMMIT
