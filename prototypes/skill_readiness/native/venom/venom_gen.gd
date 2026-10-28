class_name VenomGen
extends RefCounted

## The original skill bodies are JavaScript generators:
##
##     function* glassfang(c) { castAnim(w, c); yield 0.05; ... yield F; ... }
##
## driven by the world's task scheduler, which resumes one whenever its wait has
## elapsed and takes the resumed value as the NEXT wait. GDScript has no
## generators -- `yield`/`await` coroutines cannot be resumed by hand (4.7
## rejects a coroutine call without `await`, and `Callable.call()` on one
## returns null), so hand-building a per-skill state machine was the only option.
## That is slow to write and easy to get subtly wrong.
##
## This class implements the generator protocol exactly, with a thread:
##
##   * the body runs on its own thread and blocks inside `y(value)`;
##   * `resume()` lets it run to the next `y()` (or to completion) and returns
##     the value it yielded;
##   * the driver blocks for the whole time, so the body's access to the world,
##     the effect list and the particle system is strictly serialized -- never
##     concurrent -- and the result is bit-for-bit deterministic.
##
## The translated body is therefore a near-literal line-by-line port of the
## original, which is both faster to produce and far harder to get wrong.

const F: float = 1.0 / 60.0

signal _never

var _thread: Thread = null
var _resume_sem: Semaphore = null
var _done_sem: Semaphore = null
var _pending: float = F
var _finished: bool = false
var _started: bool = false
var _error: String = ""
var _disposed: bool = false
var _kill: bool = false
var _body: Callable = Callable()


func _init(body: Callable) -> void:
	_body = body
	_resume_sem = Semaphore.new()
	_done_sem = Semaphore.new()
	_thread = Thread.new()
	_started = true
	var err: int = _thread.start(_main)
	if err != OK:
		_started = false
		_finished = true
		push_error("VenomGen: thread start failed (%d)" % err)


## The generator body's `yield <seconds>`. Publishes the wait and blocks until
## the world's task scheduler resumes this generator.
func y(v = null) -> void:
	if v == null:
		_pending = F
	else:
		_pending = float(v)
	_done_sem.post()
	_resume_sem.wait()
	if _kill:
		# The world is being torn down: stop suspending so the body runs to its
		# end and the driver's `wait_to_finish()` returns instead of hanging.
		_pending = 0.0


## Runs the body to its next suspension point and returns what it yielded.
func resume():
	if _finished or not _started:
		return null
	_resume_sem.post()
	_done_sem.wait()
	if _finished:
		return null
	return _pending


func is_valid() -> bool:
	return _started and not _finished


## Tear the generator down. Safe to call on a generator that has already run to
## completion, on one that is suspended, or on one that never started. The body
## is drained first -- it is never left suspended on a thread that is discarded,
## and it is drained BEFORE the caller clears the world it is writing into.
func dispose() -> void:
	if _disposed:
		return
	_disposed = true
	if _thread == null:
		return
	if _started and _thread.is_started():
		_kill = true
		# Release the body if it is parked in `y()`; if it is parked on the
		# initial start gate this post simply carries over to the first wait.
		_resume_sem.post()
		while not _finished:
			_resume_sem.post()
			_done_sem.wait()
		_thread.wait_to_finish()
	_thread = null


func _main() -> void:
	# Do not run any of the body until the scheduler asks for the first value:
	# otherwise the body's first post would race the driver's first wait.
	_resume_sem.wait()
	if _body.is_valid():
		_body.call()
	_finished = true
	# A body that errored still has to release the driver, or the whole run
	# deadlocks instead of reporting the failure.
	_done_sem.post()


# ---------------------------------------------------------------------------
# Small helpers the translated bodies need, kept here so the ported code reads
# the same way the original does.
# ---------------------------------------------------------------------------

## The ORIGINAL `ticks(sec)`: `n = max(1, round(sec * 60))` and it yields
## `i / n` for i = 1..n -- note that it starts at 1/n, NOT at 0, and the body
## yields its own `F` once per iteration.
static func ticks(dur: float) -> Array:
	var n: int = maxi(1, int(roundf(dur * 60.0)))
	var out: Array = []
	for i in range(1, n + 1):
		out.append(float(i) / float(n))
	return out


## `yield* other(...)` -- run another generator to completion inline.
func delegate(other) -> void:
	while other.is_valid():
		var v = other.resume()
		if v == null:
			break
		y(v)
