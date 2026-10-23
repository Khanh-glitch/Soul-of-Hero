#!/usr/bin/env python3
"""Gate 1 G1-B: derive a reversible architectural archive bay, never edit data/."""
import argparse
import copy
import hashlib
import json
from collections import deque
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/"prototypes/gate0/level_data/chapter_1_level_3_a.json"
ATLAS=ROOT/"prototypes/gate0/art/props.json"
OUT_LEVEL=ROOT/"prototypes/gate1/trial_level3.json"
OUT_ART=ROOT/"prototypes/gate1/trial_art.json"
PIN="5ea50e9cf37791a6283bfd9a58bd634ec8aa144e9602c5b9f40f0b4600555f54"
T=16
FURNITURE=[
 ("copyist","desk",240,224,True),
 ("reading_niche","reading_table",136,256,True),
 ("damaged_stack","shelf_collapsed",184,320,True),
 ("long_board","long_table",256,320,True),
 ("bench","bench",304,352,True),
 ("scroll","scroll_roll",408,208,False),
 ("armarium","armarium_open",480,384,True),
 ("bay_desk","desk",456,448,True),
 ("abandoned_seat","stool_tipped",472,464,False),
 ("catalogue","lectern",528,448,True),
 ("books","book_stack",536,464,False),
 ("collapse","rubble_large",408,448,True),
 ("fallen_beam","beam",416,448,False),
]
def read(p): return json.loads(p.read_text(encoding="utf-8"))
def encode(v): return json.dumps(v,indent=2,ensure_ascii=False)+"\n"
def cell(x,y,ax=1,ay=4): return dict(x=x,y=y,source=0,atlas=[ax,ay],alternative=0)
def coord(c): return (c["x"],c["y"])
def mapping(cells): return {coord(c):copy.deepcopy(c) for c in cells}
def sorted_cells(cells): return [cells[k] for k in sorted(cells,key=lambda p:(p[1],p[0]))]
def usable(doc):
 b={coord(v) for v in doc["layers"]["Backdrop"]}
 g={coord(v) for v in doc["layers"]["Geometry"]}
 return b-g
def reach(cells,origin):
 if origin not in cells: return set()
 visited={origin}; queue=deque([origin])
 while queue:
  x,y=queue.popleft()
  for c in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
   if c in cells and c not in visited:
    visited.add(c);queue.append(c)
 return visited
def rects_overlap(a,b,pad=0):
 return not (a[2]+pad<=b[0] or b[2]+pad<=a[0] or a[3]+pad<=b[1] or b[3]+pad<=a[1])
def entity_rect(e):
 w,h,anchor={"player":(32,32,"center"),"torch":(32,32,"base"),
 "coin":(24,24,"center"),"spikes":(32,32,"center"),
 "floor_door":(32,32,"center"),"exit_gate":(32,48,"base"),
 "sigil":(32,32,"center")}.get(e["type"],(32,32,"base"))
 x,y=e["position"];top=y-h if anchor=="base" else y-h/2
 return (x-w/2,top,x+w/2,top+h)
def construct(base):
 out=copy.deepcopy(base)
 b=mapping(out["layers"]["Backdrop"])
 g=mapping(out["layers"]["Geometry"])
 d=mapping(out["layers"]["Decor"])
 edited=set()
 def floor(x,y):
  edited.add((x,y));g.pop((x,y),None);d.pop((x,y),None);b[(x,y)]=cell(x,y)
 def wall(x,y,cap=False):
  edited.add((x,y));b.pop((x,y),None);d.pop((x,y),None)
  g[(x,y)]=cell(x,y,2,0 if cap else 1)
 # The passage (25,20)->(26,21)->(26,22) preserves the old route.
 # The 136x64 armarium will stand at (496,384), against three stone courses.
 for y in range(22,29):
  for x in range(24,37): floor(x,y)
 for x in (25,26):
  for y in (20,21):floor(x,y)
 for y in range(19,22):
  for x in range(27,35):wall(x,y,y==19)
 for y in range(23,29):wall(23,y,y==23)
 for y in range(22,29):
  for x in (35,36):wall(x,y,y==22)
 for x in range(23,38):wall(x,29,True)
 for name,m in (("Backdrop",b),("Geometry",g),("Decor",d)):
  out["layers"][name]=sorted_cells(m)
 assert all(23<=x<=37 and 19<=y<=29 for x,y in edited)
 return out,edited
