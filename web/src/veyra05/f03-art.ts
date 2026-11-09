/**
 * F03 REMAKE — SOH pixel-sprite grammar.
 * Each sprite is drawn in 1 source pixel blocks at 16px world tile scale.
 * Muted stone, iron, aged timber and oxidized copper belong to the existing
 * world palette. Shapes silhouette INDUSTRIAL PROCESSES, not identical 3-color
 * rectangles with a swapped label. No antialiasing, gradients or vector strokes.
 */
import {mk,type Sprite} from '../game/art';
export function makeF03Sprites(factory:typeof mk):Record<string,Sprite>{
 const c={outline:'#292c30',shadow:'#1f2329',iron:'#4c5a60',ironHi:'#89948e',stone:'#74736c',stoneHi:'#b1a994',wood:'#644c36',woodHi:'#b09065',rust:'#815d4d',copper:'#b48d64',ash:'#4a4743',earth:'#73634f',water:'#466d72',waterHi:'#8da6a2',ember:'#b77b4f',glow:'#e0b175'};
 const sprite=(w:number,h:number,paint:(r:(x:number,y:number,w:number,h:number,color:string)=>void)=>void)=>factory(w,h,g=>{
  const R=(x:number,y:number,a:number,b:number,color:string)=>{g.fillStyle=color;g.fillRect(x|0,y|0,a|0,b|0)};
  paint(R);
 },null);
 const f03_turbine=sprite(41,37,R=>{
  R(5,29,32,5,c.shadow);R(7,5,27,26,c.outline);R(9,7,23,21,c.iron);
  R(10,9,20,17,c.ironHi);R(14,6,13,24,c.outline);
  R(7,16,27,5,c.ironHi);R(17,9,6,18,c.rust);R(17,15,6,6,c.copper);
  for(let j=0;j<4;j++)R(11+j*6,30,3,3,c.stone);
 });
 const f03_waterwheel=sprite(43,45,R=>{
  R(6,38,32,5,c.shadow);R(6,10,30,29,c.outline);R(10,8,23,32,c.wood);
  R(13,11,17,25,c.woodHi);R(17,8,9,31,c.outline);R(8,21,27,6,c.outline);
  R(11,13,20,3,c.wood);R(13,33,16,3,c.wood);R(18,19,7,7,c.iron);R(20,21,3,3,c.copper);
  R(3,33,7,3,c.water);R(7,37,9,2,c.waterHi);
 });
 const f03_steel_gate=sprite(31,31,R=>{
  R(3,4,25,26,c.outline);R(5,6,21,21,c.iron);
  for(let x=7;x<26;x+=5){R(x,6,2,20,c.ironHi);R(x+2,6,1,20,c.shadow)}
  R(4,12,23,3,c.rust);R(4,24,23,3,c.outline);R(10,3,11,3,c.stone);
 });
 const f03_pipe_bundle=sprite(48,26,R=>{
  R(2,19,44,5,c.shadow);for(let i=0;i<4;i++){R(3,3+i*5,42,5,c.outline);R(4,4+i*5,40,2,i%2?c.iron:c.stone);R(5,6+i*5,3,1,c.ironHi)}
  R(17,2,4,23,c.rust);R(36,2,4,23,c.rust);
 });
 const f03_rust_pipe=sprite(38,19,R=>{
  R(2,10,34,6,c.outline);R(2,11,32,3,c.rust);R(27,4,7,9,c.outline);R(29,5,4,8,c.iron);
  R(6,12,8,2,c.copper);R(20,12,6,2,c.wood);R(5,17,24,2,c.shadow);
 });
 const f03_valve=sprite(25,32,R=>{
  R(5,27,16,4,c.shadow);R(10,11,5,18,c.iron);R(7,18,12,6,c.outline);
  R(3,7,19,4,c.rust);R(8,3,10,4,c.ironHi);R(11,2,3,12,c.outline);
  R(3,10,4,2,c.ironHi);R(19,10,4,2,c.ironHi);R(11,18,3,3,c.copper);
 });
 const f03_gauge_panel=sprite(26,30,R=>{
  R(4,4,18,21,c.outline);R(6,6,14,15,c.iron);R(7,8,5,5,c.stoneHi);R(14,8,5,5,c.stoneHi);
  R(9,10,2,2,c.iron);R(16,10,2,2,c.rust);R(7,16,12,2,c.copper);R(10,25,6,4,c.shadow);
 });
 const f03_log_cradle=sprite(55,30,R=>{
  R(2,22,51,5,c.shadow);R(4,18,47,6,c.wood);for(let i=0;i<5;i++){
   const yy=18-(i%2)*6;R(5+i*9,yy,10,7,c.outline);R(6+i*9,yy+1,8,5,c.woodHi);R(7+i*9,yy+2,3,2,c.wood);}
  R(9,24,3,4,c.iron);R(44,24,3,4,c.iron);
 });
 const f03_timber_pile=sprite(49,33,R=>{
  R(2,27,45,4,c.shadow);for(let r=0;r<3;r++)for(let j=0;j<4-r;j++){
   let x=4+r*5+j*10,y=23-r*7;R(x,y,11,7,c.outline);R(x+1,y+1,9,5,c.wood);R(x+2,y+2,4,2,c.woodHi);R(x+6,y+2,2,2,c.stone);}
 });
 const f03_sawframe=sprite(57,43,R=>{
  R(4,36,48,5,c.shadow);R(4,8,6,29,c.outline);R(47,8,6,29,c.outline);R(7,8,43,5,c.iron);R(8,10,40,2,c.ironHi);
  R(10,26,37,6,c.wood);R(8,22,42,4,c.woodHi);R(25,11,4,23,c.stoneHi);R(27,15,2,20,c.iron);
  R(12,30,8,3,c.rust);R(36,30,7,3,c.rust);
 });
 const f03_sawdust=sprite(35,20,R=>{
  R(4,14,27,3,c.earth);R(8,9,18,5,c.wood);R(13,5,7,6,c.woodHi);
  for(let i=0;i<14;i++){const x=3+(i*11)%29,y=8+(i*7)%10;R(x,y,2,1,i%3?c.copper:c.stoneHi)}
 });
 const f03_chain_rail=sprite(58,27,R=>{
  R(1,20,56,4,c.shadow);R(3,9,52,5,c.outline);R(5,10,48,2,c.ironHi);
  for(let i=0;i<8;i++){const x=5+i*6;R(x,14,3,7,c.iron);R(x+3,16,3,3,c.rust)}
  R(4,22,10,2,c.wood);R(42,22,10,2,c.wood);
 });
 const f03_ore_ramp=sprite(50,31,R=>{
  R(2,23,46,5,c.shadow);R(4,8,42,19,c.outline);R(7,11,36,13,c.stone);
  for(let i=0;i<6;i++){R(8+i*6,9+(i%2)*5,5,4,i%2?c.stoneHi:c.earth);R(8+i*6,23,3,2,c.ash)}
  R(11,5,25,3,c.rust);R(12,27,32,2,c.shadow);
 });
 const f03_spoil_heap=sprite(48,29,R=>{
  R(3,24,43,4,c.shadow);R(6,19,36,7,c.ash);R(10,12,30,8,c.stone);R(18,6,18,8,c.stoneHi);
  R(6,21,6,2,c.earth);R(25,15,9,3,c.outline);R(20,8,7,2,c.earth);R(31,23,8,2,c.stoneHi);
 });
 const f03_ore_seam=sprite(38,25,R=>{
  R(2,19,34,4,c.shadow);R(5,13,26,10,c.outline);R(8,10,10,7,c.stone);R(18,6,12,12,c.stone);
  R(10,14,4,5,c.ironHi);R(22,8,4,9,c.woodHi);R(24,17,5,3,c.stoneHi);
 });
 const f03_glass_spoil=sprite(39,28,R=>{
  R(4,23,32,4,c.shadow);R(6,13,26,12,c.outline);R(15,5,8,17,c.iron);R(10,9,7,15,c.ash);
  R(23,9,5,13,c.ironHi);R(17,7,2,10,'#668681');R(26,14,2,6,'#90a9a2');
 });
 const f03_crusher=sprite(52,50,R=>{
  R(4,42,44,5,c.shadow);R(8,9,36,34,c.outline);R(10,11,32,22,c.iron);
  R(13,13,26,5,c.ironHi);R(12,22,28,10,c.stone);R(14,24,23,5,c.ash);
  for(let i=0;i<5;i++)R(13+i*6,33,3,5,c.rust);
  R(5,7,42,4,c.stone);R(9,42,6,3,c.stoneHi);R(38,42,6,3,c.stoneHi);
 });
 const f03_screen=sprite(43,32,R=>{
  R(3,25,37,5,c.shadow);R(6,7,32,18,c.outline);R(9,9,26,13,c.iron);
  for(let i=0;i<5;i++)R(9+i*6,8,2,17,c.ironHi);R(9,15,27,2,c.rust);R(14,28,4,3,c.stone);
 });
 const f03_crane=sprite(58,70,R=>{
  R(4,61,50,6,c.shadow);R(9,15,8,47,c.outline);R(11,18,4,42,c.rust);
  R(9,11,44,7,c.outline);R(11,13,39,3,c.copper);R(42,18,3,28,c.ironHi);
  R(40,46,7,6,c.outline);R(42,49,4,11,c.rust);R(44,60,9,5,c.stone);
  R(4,7,12,5,c.iron);R(13,17,9,3,c.stoneHi);
 });
 const f03_kiln_vat=sprite(50,53,R=>{
  R(4,44,42,5,c.shadow);R(7,14,36,31,c.outline);R(10,18,30,25,c.rust);
  R(13,15,24,5,c.stoneHi);R(14,24,23,5,c.ash);R(13,34,24,3,c.outline);
  R(16,22,4,10,c.copper);R(25,23,6,9,c.ember);R(16,6,8,9,c.iron);
 });
 const f03_charcoal_rick=sprite(40,28,R=>{
  R(3,22,34,4,c.shadow);R(5,14,30,10,c.outline);R(10,7,19,14,c.ash);
  R(14,5,10,8,c.iron);R(6,18,5,4,c.stone);R(25,15,6,6,c.stone);
 });
 const f03_condenser=sprite(55,48,R=>{
  R(4,41,47,5,c.shadow);R(8,12,40,28,c.outline);R(11,15,34,22,c.iron);
  for(let i=0;i<4;i++){R(13+i*9,17,5,18,c.stone);R(15+i*9,19,2,15,c.ironHi)}
  R(9,7,13,7,c.rust);R(33,6,9,9,c.stoneHi);R(20,38,15,4,c.rust);
 });
 const f03_chimney=sprite(34,80,R=>{
  R(8,71,23,6,c.shadow);R(11,9,18,62,c.outline);R(13,9,14,59,c.rust);
  for(let y=15;y<69;y+=12){R(12,y,16,3,c.stone);R(13,y+3,3,7,c.wood)}
  R(9,6,22,5,c.iron);R(15,2,9,5,c.ash);
 });
 const f03_vent_pipe=sprite(30,52,R=>{
  R(5,45,21,4,c.shadow);R(10,8,11,37,c.iron);R(8,8,15,4,c.outline);
  R(8,4,17,5,c.stone);R(7,19,18,4,c.rust);R(12,25,7,18,c.ironHi);
 });
 const f03_slag_pool=sprite(44,28,R=>{
  R(2,19,40,6,c.shadow);R(3,10,38,14,c.outline);R(6,12,32,9,c.rust);
  R(12,14,20,5,c.ember);R(18,15,11,3,c.glow);R(7,8,29,3,c.stone);
 });
 const f03_silo=sprite(50,78,R=>{
  R(6,68,39,6,c.shadow);R(8,12,35,57,c.outline);R(11,13,29,54,c.stone);
  for(let y=19;y<63;y+=12){R(12,y,26,2,c.stoneHi);R(13,y+3,5,6,c.ironHi)}
  R(11,8,29,7,c.iron);R(14,5,23,4,c.stoneHi);R(19,62,14,4,c.rust);
 });
 const f03_filter_tank=sprite(56,41,R=>{
  R(4,34,48,5,c.shadow);R(6,9,44,27,c.outline);R(9,12,38,20,c.stone);
  R(12,16,32,13,c.water);R(16,17,24,3,c.waterHi);R(12,31,34,3,c.iron);
  R(5,7,45,4,c.iron);R(9,9,5,22,c.stoneHi);
 });
 const f03_geo_manifold=sprite(61,39,R=>{
  R(3,32,55,5,c.shadow);R(5,9,52,24,c.outline);R(8,12,46,18,c.iron);
  R(12,5,7,25,c.rust);R(31,4,7,25,c.rust);R(48,7,5,23,c.rust);
  R(8,17,48,4,c.ironHi);R(24,22,11,6,c.stone);R(27,22,4,3,c.copper);
 });
 const f03_signal_lamp=sprite(21,37,R=>{
  R(4,29,14,5,c.shadow);R(8,9,5,23,c.iron);R(5,5,11,9,c.outline);
  R(7,7,7,5,c.copper);R(9,8,3,3,c.glow);R(5,4,11,2,c.stone);
 });
 return {f03_turbine,f03_waterwheel,f03_steel_gate,f03_pipe_bundle,f03_rust_pipe,f03_valve,f03_gauge_panel,f03_log_cradle,f03_timber_pile,f03_sawframe,f03_sawdust,f03_chain_rail,f03_ore_ramp,f03_spoil_heap,f03_ore_seam,f03_glass_spoil,f03_crusher,f03_screen,f03_crane,f03_kiln_vat,f03_charcoal_rick,f03_condenser,f03_chimney,f03_vent_pipe,f03_slag_pool,f03_silo,f03_filter_tank,f03_geo_manifold,f03_signal_lamp};
}
/**
 * Material-specific 16px terrain art, not F02's plank strip on every surface.
 * IDs include room signature, preventing identical tiling across five industries.
 */
