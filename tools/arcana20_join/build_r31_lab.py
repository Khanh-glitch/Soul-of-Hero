#!/usr/bin/env python3
"""Build a relocatable, offline R31 lab from tracked evidence (no Git mutation)."""
import json, pathlib, shutil, sys, hashlib, zipfile
R=pathlib.Path(__file__).resolve().parents[2]
LAB=R/'prototypes/arcana_fusion20/visual_direction_lab'
REV=R/'prototypes/arcana_fusion20/renderer/reviews'
out=pathlib.Path(sys.argv[1]).resolve() if len(sys.argv)>1 else R/'out/r31_lab'
out.mkdir(parents=True, exist_ok=True)
assets=out/'assets'; assets.mkdir(exist_ok=True)
def copy(src, dst):
 src=pathlib.Path(src); dest=out/dst;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dest);return str(dst).replace('\\','/')
def variant(label, paths):
 result={'label':label,'clips':{}}
 for light,base in paths.items():
  base=pathlib.Path(base); meta=json.loads(base.with_suffix('.json').read_text());
  name=f"{meta['skill']:02d}-{label.replace(' ','_')}-{light}".replace('/','_')
  dst=copy(base.with_suffix('.mp4'),pathlib.Path('assets/video')/(name+'.mp4'))
  md=copy(base.with_suffix('.json'),pathlib.Path('assets/video')/(name+'.json'))
  result['clips'][light]={'src':dst,'metadata':md,'sha':meta['avfx_sha'],'role':meta['source_role'],'entries':meta['entries'],'resolution':meta['resolution'],'tick_note':meta['source_tick_note']}
 return result
def old(n):
 p=REV/'batch_n_r29'/n
 return {'normal':p/(n+'-normal'),'dimmed':p/(n+'-dim')}
def first(n):
 p=REV/'r30_first/video'
 return {'normal':p/(n+'-normal'),'dimmed':p/(n+'-dimmed')}
def follow(folder,names=('normal','dimmed')):
 p=REV/'r30_followup'/folder
 return {'normal':p/names[0],'dimmed':p/names[1]}
def effect(n,name,intended,actual,variants):return {'id':n,'name':name,'intended':intended,'actual':actual,'variants':variants}
data={'effects':[
 effect('04','Ashen Guillotine','Cocked heavy blade → one traveling diagonal stroke/contact → irregular displaced rock banks → closure.','Latest world warp reads as a thin dark twig; banks lack visible geological depth. Dim is weaker.',[variant('Earlier R30',first('N04')),variant('Latest rejected',follow('n04')),variant('Earlier R29',old('04'))]),
 effect('06','Riptide Calligraphy','Moving liquid writing → separate advancing volumetric crest → breakup and retreat.','Earlier slab, then a row of coins; latest is a dark blob without a convincing crest.',[variant('Slab rejected',follow('n06')),variant('Latest rejected',follow('n06_union')),variant('Coin eddies rejected',follow('n06_eddies')),variant('Earlier R29',old('06'))]),
 effect('12','Skybreaker Script','Major and minor runes write → circuit → clear C-quality target lightning → reverse disassembly.','Minor glyphs are faint and climax is a brief thin trace. Complete reverse OUT unapproved.',[variant('Earlier R29',old('12')),variant('Latest rejected',follow('n12',('N12-normal','N12-dimmed')))]),
 effect('13','Rootwake','Single living origin → tapered parent/children → tension → one aimed thorn → organic retraction.','Branching is present but origin and thorn are masked by actors and scenery; tension remains unclear.',[variant('Earlier R29',old('13')),variant('Latest R30',first('N13'))]),
 effect('14','Spore Nebula','Seed → connected fungal colonies → causal signal → sporulation and fade.','Branching cups read as vine with purple flowers, not fungus; moving camera loses the effect.',[variant('Earlier R29',old('14')),variant('Latest rejected',follow('n14',('N14-normal','N14-dimmed')))]),
 effect('18','Chronoshard','A recognizable event freezes into distinct time slices, rewinds, then releases synchronously.','Tiny repeated crescents read as similar icons or empty crystals rather than a visible event.',[variant('Earlier R29',old('18')),variant('Latest R30',first('N18'))]),
 effect('19','Constellation Engine','D original 14-node graph, authentic saturated core, filaments and natural OUT; A exact, B optional LDR.','B has visible nodes but core is unreadable and diagonal shimmer dominates; original source also saturates.',[variant('A source faithful',first('D19A')),variant('B earlier rejected',first('D19B'))])],
 'sources':{'A':'3b682931125ab16ad7cb563a2a041e4d3a0917285d433ef8068c86b004b8eaff','B':'94451e10d9c5527053ba38bbbec35278b96b2fecac598549ab10111fd69664ac','C':'122ab162f867f25f3f2acbf1b23a681c2e3089fdc9e70ed7e215cbba63a59919','D':'4d249d53d81c5ff699ebd606983c27b333f7be903fc949ceeb4dd55504a63291'},
 'references':{'D authored / OUT':copy(R/'prototypes/arcana_fusion20/original_source/package/handoff/reference/ARCANA_19_Reference_With_Exit.html',pathlib.Path('assets/reference/d19.html')),'D original standalone':copy(R/'prototypes/arcana_fusion20/original_source/package/handoff/reference/Elemental_VFX_Lab_FIXED_Standalone.html',pathlib.Path('assets/reference/d-original.html')),'A/B/C original reference':copy(R/'prototypes/arcana_fusion20/original_source/package/handoff/reference/ARCANA_Three_Way_VFX_Comparison.html',pathlib.Path('assets/reference/abc.html'))}}
