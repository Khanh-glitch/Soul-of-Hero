extends RefCounted
## A0 composition fence: A3 owner files are copied byte-for-byte from
## 4bfba38d87bb2b6529745bf4a3caf2ba0ca07947. No UI can select this manifest.
const DATA := {
	"res://data/survival/items/items.json": "cc3c11659fc191529fb56e6a50a1bd27a29f091e2857e2f4d7b7e7d993e15a4a",
	"res://data/survival/items/sources.json": "bc88143efb61f2202ae37c96373e07a1643cc29b7fc9a38abc84e4958fe2b984",
	"res://data/survival/items/world_source_bindings.v3.json": "7b9670f4971d2f161138e0754cbbe66dfe2a239bf0d15d3079a766d729dd230b",
	"res://data/survival/recipes/recipes.json": "4dbf48da0dbb841bedd3333f0def33f328af4ed55c0e1f919b4a19cc3385539c",
	"res://data/survival/recipes/research.json": "6cca178ac00a99e4d2acfa441869331d325d9bb4d7d1637709b0692db5d512b2",
	"res://data/survival/recipes/stations.json": "aa05487252b8064729252994954eb73007fe525d2201f8aa725065dd0ee01851",
	"res://data/survival/connector/a0_legacy/world_source_bindings.c23292be.v3.json": "b1d291d035c9e543e69281da268b378c8e1bb498be561b2f15e67c840792b353",
}
const SCRIPTS := {
	"res://game/survival/economy/vendor/a3_economy_service.gd": "acbe03b0253f85a868d9ffdd115c8f33772f3789844fa604afd83344ce2933a7",
	"res://game/survival/economy/world_source_adapter.gd": "8bab244159e17acc34d51a22ab05112090e4f08f146511aa5c61683c7d999a47",
	"res://game/survival/economy/vendor/a3_world_source_c23292be.gd": "689a9b89dba4d756387b6b5c5f09b54d90ff0a787395f5e2fb523da496836efe",
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