export function drawF03DeckTile(g:CanvasRenderingContext2D,x:number,y:number,id:string,edges:number):void{
 const X=x*16,Y=y*16;const q=/po_(fracquarry|greyquarry|obsq)/.test(id),t=/po_(sawaion|mill|timberyard)/.test(id),w=/po_(falls|pumphouse|oldpump)/.test(id),h=/po_(kilns|slag|sulfur)/.test(id);
 const rock=q?(/po_obsq/.test(id)?['#34353b','#5a5556','#8a8180']:['#4d4d4d','#797670','#a9a294']):h?['#453e3b','#7d6559','#aa8a76']:w?['#3e4d50','#727c77','#a29c87']:t?['#45372d','#88674c','#baa07a']:['#454e50','#758484','#a2aca3'];
 const [d,m,l]=rock;
 g.fillStyle=d;g.fillRect(X,Y,16,16);
 const raised=/loft|walk|bridge|lip|draught/.test(id);
 if(q){
  // Uneven shale and geological fault clusters. Repeat periods are deliberately
  // different along x/y to break the 16px brick-checker pattern.
  const n=((x*97+y*131)^(x*17+y*23))>>>0;
  g.fillStyle=n%3===0?m:d;g.fillRect(X+1,Y+1,14,14);
  g.fillStyle=l;g.fillRect(X+2+(n%5),Y+1+((n>>3)%8),7,2);
  g.fillStyle=m;g.fillRect(X+3,Y+8,11,3);g.fillRect(X+9,Y+11,5,3);
  g.fillStyle=d;g.fillRect(X+((n>>2)%7),Y+4,3,6);
  if(n%5===0){g.fillStyle=l;g.fillRect(X+11,Y+11,3,2)}
  if(n%7===0){g.fillStyle='#262a30';g.fillRect(X+2,Y+13,9,2)}
 }else if(t){
  const n=(x*13+y*47)&15;
  g.fillStyle=m;g.fillRect(X+1,Y+3,14,9);
  g.fillStyle=n%3===0?l:d;g.fillRect(X+2,Y+4+n%4,11,2);
  g.fillStyle=d;g.fillRect(X+1,Y+11,14,2);
  if(n%5===0){g.fillStyle=l;g.fillRect(X+4,Y+13,4,2)}
 }else if(w){
  // Banded masonry, sluice drains and age stains; not port decking.
  g.fillStyle=m;g.fillRect(X+1,Y+2,14,12);g.fillStyle=l;g.fillRect(X+2,Y+3,7,2);
  g.fillStyle=d;g.fillRect(X+1,Y+8,14,1);g.fillRect(X+8,Y+9,1,5);
  if((x+y)%7===0){g.fillStyle='#496468';g.fillRect(X+10,Y+10,4,3)}
 }else if(h){
  const n=((x*23+y*31)^(x<<2))&31;
  g.fillStyle=m;g.fillRect(X+1,Y+1,14,14);
  g.fillStyle=d;g.fillRect(X+2,Y+7+n%3,12,2);
  if(n%4===0){g.fillStyle=l;g.fillRect(X+4,Y+3,4,2)}
  if(n%7===0){g.fillStyle='#302c2c';g.fillRect(X+9,Y+10,6,4)}
 }else{
  const n=(x*37+y*19)&31;
  g.fillStyle=n%3===0?d:m;g.fillRect(X+1,Y+1,14,14);
  g.fillStyle=l;g.fillRect(X+3,Y+3,7,2);
  if(n%4===0){g.fillStyle=d;g.fillRect(X+6,Y+7,2,7)}
  if(n%5===0){g.fillStyle='#61787c';g.fillRect(X+10,Y+11,4,2)}
 }
 if(raised){g.fillStyle=d;g.fillRect(X,Y+14,16,2);g.fillStyle=l;g.fillRect(X+2,Y+13,3,1)}
 if(edges&1){g.fillStyle=l;g.fillRect(X+2,Y,11,1)}
 if(edges&2){g.fillStyle=d;g.fillRect(X,Y+15,16,1)}
 if(edges&4){g.fillStyle=d;g.fillRect(X,Y,1,16)}
 if(edges&8){g.fillStyle=d;g.fillRect(X+15,Y,1,16)}
}