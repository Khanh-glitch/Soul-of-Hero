class_name A6TimeFormat
extends RefCounted

## Wording for durations and dates on the survival return UI.
##
## Everything is rounded *down*, so the number on screen is always a lower bound:
## "còn 3 ngày" must never appear when 2 days 20 hours remain. The season clock is
## the one countdown a player plans around, so optimistic rounding is a bug.

const DAY_SECONDS := 86400
const HOUR_SECONDS := 3600
const MINUTE_SECONDS := 60


## Remaining run time, collapsed to the two most significant units.
static func countdown(seconds: int) -> String:
	var total := maxi(0, seconds)
	if total <= 0:
		return "0 phút"
	var days := total / DAY_SECONDS
	var hours := (total % DAY_SECONDS) / HOUR_SECONDS
	var minutes := (total % HOUR_SECONDS) / MINUTE_SECONDS
	if days > 0:
		if hours > 0:
			return "%d ngày %d giờ" % [days, hours]
		return "%d ngày" % days
	if hours > 0:
		if minutes > 0:
			return "%d giờ %d phút" % [hours, minutes]
		return "%d giờ" % hours
	return "%d phút" % maxi(1, minutes)


## Time spent away while the app was closed.
static func away(seconds: int) -> String:
	var total := maxi(0, seconds)
	if total < HOUR_SECONDS:
		return "%d phút" % maxi(1, total / MINUTE_SECONDS)
	if total < DAY_SECONDS:
		return "%d giờ" % (total / HOUR_SECONDS)
	var days := total / DAY_SECONDS
	var hours := (total % DAY_SECONDS) / HOUR_SECONDS
	if hours > 0:
		return "%d ngày %d giờ" % [days, hours]
	return "%d ngày" % days


## "12/11" style calendar date from a unix timestamp (UTC, matching D055's clock).
static func day_month(unix_seconds: int) -> String:
	if unix_seconds <= 0:
		return ""
	var date := Time.get_datetime_dict_from_unix_time(unix_seconds)
	return "%d/%d" % [int(date.get("day", 1)), int(date.get("month", 1))]


## Ordinal helper for the history list: how long a finished season lasted.
static func season_length(started: int, ended: int) -> String:
	if started <= 0 or ended <= started:
		return ""
	return away(ended - started)
