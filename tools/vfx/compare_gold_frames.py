#!/usr/bin/env python3
"""Compare gold/native frames using effect masks against paired no-effect baselines.
This is a component diagnostic, never whole-skill acceptance on its own.
Requires Pillow.
"""
import argparse, json, statistics, sys
from pathlib import Path
from PIL import Image
def check(case,root):
    required=("gold","native","gold_without_effect","native_without_effect","logical_resolution","simulation_tick","seed","thresholds")
    if any(k not in case for k in required):raise ValueError("Comparison case must lock gold/native/empty frames, viewport, simulation tick and thresholds")
    lim=case["thresholds"]
    if any(x not in lim for x in ("foreground_delta","foreground_iou_min","effect_mae_max","effect_p95_max","min_effect_pixels")):
        raise ValueError("Threshold fields cannot be inferred")
    if type(case["simulation_tick"]) is not int:raise ValueError("Use fixed integer 60Hz gold simulation ticks")
    frames=[Image.open(root/case[k]).convert("RGB") for k in required[:4]]
    size=tuple(case["logical_resolution"])
    if any(im.size!=size for im in frames):raise ValueError("Viewport/pixel resolution mismatch: no resizing")
    a,b,ag,bg=[list(im.getdata()) for im in frames]
    delta=lim["foreground_delta"]
    ma={i for i in range(len(a)) if max(abs(a[i][j]-ag[i][j]) for j in range(3))>delta}
    mb={i for i in range(len(a)) if max(abs(b[i][j]-bg[i][j]) for j in range(3))>delta}
    union=ma|mb
    errors=[abs(a[i][c]-b[i][c]) for i in union for c in range(3)]
    area_iou=len(ma&mb)/len(union) if union else 0.0
    roi_mae=statistics.fmean(errors) if errors else float("inf")
    p95=sorted(errors)[int((len(errors)-1)*.95)] if errors else float("inf")
    bgdiff=sum(max(abs(ag[i][c]-bg[i][c]) for c in range(3))>delta for i in range(len(a)))
    pass_state=(len(ma)>=lim["min_effect_pixels"] and len(mb)>=lim["min_effect_pixels"]
        and area_iou>=lim["foreground_iou_min"] and roi_mae<=lim["effect_mae_max"]
        and p95<=lim["effect_p95_max"] and bgdiff<=lim.get("max_baseline_mismatch_pixels",0))
    return {"name":case.get("name"),"simulation_tick":case["simulation_tick"],"seed":case["seed"],
      "gold_effect_pixels":len(ma),"native_effect_pixels":len(mb),"effect_iou":round(area_iou,5),
      "effect_roi_mae":round(roi_mae,5),"effect_p95":p95,"baseline_mismatch":bgdiff,"pass":pass_state}
def run(doc,root):
    if doc.get("schema_version")!=1 or not doc.get("cases"):raise ValueError("Empty/non-versioned evidence can never pass")
    rows=[check(c,root) for c in doc["cases"]]
    return {"pass":all(c["pass"] for c in rows),"comparisons":rows,"scope":"component-images-only"}
if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("manifest",type=Path)
    parser.add_argument("--report",type=Path)
    args=parser.parse_args()
    try:
        result=run(json.loads(args.manifest.read_text()),args.manifest.parent)
    except (OSError,ValueError) as err:
        print("GOLD_COMPARE_ERROR:",err,file=sys.stderr);raise SystemExit(2)
    payload=json.dumps(result,indent=2)
    if args.report:args.report.write_text(payload+"\n")
    print(payload);raise SystemExit(0 if result["pass"] else 1)
