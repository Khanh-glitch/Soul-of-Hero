# A4 skill attestation contract — SURV-030A E-03

Status: **STRICT INTERFACE + NATIVE FIXTURE NEGATIVES; REAL A4/GOLD ATTESTATION BLOCKED**. A3 did not edit A4 native FX, original Gold timing, enemy impacts, or terrain effects. Production catalog Cores remain `skill_readiness = BLOCKED_PENDING_A4`.

## Trust boundary

`commit_cast(instance_id, cast_id, expected_revision, cast_context)` no longer accepts a caller-supplied gate Callable. A0/A4 composition root injects a trusted attestor with `configure_skill_attestor(attestor)`. A3 cannot authenticate a Callable by itself; production safety depends on the producer being trusted, source-verified, and unreachable from untrusted UI.

A3 debits a Core charge only inside the SaveService transaction after the attestor returns a strict attestation bound to the exact cast context. A synthetic `{"ready": true}` dictionary is rejected.

## Catalog binding

A Core item may be castable only when:

```json
{
  "skill_readiness": "A4_VERIFIED",
  "verified_skill_binding": {
    "abstract_skill_id": "soh.core.venom",
    "original_skill_id": "<A4 verified original skill id>",
    "skill_version": "<A4 verified version>",
    "source_sha256": "<64 lowercase hex source archive/content hash>",
    "verification_evidence_id": "<A4 differential/evidence id>"
  }
}
```

Until A4 supplies real evidence, A3 data keeps `BLOCKED_PENDING_A4` and no binding. Native positive tests mutate only the adapter's in-memory catalog copy and label the original skill id `NATIVE_FIXTURE_NOT_GOLD`; this is not Gold parity.

## Attestation: `soh.economy.skill_attestation.v1`

The attestor receives a request containing contract, abstract/original skill id, skill version, source hash, evidence id, core item id, instance id, cast id, expected revision, gameplay boundary, context, and `context_sha256`. It must return a Dictionary with at least:

- `contract = soh.economy.skill_attestation.v1`
- `verification_status = A4_VERIFIED`
- `ready = true`
- `gameplay_boundary = authoritative_commit`
- matching `abstract_skill_id`, `original_skill_id`, `skill_version`, `source_sha256`, `verification_evidence_id`
- matching `core_item_id`, `instance_id`, `cast_id`, `expected_revision`
- matching `context_sha256`
- non-empty `gameplay_commit_token`

A3 rejects missing attestation, wrong version, wrong original/abstract id, wrong source hash, wrong evidence boundary, wrong context, wrong instance/revision, unverified status, empty commit token, and malformed source hash. SaveService replay binding rejects reused cast id with different payload and makes exact replay idempotent without a second debit.

## A4 obligations before production cast

- [ ] Verify original Gold skill source/version and differential behavior, including enemy impact and terrain/environment cues.
- [ ] Publish real `original_skill_id`, `skill_version`, `source_sha256`, and `verification_evidence_id`.
- [ ] Produce attestations only at the authoritative gameplay commit boundary, after gameplay authority decides the cast commits and before/with A3 charge debit.
- [ ] Bind `gameplay_commit_token` to the one cast action so a token cannot authorize a different cast.
- [ ] Keep A3 charge debit atomic with the gameplay commit; if gameplay commit fails, no charge is consumed.
- [ ] Independent reviewer confirms no synthetic readiness or source VFX edits.

## Native fixture evidence

The native suite proves default production catalog refusal, synthetic-ready refusal, missing/unverified/wrong-version/wrong-id/wrong-source/wrong-boundary/wrong-context/wrong-instance/wrong-revision/empty-token refusal, stale revision refusal, context-conflict refusal, exact replay idempotence, finite charge debit, and depleted-Core refusal.

This is **NATIVE_FIXTURE_PASS**, not A4 Gold verification.
