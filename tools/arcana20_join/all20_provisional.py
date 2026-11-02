#!/usr/bin/env python3
"""Collect bounded native-cadence review copies; preserve original provenance.

Input folders are downloaded Actions artifacts and checked-in R27 captures.
All movies are real 1280x720 world captures, not same-SHA evidence unless
explicitly marked. Contact sheets sample the compressed movie, never a mock.
"""
import hashlib, json, pathlib, shutil, subprocess, sys
from PIL import Image, ImageDraw

root = pathlib.Path(sys.argv[1]); repo = pathlib.Path(sys.argv[2]); sha = sys.argv[3]
evidence = root / 'evidence'; evidence.mkdir(parents=True, exist_ok=True)
rows=[]
def pick_one(root, pattern):
    files=list(root.rglob(pattern))
    if len(files)!=1: raise SystemExit(f'Expected one {pattern} under {root}, got {len(files)}')
    return files[0]
def save_record(skill, variant, light, movie, metadata, capture_sha, origin, sheet=None):
    out=evidence/f'{skill:02d}_{variant}_{light}';out.mkdir(parents=True)
    shutil.copy2(movie, out/'motion.mp4');shutil.copy2(metadata, out/'metadata.json')
    record=json.loads(metadata.read_text())
    metadata_sha=record.get('avfx_sha')
    if metadata_sha and not capture_sha.startswith(metadata_sha) and not metadata_sha.startswith(capture_sha):
        raise SystemExit(f'Unexpected evidence SHA {metadata_sha} for {origin}')
    # Verify the actual video is the full native viewport, never upscale a proxy.
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height:format=duration','-of','json',str(movie)]))
    stream=info['streams'][0]; assert (stream['width'],stream['height'])==(1280,720), (movie,stream)
    if sheet:
        shutil.copy2(sheet,out/'sheet.jpg')
    else:
        duration=float(info['format']['duration']); combined=Image.new('RGB',(3840,1504),'black');draw=ImageDraw.Draw(combined)
        stamps=[]
        for n in range(6):
            sec=max(0, min(duration-0.05,duration*n/5))
            tmp=out/f'.frame{n}.png'
            subprocess.run(['ffmpeg','-v','error','-y','-ss',str(sec),'-i',str(movie),'-frames:v','1',str(tmp)],check=True)
            im=Image.open(tmp).convert('RGB');assert im.size==(1280,720)
            x,y=n%3*1280,n//3*752;combined.paste(im,(x,y));draw.text((x+5,y+725),f'#{skill:02d} {variant} {light} review video {sec:.2f}s (not source tick)',fill='white')
            tmp.unlink();stamps.append(round(sec,3))
        combined.save(out/'sheet.jpg',quality=62,optimize=True)
        (out/'sheet-times.json').write_text(json.dumps({'video_seconds':stamps,'note':'1x unscaled compressed video samples, not exact source ticks'},indent=2)+'\n')
    rows.append({'skill':skill,'variant':variant,'light':light,'capture_sha':capture_sha,'origin':origin,'same_as_build':capture_sha==sha,'video':'motion.mp4','metadata':'metadata.json','sheet':'sheet.jpg'})

# Earlier closed S and F footage, immutable historical captures, not falsely
# labeled as same-SHA; exact run and individual metadata travel with each.
for batch,run,source_sha,items in [
    ('s','41378915227','ce714a6ad935ad518685e701a92c6821d07ff152',[(2,'B02'),(3,'B03'),(7,'C07'),(8,'B08'),(10,'C10'),(15,'C15'),(17,'C17')]),
    ('f','41396229547','e80529cda05fc3b11697e508784306b8cb07f130',[(1,'F01'),(9,'F09'),(11,'F11'),(16,'F16'),(20,'F20')])]:
    for skill,variant in items:
        for light in ('normal','dimmed'):
            m=root/'historical'/f'batch-{batch}-motion-{variant}-{light}'
            r=root/'historical'/f'batch-{batch}-review-{variant}-{light}'
            review_meta = json.loads(pick_one(r, 'metadata.json').read_text())
            assert review_meta['avfx_sha'] == source_sha, (variant,light,review_meta['avfx_sha'])
            save_record(skill,variant,light,pick_one(m,'*.mp4'),pick_one(m,'*.json'),source_sha,f'Actions run {run}',pick_one(r,'sheet_*.jpg'))

for variant in ('A','B'):
    for light in ('normal','dimmed'):
        p=root/'05-same-sha'/f'r20-{variant}-{light}-lock0'
        save_record(5,variant,light,pick_one(p,'review.mp4'),pick_one(p,'timeline.json'),sha,'same-run real-route capture')

r=repo/'prototypes/arcana_fusion20/renderer/reviews'
for skill,prefix,short_sha in [(4,'final-','c27dc7c'),(6,'separated-','aeb969a'),(12,'chords-','64ebaa9'),(13,'arch-','8b02b6d'),(14,'colony-','0c52dd9'),(18,'crystal-','d3eb289')]:
    d=r/'batch_n_r27'/f'{skill:02d}'
    for light,filelight in [('normal','normal'),('dimmed','dim')]:
        # #04 final file naming differs from the other candidates.
        if skill==4: movie=d/f'{prefix}{filelight}-video.mp4'; meta=d/f'{prefix}{filelight}-metadata.json'
        else: movie=d/f'{prefix}{filelight}.mp4';meta=d/f'{prefix}{filelight}-metadata.json'
        data=json.loads(meta.read_text()); actual=data['avfx_sha'];assert actual.startswith(short_sha),(actual,short_sha)
        save_record(skill,'N',light,movie,meta,actual,'tracked R27 natural-world capture')
    shutil.copy2(d/'README.md',evidence/f'{skill:02d}_review_notes.md')
d=r/'batch_d_r27'/'19'
for light,filelight in [('normal','normal'),('dimmed','dim')]:
    meta=d/f'{filelight}-metadata.json'; data=json.loads(meta.read_text()); assert data['avfx_sha'].startswith('4c367b1')
    save_record(19,'D',light,d/f'{filelight}.mp4',meta,data['avfx_sha'],'tracked R27 moving-camera capture')
shutil.copy2(d/'README.md',evidence/'19_review_notes.md')
assert len(rows)==42 and {r['skill'] for r in rows}==set(range(1,21))
(root/'EVIDENCE_MANIFEST.json').write_text(json.dumps({'build_sha':sha,'captures':rows,'note':'All captures are actual game-world frames; historical capture SHA may differ from build SHA.'},indent=2)+'\n')
print('ALL20_EVIDENCE_OK pairs=20 plus alternate 05 = 42 videos, 42 native-size sheets')
