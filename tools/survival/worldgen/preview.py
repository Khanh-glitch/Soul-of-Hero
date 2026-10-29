"""Render authored SURV-050A previews from the compiled plan (Pillow).

Run: .venv/bin/python tools/survival/worldgen/preview.py
Outputs docs/survival/world/previews/*.png + preview_manifest.json.
These are authored design previews, not native Godot screenshots.
"""
from __future__ import annotations
import hashlib, json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import authoring as A
from validate_world import load, reconstruct, OUT

ROOT = Path(__file__).resolve().parents[3]
PRE = ROOT / "docs" / "survival" / "world" / "previews"
SCALE = 2
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONTB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

def font(sz, bold=False):
    try: return ImageFont.truetype(FONTB if bold else FONT, sz)
    except Exception: return ImageFont.load_default()

def base_image(plan, layer, colors, default=(24,26,30)):
    w,h = plan["frame"]["w"], plan["frame"]["h"]
    vals = reconstruct(plan, layer)
    img = Image.new("RGB", (w*SCALE, h*SCALE))
    px = img.load()
    for y in range(h):
        for x in range(w):
            v = vals[y*w+x]
            c = colors.get(v, default) if v else default
            for dy in range(SCALE):
                for dx in range(SCALE):
                    px[x*SCALE+dx, y*SCALE+dy] = c
    return img

def region_colors(plan):
    palette = [(120,88,70),(96,132,168),(126,150,158),(150,104,72),(196,164,92),(70,122,78),(58,128,110),(104,142,86),(122,100,140),(88,104,72),(74,92,96)]
    return {i+1: palette[i % len(palette)] for i in range(len(plan["regions"]))}

def biome_colors(plan):
    return {i+1: tuple(plan["biomes"][name]["color"]) for i,name in enumerate(sorted(plan["biomes"]))}

def draw_regions(draw, plan):
    f = font(18, True)
    for r in plan["regions"]:
        x,y,w,h = r["rect"]
        draw.rectangle([x*SCALE,y*SCALE,(x+w)*SCALE-1,(y+h)*SCALE-1], outline=(245,245,235), width=2)
        draw.text((x*SCALE+8, y*SCALE+6), r["name"], font=f, fill=(250,250,240), stroke_width=2, stroke_fill=(20,20,20))
        draw.text((x*SCALE+8, y*SCALE+28), f"{r['band']} • {r['region_id']}", font=font(13), fill=(235,235,220), stroke_width=1, stroke_fill=(20,20,20))

def draw_routes(draw, plan, width=3):
    for e in plan["route_graph"]["edges"]:
        pts = [(x*SCALE, y*SCALE) for x,y in e["polyline"]]
        col = (240,210,120) if e["kind"]=="trunk" else (180,180,170)
        if e["mode"]=="boat": col=(120,190,230)
        draw.line(pts, fill=col, width=width if e["kind"]=="trunk" else 1)
    for n in plan["route_graph"]["nodes"]:
        if n["kind"]!="hub": continue
        x,y=n["cell"]; draw.ellipse([x*SCALE-5,y*SCALE-5,x*SCALE+5,y*SCALE+5], fill=(255,235,150), outline=(40,30,10), width=2)

def draw_pois(draw, plan, labels=False):
    band_col={"early":(120,220,140),"mid":(240,200,90),"late":(235,110,120)}
    for p in plan["pois"]:
        x,y=p["cell"]; x*=SCALE; y*=SCALE
        if p["preserved_legacy"]:
            draw.rectangle([x-5,y-5,x+5,y+5], fill=(255,255,255), outline=(20,20,20), width=2)
            if labels: draw.text((x+7,y-6), p["poi_id"], font=font(11), fill=(255,255,255), stroke_width=1, stroke_fill=(0,0,0))
            continue
        c=band_col[p["band"]]
        r=5 if p.get("core_family_contract") or p["grants_capabilities"] else 3
        draw.ellipse([x-r,y-r,x+r,y+r], fill=c, outline=(20,20,20), width=1)
        if labels and (p.get("core_family_contract") or p["grants_capabilities"] or p["archetype"] in ("settlement","outpost","drydock")):
            draw.text((x+6,y-5), p["name"], font=font(11), fill=(250,250,240), stroke_width=1, stroke_fill=(15,15,15))

