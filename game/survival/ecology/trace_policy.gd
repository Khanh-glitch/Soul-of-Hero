class_name SOHEcologyTracePolicy
extends RefCounted
## C08 provisional engineering tuning. These numbers are NOT Bible balance.
## The Bible locks causality (real movement -> local sensing -> contiguous
## evidence -> physical approach), not a canonical lifetime/radius. Until K2
## surface/weather adapters and playtest tuning are accepted, every surface uses
## the same conservative lifetime and no biome/rain multiplier is invented.

const STATUS := "PROVISIONAL_TUNING_NOT_CANON"
const SURFACE_UNAVAILABLE := "UNAVAILABLE"
const WEATHER_UNAVAILABLE := "UNAVAILABLE"

## Engineering bounds, not gameplay rewards.
const MAX_TRACES := 256
const SPATIAL_CELL := 64.0
const EMIT_DISTANCE := 12.0
const MAX_CONTIGUOUS_STEP := 24.0
const MAX_LINK_DISTANCE := 24.0
const BASE_LIFETIME_SECONDS := 90
const SENSE_RADIUS := 28.0
const SENSE_INTERVAL := 0.25
const SENSE_CANDIDATE_LIMIT := 24
const ARRIVE_DISTANCE := 7.0
const INVESTIGATE_TIMEOUT := 6.0
const STALL_TIMEOUT := 1.75
const NAV_MAX_EXPANSIONS := 4096
const NAV_MARGIN_CELLS := 8
const PERSIST_INTERVAL := 1.0

static func tuning_report() -> Dictionary:
	return {
		"status": STATUS,
		"max_traces": MAX_TRACES,
		"emit_distance_px": EMIT_DISTANCE,
		"max_contiguous_step_px": MAX_CONTIGUOUS_STEP,
		"base_lifetime_seconds": BASE_LIFETIME_SECONDS,
		"sense_radius_px": SENSE_RADIUS,
		"sense_interval_seconds": SENSE_INTERVAL,
		"surface_coefficients": "NONE_PENDING_K2_ADAPTER",
		"weather_multiplier": "NONE_PENDING_K2_ADAPTER",
	}
