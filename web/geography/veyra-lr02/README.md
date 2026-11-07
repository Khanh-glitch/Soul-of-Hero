# MAP-LR02 checkpoint M0b — immutable input

Exact source branch `arena/2e3cfbd2-soul-of-hero` commit
`3c073d9da07b0ad936a57293a51dbba968a885dc`; files copied without edits from
`world_lab/lr02/output/greywater_spatial_patch.v1.json` and
`world_lab/lr02/docs/GAMEPLAY_HANDOFF.md`. Patch bytes SHA-256:
`2a9cfcc4360cd62088c4e938fa04f53a99aae6c0a8f2749580453869c502be78`.
The document's revision digest `db5bcc3dcf28210fa63e9a68cdf2128a7f76213bead7d1e975bbb901b50cfe1a`
is SHA-256 over `JSON.stringify` of the top-level object with `revisionDigest`
and `digestMethod` deleted, preserving field order. It refers to the unchanged
LR01 parent body digest `e3259eb30016f93ab0883c6dc3656f0ec1b9d47a85dc78fd90a56e0185765e63`.
`VERIFIED` denotes Map's geometry proof, not gameplay approval; the source's
transform, physical widths, runtime collision and dynamic doors remain proposed
or unknown. Do not edit these Map-owned artifacts.

Map M2 static eligibility was later copied unchanged from the same Map branch
HEAD `05f25672da61b4009f38c9a963e2652004dbdf51`, file
`world_lab/lr02/output/spawn_eligibility.v1.json`. Raw SHA-256
`377d5452579d638711bb41fbedcab5dafc98af2c17327a90ec954b8c277a19b9`,
body digest `637dd4e8706133773d1fe58643b74386a3832f7acbe5d00b5ec91ecc7a1573fc`.
It retains the same LR01 parent and 16 candidate-region cell sets. This is
static geographic eligibility, not a ready-made player location. Other new
Map packages at this head are not yet consumed by the Web runtime.
