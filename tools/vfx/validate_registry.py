#!/usr/bin/env python3
"""Static source registry validation. No visual-parity approval is inferred."""
import csv, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
catalog=json.loads((ROOT/"docs/vfx/gold_skill_registry.json").read_text(encoding="utf-8"))
with (ROOT/"docs/vfx/skill_port_matrix.csv").open(encoding="utf-8-sig",newline="") as f:
    source_rows=list(csv.DictReader(f))
errors=[]
items=catalog.get("skills",[])
keys=[x.get("key") for x in items]
if len(items)!=155 or len(source_rows)!=155 or len(set(keys))!=155:
    errors.append("Expected 155 unique manifest+audited entries")
if catalog["totals"]["authored_web_sources"]!=135 or catalog["totals"]["planned_not_implemented"]!=20:
    errors.append("Authored/PLANNED sources must be separated 135/20")
csv_ids={r["source"]+":"+str(int(r["id"])).zfill(3) for r in source_rows}
if set(keys)!=csv_ids:errors.append("Registry and source audit disagree")
gates=set(catalog["acceptance_gates"])
for s in items:
    k=s["key"]; state=s["original_state"]; evidence=s["evidence"]; g=s["gates"]
    if set(g)!=gates:errors.append(k+" missing gates")
    if len(evidence.get("source_sha256",""))!=64:errors.append(k+" source SHA not locked")
    if state=="PLANNED_NOT_IMPLEMENTED" and s["port_state"]!="source_not_implemented":
        errors.append(k+" fusion design incorrectly reported implemented")
    if s["port_state"] in ("integrated","production_ready") and not s["integration_approved"]:
        errors.append(k+" integrated flag without approval")
    env=s.get("environment_fx",{})
    audit=env.get("source_audit")
    if audit not in ("unassessed","source_verified_none","source_verified_present"):
        errors.append(k+" missing mandatory environment audit classification")
    if not isinstance(env.get("operations",[]),list):
        errors.append(k+" environmental source operations must be an array")
    if audit=="source_verified_none" and not env.get("source_none_audit_proof"):
        errors.append(k+" environment none asserted without original source audit evidence")
    if g.get("environment_parity")=="passed":
        if audit=="unassessed":
            errors.append(k+" illegal environment approval without per-skill gold source audit")
        elif audit=="source_verified_present" and (not env.get("operations") or
            env.get("real_map_adapter")!="verified" or
            env.get("persistence_and_cleanup")!="verified" or
            not env.get("gold_native_dynamic_evidence") or
            not env.get("regression_report")):
            errors.append(k+" missing real-map environmental evidence/cleanup")
    if s["gold_visual_acceptance"] or s["integration_approved"]:
        if not all(g.get(name)=="passed" for name in gates):errors.append(k+" approval without all seven completed gates")
        if audit=="unassessed" or (audit=="source_verified_present" and g.get("environment_parity")!="passed"):
            errors.append(k+" forbidden final approval without gold-authored environmental parity")
        if not (evidence["gold_frames"] and evidence["godot_frames"] and evidence["automated_comparison_report"] and evidence["runtime_report"]):
            errors.append(k+" approval without paired visual/native evidence")
if errors:
    for e in errors[:30]:print("GOLD_REGISTRY_ERROR:",e,file=sys.stderr)
    raise SystemExit(1)
print("GOLD_REGISTRY: PASS 155 entries = 135 authored + 20 planned; separate environment fidelity required, no false approvals")
