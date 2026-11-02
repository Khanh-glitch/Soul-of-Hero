"""Build bounded, genuine 1x evidence from a live capture already on the runner.

Each contact sheet contains six unscaled 1280x720 viewport images. Captions
occupy separate black bars; no overlays or fabricated pixels enter a frame.
PNG originals and lossless recording are untouched. tick is last observed and
can lag the displayed frame, exactly as disclosed in timeline.json.
"""
import json
import pathlib
import sys
from PIL import Image, ImageDraw

root = pathlib.Path(sys.argv[1])
out = pathlib.Path(sys.argv[2])
sha = sys.argv[3]
record = json.loads((root / 'timeline.json').read_text())
frames = record['frames']
roles = {19:'D Constellation Engine with authored OUT extension', 4:'Ashen Guillotine N redesign', 6:'Riptide N redesign', 12:'Skybreaker N redesign', 13:'Rootwake N redesign', 14:'Spore Nebula N redesign', 18:'Chronoshard N redesign',
         1:'A Cinder Crown plus C outer flame', 2:'B Pyre Wyrm', 3:'B Meteor Loom', 7:'C Mirrorfrost Basilica',
         8:'B Undertow Maw', 9:'A graph B palette C lightning', 10:'C Thunderloom', 11:'A rotor C09 lightning', 15:'C Thorn Opera', 16:'A growth C material organism debris', 17:'C Event Horizon', 20:'C rift A world warp and debris'}
skill = int(record['skill'])
if skill not in roles or len(frames) < 2:
    raise SystemExit('Expected supported S, F, N or D capture with at least two actual captured frames')
light = record['lighting']
# Baseline and OUT come from the actual first and last frames. Intermediate
# ticks deliberately span the cast rather than selecting only pretty beats.
# A given software-rendered capture may skip a requested tick.
fractions = (0.17, 0.50, 0.70, 0.88)
indices = [0] + [min(range(1, len(frames)-1), key=lambda i: abs(frames[i]['source_tick_last_observed'] - record['last_tick']*v)) for v in fractions] + [len(frames)-1]
out.mkdir(parents=True, exist_ok=True)
sheet = Image.new('RGB', (3840, 2*752), 'black')
draw = ImageDraw.Draw(sheet)
entries=[]
for n, index in enumerate(indices):
    frame = frames[index]
    image = Image.open(root / frame['file']).convert('RGB')
    if image.size != (1280,720):
        raise SystemExit(f'Expected unscaled 1280x720 frame, got {image.size}')
    label = ('start','early','middle','late','aftermath','OUT')[n]
    name=f'{n:02d}_{label}_tick{frame["source_tick_last_observed"]}.jpg'
    image.save(out / name, 'JPEG', quality=58, subsampling=2, optimize=True)
    x, y = (n%3)*1280, (n//3)*752
    sheet.paste(image,(x,y))
    line=(f'#{skill:02d} {roles[skill]} {light} {label} | frame {index} '
          f'tick~{frame["source_tick_last_observed"]} wall={frame["wall_s"]:.3f}s')
    draw.text((x+5,y+725),line,fill='white')
    entries.append({**frame, 'source_png':frame['file'], 'label':label, 'index':index, 'file':name})
sheet.save(out / f'sheet_{skill:02d}_{light}.jpg','JPEG',quality=43,optimize=True,progressive=True)
meta={'avfx_sha':sha, 'skill':skill, 'source_role':roles[skill], 'lighting':light,
      'scope':record['scope'], 'resolution':'1280x720 each, 1x pixels before JPEG encoding',
      'source_tick_note':record['capture_timestamp_note'], 'cast_duration_s':record['cast_duration_s'],
      'last_tick':record['last_tick'], 'entries':entries,
      'cast_target_world':record.get('cast_target_world'),
      'note':'OUT is captured after finish; no assumption of hit, actor depth or production HDR.'}
(out / 'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
print(f'BATCH_S_REVIEW skill={skill:02} lighting={light} frames={len(frames)} selected={indices} sheet_bytes={(out / f"sheet_{skill:02d}_{light}.jpg").stat().st_size}')

# #15 source-to-world mount as implemented by CSourcePlayer. This records
# cast-point and moving-caster coordinates, not synthetic enemy contacts.
# Recompute from the actual recorded target/initial caster; roots/tips/petals
# are time-dependent so these bounds do not claim the entire art was visible.
if skill == 15 and record.get('cast_target_world') is not None:
    import math
    initial = frames[0]['player']
    target = record['cast_target_world']
    dx, dy = target[0]-initial[0], target[1]-initial[1]
    length = math.hypot(dx,dy)
    source_axis = (140.0,-14.0)
    angle = math.atan2(dy,dx)-math.atan2(source_axis[1],source_axis[0]) if length > 1 else 0.0
    scale = min(3.5,max(0.6,length/math.hypot(*source_axis))) if length > 1 else 1.0
    co,si=math.cos(angle),math.sin(angle)
    def local(world):
        vx=(world[0]-initial[0])/scale; vy=(world[1]-initial[1])/scale
        return [112.0+vx*co+vy*si, 126.0-vx*si+vy*co]
    def edge(point):
        x,y=point
        return min(x,y,384.0-x,216.0-y)
    focus=local(target)
    shift=(focus[0]-252.0,focus[1]-112.0)
    # Tiny shifts under the actual 0.001 threshold are deliberately ignored.
    if math.hypot(*shift) <= 0.001: shift=(0.0,0.0)
    targets=[[x+shift[0],y+shift[1]] for x,y in ((262,106),(306,156),(214,164),(312,62))]
    meta['thorn_raster_geometry']={'source_size':[384,216], 'cast_caster_world_approx':initial,
        'cast_target_world':target, 'source_to_world_scale':scale,'source_to_world_rotation_radians':angle,
        'source_focus':focus,'focus_margin_px':edge(focus), 'source_targets':targets,
        'target_margin_px':[edge(t) for t in targets],
        'selected_caster_source_positions':[local(e['player']) for e in entries],
        'selected_caster_margin_px':[edge(local(e['player'])) for e in entries],
        'limitations':'Baseline caster is sampled just before the cast, not a presentation fence. Points only; not root width, lash, flower, petal or actual rendered-edge coverage.'}
    (out / 'metadata.json').write_text(json.dumps(meta,indent=2)+'\n')