def draw_hydrology(draw, plan):
    f=font(13,True)
    for r in plan["rivers"]:
        pts=[(x*SCALE,y*SCALE) for x,y,_ in r.get("meander_vertices", r["vertices"])]
        draw.line(pts, fill=(90,170,235), width=3)
        mx,my=pts[len(pts)//2]
        draw.text((mx+4,my), r["river_id"], font=f, fill=(170,220,255), stroke_width=1, stroke_fill=(10,20,40))
    for l in plan["lakes"]:
        cx,cy=l["center"]; rx,ry=l["rx"]*SCALE,l["ry"]*SCALE
        draw.ellipse([cx*SCALE-rx,cy*SCALE-ry,cx*SCALE+rx,cy*SCALE+ry], outline=(140,210,255), width=3)
        draw.text((cx*SCALE-30,cy*SCALE), l["lake_id"], font=f, fill=(200,235,255), stroke_width=1, stroke_fill=(10,20,40))

def save(img, name):
    PRE.mkdir(parents=True, exist_ok=True)
    p=PRE/name; img.save(p); return p

def main():
    plan=load()
    paths=[]
    # Biome
    img=base_image(plan,"biome",biome_colors(plan)); d=ImageDraw.Draw(img)
    draw_regions(d,plan); draw_routes(d,plan,2); draw_pois(d,plan,False)
    paths.append(save(img,"continent_biome.png"))
    # Elevation
    elev=reconstruct(plan,"elevation_band"); pres=reconstruct(plan,"preserved")
    w,h=plan["frame"]["w"],plan["frame"]["h"]
    img=Image.new("RGB",(w*SCALE,h*SCALE)); px=img.load()
    ramp=[(38,70,110),(70,120,150),(110,160,140),(170,190,120),(210,190,110),(190,140,90),(160,100,80),(200,200,210),(245,245,250)]
    for y in range(h):
        for x in range(w):
            i=y*w+x
            c=(70,70,74) if pres[i] else ramp[min(len(ramp)-1, elev[i]//3)]
            for dy in range(SCALE):
                for dx in range(SCALE): px[x*SCALE+dx,y*SCALE+dy]=c
    d=ImageDraw.Draw(img); draw_regions(d,plan)
    d.text((12, h*SCALE-30), "Grey = preserved legacy inset (elevation UNKNOWN, not fabricated). Tint = 50 m bands.", font=font(15), fill=(255,255,255), stroke_width=1, stroke_fill=(0,0,0))
    paths.append(save(img,"continent_elevation.png"))
    # Hydrology
    img=base_image(plan,"biome",{i+1:(40,44,48) for i in range(len(plan["biomes"]))}); d=ImageDraw.Draw(img)
    bio=reconstruct(plan,"biome"); names=sorted(plan["biomes"])
    px=img.load()
    for y in range(h):
        for x in range(w):
            b=names[bio[y*w+x]-1]
            if b in ("riverine","lake","ocean"):
                c=(70,140,210) if b!="ocean" else (30,60,100)
                for dy in range(SCALE):
                    for dx in range(SCALE): px[x*SCALE+dx,y*SCALE+dy]=c
    draw_regions(d,plan); draw_hydrology(d,plan)
    paths.append(save(img,"continent_hydrology.png"))
    # Routes
    img=base_image(plan,"region",region_colors(plan)); d=ImageDraw.Draw(img)
    draw_routes(d,plan,4); draw_pois(d,plan,True); draw_regions(d,plan)
    paths.append(save(img,"continent_routes.png"))
    # POIs
    img=base_image(plan,"biome",biome_colors(plan)); d=ImageDraw.Draw(img)
    draw_regions(d,plan); draw_pois(d,plan,True)
    for s in plan["resource_sites"]:
        x,y=s["center"]; x*=SCALE;y*=SCALE
        d.rectangle([x-3,y-3,x+3,y+3], outline=(255,255,255), width=1)
    paths.append(save(img,"continent_pois.png"))
    # Starter quarter detail
    sq=plan["starter_quarter"]; x0,y0,ww,hh=sq["x"],sq["y"],sq["w"],sq["h"]
    full=base_image(plan,"biome",biome_colors(plan)); crop=full.crop((x0*SCALE,y0*SCALE,(x0+ww)*SCALE,(y0+hh)*SCALE)).resize((ww*3,hh*3), Image.Resampling.NEAREST)
    d=ImageDraw.Draw(crop); f=font(16,True)
    d.rectangle([0,0,A.LEGACY["w"]*3,A.LEGACY["h"]*3], outline=(255,255,255), width=3)
    d.text((8,8),"Preserved legacy inset 384×256",font=f,fill=(255,255,255),stroke_width=1,stroke_fill=(0,0,0))
    for s in plan["legacy_seam_carves"]:
        a,b,c,e=s["carve"]; d.rectangle([a*3,b*3,c*3,e*3], outline=(255,220,80), width=3)
        d.text((a*3,b*3-16),s["id"],font=font(12),fill=(255,230,120),stroke_width=1,stroke_fill=(0,0,0))
    for p in plan["pois"]:
        x,y=p["cell"]
        if not (x0<=x<x0+ww and y0<=y<y0+hh): continue
        x=(x-x0)*3; y=(y-y0)*3
        if p["preserved_legacy"]:
            d.rectangle([x-5,y-5,x+5,y+5],fill=(255,255,255),outline=(0,0,0),width=2)
            d.text((x+7,y-6),p["name"],font=font(11),fill=(255,255,255),stroke_width=1,stroke_fill=(0,0,0))
        else:
            d.ellipse([x-4,y-4,x+4,y+4],fill=(120,220,140),outline=(0,0,0),width=1)
            d.text((x+6,y-5),p["name"],font=font(11),fill=(240,255,240),stroke_width=1,stroke_fill=(0,0,0))
    paths.append(save(crop,"starter_quarter_detail.png"))
    # First-hour hazard bootstrap detail
    x0,y0,ww,hh = 0,120,520,420
    full=base_image(plan,"biome",biome_colors(plan))
    crop=full.crop((x0*SCALE,y0*SCALE,(x0+ww)*SCALE,(y0+hh)*SCALE)).resize((ww*2,hh*2), Image.Resampling.NEAREST)
    d=ImageDraw.Draw(crop)
    def L(x,y): return ((x-x0)*2,(y-y0)*2)
    haz_cols={"hz_crown_heat":(230,120,60,110),"hz_crown_rot":(150,200,70,110),"hz_crown_cold":(120,190,230,90)}
    overlay=Image.new("RGBA",crop.size,(0,0,0,0)); od=ImageDraw.Draw(overlay)
    for hz in plan["hazards"]:
        hx,hy,hw,hh2=hz["rect"]
        if hx>x0+ww or hy>y0+hh or hx+hw<x0 or hy+hh2<y0: continue
        a=L(hx,hy); b=L(hx+hw,hy+hh2)
        od.rectangle([a,b],fill=haz_cols.get(hz["hazard_id"],(235,90,90,90)))
        od.text((a[0]+4,a[1]+4),hz["hazard_id"],font=font(12,True),fill=(255,255,255,230))
    crop=Image.alpha_composite(crop.convert("RGBA"),overlay).convert("RGB"); d=ImageDraw.Draw(crop)
    edges={e["route_id"]:e for e in plan["route_graph"]["edges"]}
    for rid,col,width in [("rt_east_seam",(235,80,80),3),("rt_crown_safe_approach",(90,230,140),4),("rt_south_seam",(90,230,140),3)]:
        pts=[L(x,y) for x,y in edges[rid]["polyline"]]
        d.line(pts,fill=col,width=width)
    for pid,label in [("poi_crown_waystation","Ashen Waystation"),("poi_crown_relay_shed","Crown Relay Shed"),("poi_amberwood_apothecary","Orchard Apothecary")]:
        p=next(q for q in plan["pois"] if q["poi_id"]==pid); x,y=L(*p["cell"])
        d.ellipse([x-6,y-6,x+6,y+6],fill=(255,235,150),outline=(20,20,20),width=2)
        d.text((x+8,y-6),label,font=font(13,True),fill=(255,255,240),stroke_width=1,stroke_fill=(0,0,0))
    d.text((8,8),"First-hour bootstrap: green safe preparation/retreat; red filter-gated hazard shortcut.",font=font(15,True),fill=(255,255,255),stroke_width=1,stroke_fill=(0,0,0))
    d.text((8,30),"Authored hazard rects are preserved. Native damage/mitigation is A0/A3 contract, not playtested.",font=font(12),fill=(240,240,230),stroke_width=1,stroke_fill=(0,0,0))
    paths.append(save(crop,"novice_bootstrap_detail.png"))
    # Region panels
    cols=3; panel_w=520; panel_h=360; rows=math.ceil(len(plan["regions"])/cols)
    sheet=Image.new("RGB",(cols*panel_w, rows*panel_h),(18,20,24)); sd=ImageDraw.Draw(sheet)
    biome_full=base_image(plan,"biome",biome_colors(plan))
    for i,r in enumerate(plan["regions"]):
        x,y,w,h=r["rect"]; crop=biome_full.crop((x*SCALE,y*SCALE,(x+w)*SCALE,(y+h)*SCALE))
        crop.thumbnail((panel_w-20, panel_h-110))
        px=(i%cols)*panel_w; py=(i//cols)*panel_h
        sheet.paste(crop,(px+10,py+70))
        sd.rectangle([px,py,px+panel_w-1,py+panel_h-1],outline=(70,74,80),width=1)
        sd.text((px+10,py+8),r["name"],font=font(18,True),fill=(245,245,235))
        sd.text((px+10,py+32),f"{r['band']} • {r['region_id']} • elev {r['base_elevation_m']} m",font=font(13),fill=(200,205,210))
        n=sum(1 for p in plan["pois"] if p["region_id"]==r["region_id"] and not p["preserved_legacy"])
        sd.text((px+10,py+50),f"POIs {n} • materials {', '.join(r['material_keys'][:5])}",font=font(12),fill=(180,220,190))
    paths.append(save(sheet,"region_panels.png"))
    # Capability graph
    caps=plan["capabilities"]; order=sorted(caps, key=lambda c:(len(caps[c].get("requires",[])),c))
    W,H=1500,900; img=Image.new("RGB",(W,H),(18,20,24)); d=ImageDraw.Draw(img)
    pos={}
    tiers={}
    for c in caps:
        t=len(caps[c].get("requires",[])); tiers.setdefault(t,[]).append(c)
    for t,cs in sorted(tiers.items()):
        for j,c in enumerate(cs):
            pos[c]=(140+t*360, 90+j*120)
    for c,(x,y) in pos.items():
        for r in caps[c].get("requires",[]):
            if r in pos:
                x2,y2=pos[r]; d.line([(x2+120,y2+20),(x,y+20)],fill=(110,120,130),width=2)
    for c,(x,y) in pos.items():
        d.rounded_rectangle([x,y,x+250,y+64],radius=8,fill=(40,48,58),outline=(150,180,200),width=2)
        d.text((x+10,y+8),c,font=font(16,True),fill=(240,245,250))
        d.text((x+10,y+32),"src "+caps[c].get("source","?"),font=font(11),fill=(180,210,190))
    d.text((20,H-40),"Capability preparation graph (A1 contract). Equipment/credential/power gates; not arbitrary level walls.",font=font(15),fill=(220,220,210))
    paths.append(save(img,"capability_graph.png"))
    manifest={"schema":"soh.world.previews.v1","status":"AUTHORED_PREVIEW_NOT_NATIVE_SCREENSHOT","files":[{"path":str(p.relative_to(ROOT)),"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size} for p in paths]}
    (PRE/"preview_manifest.json").write_text(json.dumps(manifest,indent=2,sort_keys=True)+"\n")
    print(json.dumps({"ok":True,"previews":[str(p.relative_to(ROOT)) for p in paths]},indent=2))

if __name__=="__main__":
    main()