def artwork(doc):
 frames=read(ATLAS)["frames"]; floor=usable(doc)
 props=[]; solids=[]
 for ident,name,x,y,solid in FURNITURE:
  fr=frames[name]; w=fr["w"];h=fr["h"]
  draw=(x-w/2,y-h,x+w/2,y);width=w*0.86
  collider=(x-width/2,y-12,x+width/2,y)
  for cx in range(int(draw[0]//T),int((draw[2]-.001)//T)+1):
   assert (cx,int((y-.001)//T)) in floor,(ident,"unsupported base",cx)
  for e in doc["entities"]:
   assert not rects_overlap(draw,entity_rect(e),4),(ident,"entity art",e["id"])
  if solid:
   for cx in range(int(collider[0]//T),int((collider[2]-.001)//T)+1):
    for cy in range(int(collider[1]//T),int((collider[3]-.001)//T)+1):
     assert (cx,cy) in floor,(ident,"collider not on floor",(cx,cy))
   for sid,other in solids:
    assert not rects_overlap(other,collider),(ident,"overlaps",sid)
   solids.append((ident,collider))
  props.append(dict(id="g1_"+ident,sprite=name,x=x,base_y=y,
   source=[fr[k] for k in ("x","y","w","h")],solid=solid,
   collider=[x,y-6,round(width,3),12],
   provenance="Candidate B e7cad36 original atlas"))
 floors=[]
 for y in range(22,29):
  for x in range(24,37):
   tile=(5+(x-24)%2) if x<=26 else (4 if y in (25,26) and 28<=x<=35 else (x-27)%4)
   floors.append([x,y,tile,0])
 walls={(x,y) for y in range(19,22) for x in range(27,35)}
 walls|={(23,y) for y in range(23,29)}
 walls|={(x,y) for y in range(22,29) for x in (35,36)}
 walls|={(x,29) for x in range(23,38)}
 caps=[];faces=[]
 for x,y in sorted(walls,key=lambda p:(p[1],p[0])):
  if y in (19,29) or (x,y) in ((23,23),(35,22),(36,22)):caps.append([x,y,3])
  else:faces.append([x,y,2 if y==21 else (x+y)%2,1])
 return dict(version=1,target_level="res://data/levels/chapter_1_level_3.json",
  trial_map="res://prototypes/gate1/trial_level3.json",base_sha256=PIN,
  atlas="res://prototypes/gate0/art/archive_props.png",
  tile_atlas="res://prototypes/gate1/art/archive_tiles.png",
  cap_atlas="res://prototypes/gate1/art/wall_caps.png",
  light_texture="res://prototypes/gate1/art/light_radial.png",
  modulate=[0.9,0.87,0.87,1.0],collision_layer=1,
  props=props,visual=dict(floors=floors,faces=faces,caps=caps),
  lights=[dict(x=480,y=346,energy=0.75,scale=2.0,color=[1,0.76,0.49])])
def verify(base,trial,art,changed):
 assert trial["entities"]==base["entities"] and len(trial["entities"])==79
 assert (trial["width"],trial["height"])==(116,96)
 for name in ("Backdrop","Geometry","Decor"):
  before=mapping(base["layers"][name]);after=mapping(trial["layers"][name])
  assert all(k in changed for k in before.keys()|after.keys() if before.get(k)!=after.get(k))
 assert all(c["source"] in (0,1) for layer in trial["layers"].values() for c in layer)
 old=reach(usable(base),(17,13));new=reach(usable(trial),(17,13))
 assert old<=new,("sealed existing route",len(old-new))
 start=(17,13);target=(31,26)
 floors=usable(trial);block=set()
 for prop in art["props"]:
  if not prop["solid"]:continue
  x,y,w,h=prop["collider"]
  for cx in range(int((x-w/2)//T),int((x+w/2-.001)//T)+1):
   for cy in range(int((y-h/2)//T),int((y+h/2-.001)//T)+1):
    block.add((cx,cy))
 safe={p for p in floors-block if (p[0],p[1]-1) in floors-block}
 assert target in reach(safe,start),("Knight cannot reach side bay",target)
 assert any(p["sprite"]=="armarium_open" for p in art["props"])
 print("GATE1 G1-B VALIDATION PASSED",json.dumps(dict(
  entities=79,edited_cells=len(changed),original_reachable=len(old),
  trial_reachable=len(new),added_walkable=len(floors-usable(base)),
  props=len(art["props"]),solids=sum(p["solid"] for p in art["props"]),
  destination=list(target)),ensure_ascii=False))
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--check",action="store_true")
 args=ap.parse_args()
 digest=hashlib.sha256(SOURCE.read_bytes()).hexdigest()
 assert digest==PIN,("Candidate A SHA256 mismatch",digest)
 b=read(SOURCE);t,changed=construct(b);a=artwork(t);verify(b,t,a,changed)
 for path,obj in ((OUT_LEVEL,t),(OUT_ART,a)):
  body=encode(obj)
  if args.check:assert path.read_text(encoding="utf-8")==body,("stale",path)
  else:
   path.parent.mkdir(parents=True,exist_ok=True)
   path.write_text(body,encoding="utf-8")
 print("GATE1 G1-B "+("CHECK OK" if args.check else "GENERATED")+
       "; canonical data/, game/ and tests/ unchanged")
if __name__=="__main__":main()