data['concepts']={}
info={
 '04':[
 ('A · Split escarpment','04A-split-escarpment.png','04A.png','Long paired rock banks + travelling cleaver.','Slit opens; blade cocks; blade travels; one edge contacts; uneven banks lift; settle and close.','Promising geological read in AI illustration, but it is enormous, obscures terrain and is not 1×. The actual-scale sketch is a black decal. REJECT implementation-ready status.'),
 ('B · Hinged bedrock','04B-hinged-bedrock.png','04B.png','Asymmetric raised masonry blocks hinged to one cut.','Mark cut; blade draws back; advance; single contact; hinged masses kick up; settle inward and vanish.','Large stones communicate displacement; AI omitted the blade and occludes the scene; actual-scale sketch is almost identical to A. REJECT.'),
 ('C · Fan fracture','04C-fan-fracture.png','04C.png','One contact fans an arc of varied displaced strata.','Cocked blade; short travel; one impact; fracture fans; fragments settle; rock arc restitches.','Distinct fan silhouette but becomes a crater/cage and overpowers actor; the 1× draft is a flat primitive. REJECT.')],
 '13':[
 ('A · Forked taproot','13A-forked-taproot.png','13A.png','One heavy root branches as a fork then flexes at one branch.','Seed; taproot probes; fork grows; parent tenses; one thorn strikes; children retract into parent.','At 1× the attached fork reads as roots but thorn is a spear; AI reference becomes a tree and covers actor. REJECT.'),
 ('B · Coiled tendon','13B-coiled-tendon.png','13B.png','A hooked parent preloads one targeted spring action.','Seed; hooked root advances; shoots branch; tendon draws back; attached thorn flicks; recoil then retract.','Coil is a distinct tension silhouette but AI spiral is a snail and 1× sketch remains rigid and spear-like. REJECT.'),
 ('C · Surface crown','13C-surface-crown.png','13C.png','Grounded asymmetric buttress-root crown with one advancing limb.','Seed swells; buttresses root; children extend; one limb bends; small thorn flicks; tips retreat to crown.','AI reference has credible anatomy but is too large and adds an actor; 1× silhouette is still a set of sticks. REJECT.')],
 '19':[
 ('A · Core lens','19A-core-lens.png',None,'Protect the source-saturated central core and locally restrain the world field.','D opening; authentic nodes emerge; graph forms; source core peaks; source filaments unwind; original OUT.','Matte cuts outer nodes and makes a hard crop. Source-role preservation fails. REJECT as runtime method.'),
 ('B · Orbit-led','19B-orbit-led.png',None,'Prioritize authentic outer points and filaments while retaining the saturated A core.','D opening; source nodes emerge; filaments connect; original saturated core peaks; points recede; original OUT.','Most legible source graph; diagonal shimmer still dominates, core white patch competes with actor. REJECT as visual result.'),
 ('C · Grounded plane','19C-grounded-plane.png',None,'Retain A core and stage actual B material near terrain plane.','D opening; nodes appear; filament network forms; core peaks; ground layer recedes; original OUT.','Hard spatial cut changes role continuity and reads as pale cloud/bands. REJECT. All D concepts are non-native screenshots composited spatially, not viable renderer masks.')]
}
for n,items in info.items():
 data['concepts'][n]=[]
 for title,sketch,ai,idea,beats,crit in items:
  rec={'title':title,'idea':idea,'beats':beats,'critique':crit,'rubric': ('Shape weak at 1×; material is concept paint; timing proposed only; actor occlusion risk; NEW.' if n in ('04','13') else 'D shape retained as input but mattes cut roles; material is LDR concept; timing unchanged in intent; actor competes; A must remain exact.'),'sketch':copy(LAB/'concepts'/sketch,pathlib.Path('assets/concepts')/sketch)}
  if ai:rec['ai']=copy(LAB/'concepts/reference_ai'/ai,pathlib.Path('assets/concepts/reference_ai')/ai)
  data['concepts'][n].append(rec)
data['d_stills']={}
for light in ('normal','dimmed'):
 data['d_stills'][light]={}
 for tick in ('489','516'):
  data['d_stills'][light][tick]={}
  for src,label in [('world-base','No FX'),('native-source','D source only'),('bounded','A faithful'),('art_directed','B rejected'),('bounded_restored','A restored')]:
   path=REV/'r30_followup/d19'/light/(tick+'-'+src+'.png')
   data['d_stills'][light][tick][label]=copy(path,pathlib.Path('assets/d19')/light/path.name)
  for src,label in [('star_only','Isolated STAR'),('center_only','Isolated center'),('body_only','Isolated body')]:
   path=REV/'batch_d_r29/19'/('dim' if light=='dimmed' else 'normal')/(tick+'-'+src+'.png')
   data['d_stills'][light][tick][label]=copy(path,pathlib.Path('assets/d19/isolation')/light/path.name)
copy(LAB/'index.html',pathlib.Path('index.html'))
(out/'data.js').write_text('window.R31_DATA = '+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n')
copy(LAB/'README.md',pathlib.Path('README.md'))
copy(LAB/'R31_DECISION.md',pathlib.Path('R31_DECISION.md'))
files=[p for p in sorted(out.rglob('*')) if p.is_file() and p.name!='SHA256SUMS']
(out/'SHA256SUMS').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(out))+'\n' for p in files))
zipname=out.parent/(out.name+'.zip')
with zipfile.ZipFile(zipname,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(out.rglob('*')):
  if p.is_file():
   name=str(pathlib.Path(out.name)/p.relative_to(out)); info=zipfile.ZipInfo(name,(2020,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644 << 16;z.writestr(info,p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED,compresslevel=6)
print('LAB',out,'FILES',len(files)+1,'ZIP',zipname,'BYTES',zipname.stat().st_size,'SHA256',hashlib.sha256(zipname.read_bytes()).hexdigest())
