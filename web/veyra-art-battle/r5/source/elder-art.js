/**
 * VEYRA R5 six-Elder monumental pixel props.
 * Dedicated art in the actual depth compositor, never UI overlay. Canvas pixels
 * are all integer-grid; no gradients, blur, filters or antialiasing paths.
 * This is ORIGINAL PROVISIONAL ART, not imported boss-character sprites.
 */
const __elderArt=(()=>{
function makeElderSprites(mk){
 const make=(w,h,fn)=>mk(w,h,g=>{g.imageSmoothingEnabled=false;fn(g)});
 const R=(g,x,y,w,h,c)=>{g.fillStyle=c;g.fillRect(x|0,y|0,w|0,h|0)};
 const edge=(g,x,y,w,h,outline,body,top)=>{R(g,x,y,w,h,outline);R(g,x+2,y+2,w-4,h-4,body);R(g,x+3,y+2,w-6,3,top)};
 const gems=(g,pts,c)=>pts.forEach(([x,y])=>{R(g,x,y,4,5,'#191b28');R(g,x+1,y+1,2,3,c);R(g,x+1,y+1,1,1,'#e9edca')});
 const masonry=(g,x,y,w,h,cl)=>{for(let yy=y+9;yy<y+h-2;yy+=10){R(g,x+3,yy,w-6,1,cl);for(let xx=x+4+((yy-y)/10%2)*8;xx<x+w-4;xx+=17)R(g,xx,yy-6,1,6,cl)}};
 const root=make(112,128,g=>{
   R(g,4,112,104,10,'#121a18');R(g,11,108,90,8,'#27392d');
   for(const [x,y,w,h]of [[11,99,22,13],[26,90,18,23],[39,81,14,36],[62,87,17,28],[76,97,24,15],[35,56,14,49],[49,20,23,95],[71,49,13,48],[25,47,17,9],[66,32,23,10],[12,65,28,11],[75,61,27,9]])R(g,x,y,w,h,'#182920');
   for(const [x,y,w,h]of [[16,96,16,10],[30,86,11,19],[40,61,6,45],[53,23,15,87],[73,48,7,50],[81,62,13,5],[37,52,9,7]])R(g,x,y,w,h,'#5c6141');
   for(const [x,y,w,h]of [[19,94,8,4],[44,67,3,26],[58,29,3,76],[75,54,2,37]])R(g,x,y,w,h,'#a39b64');
   for(const [x,y,w,h]of [[17,40,29,20],[36,17,33,30],[64,28,31,27],[10,63,18,15],[85,51,18,17],[31,5,24,17],[53,4,27,20]]){R(g,x-2,y-2,w+4,h+4,'#142d2a');R(g,x,y,w,h,'#365e47');R(g,x+3,y+2,w-6,5,'#71966a');R(g,x+5,y+h-6,w-10,3,'#254c3e')}
   gems(g,[[46,74],[63,74],[49,91],[61,89]],'#cbbf72');
   R(g,48,111,21,5,'#1e2428');R(g,52,108,13,4,'#b6a35b');
 });
 const rune=make(43,73,g=>{
   R(g,1,65,41,7,'#1a2124');edge(g,8,8,27,59,'#111f24','#384d46','#82947d');
   R(g,13,15,17,5,'#6b8773');R(g,17,27,9,27,'#0b2526');R(g,20,23,3,36,'#d2b864');
   R(g,16,33,11,4,'#b2a263');R(g,17,39,9,2,'#edf0b2');
   R(g,2,63,39,6,'#39443f');
 });
 const anubisPylon=make(60,106,g=>{
   R(g,2,97,56,8,'#211b22');edge(g,8,8,44,91,'#2b2224','#6d5649','#c1a37c');
   R(g,6,12,5,84,'#342a2e');R(g,49,12,5,84,'#413133');
   R(g,15,15,30,9,'#d2ad71');R(g,17,27,26,50,'#4c3b35');R(g,20,30,20,43,'#8c704f');
   for(let i=0;i<5;i++){R(g,22,35+i*8,16,2,i%2?'#be9559':'#372d30');R(g,28+(i%3)*3,38+i*8,3,4,'#dbc184')}
   R(g,16,79,28,6,'#c7a575');R(g,21,86,18,7,'#433536');
   gems(g,[[28,17]],'#e6bd63');masonry(g,10,13,39,83,'#594539');
 });
 const sarc=make(54,58,g=>{
   R(g,3,49,48,7,'#221b24');edge(g,8,10,38,42,'#34242a','#776044','#d1b381');
   R(g,16,15,22,11,'#2b2929');R(g,22,18,10,5,'#c8af79');
   R(g,20,29,14,16,'#4d3530');R(g,25,31,4,13,'#e8c479');
   R(g,13,35,5,6,'#c79a61');R(g,36,35,5,6,'#c79a61');
   R(g,7,4,40,7,'#bc945d');R(g,10,1,34,4,'#dec086');
 });
 const argusEye=make(102,110,g=>{
   R(g,1,101,100,7,'#171d29');R(g,13,91,76,11,'#4d5365');R(g,17,88,68,5,'#a2a2a5');
   edge(g,13,9,19,83,'#151e30','#515c73','#a4a9ba');edge(g,70,9,19,83,'#151e30','#515c73','#a4a9ba');
   edge(g,21,4,60,14,'#171b2a','#6e738c','#e2c57b');
   R(g,34,20,34,69,'#1b2132');
   for(let i=0;i<10;i++){
     let h=i<5?i:9-i;R(g,31-h*2,32+i*5,40+h*4,4,'#3e5275');
   }
   R(g,20,43,62,24,'#101b31');R(g,24,47,54,16,'#d6bd77');R(g,28,50,46,10,'#1f526a');R(g,42,48,18,16,'#0a172c');
   R(g,47,51,8,11,'#60c9d7');R(g,49,53,4,6,'#e1fbdf');
   for(const x of [21,75]){R(g,x,21,6,14,'#c2b074');R(g,x,77,6,8,'#d2aa64')}
 });
 const argusPillar=make(38,86,g=>{
   R(g,1,78,36,7,'#171c2b');edge(g,8,12,22,66,'#1a2433','#576579','#abc0c3');
   R(g,4,5,30,11,'#26354c');R(g,7,4,24,5,'#dab96e');
   for(let i=0;i<5;i++){R(g,14,24+i*9,11,2,'#9da9a4');R(g,17,27+i*9,4,5,'#294d65')}
   R(g,13,70,12,4,'#d2b272');
 });
 const atlasGate=make(124,135,g=>{
   R(g,3,125,118,8,'#161d27');
   // Keystone arch: visually massive but its middle is intentionally not a teleport trigger.
   edge(g,9,31,28,96,'#19222e','#596b79','#aab7b5');edge(g,87,31,28,96,'#19222e','#596b79','#aab7b5');
   edge(g,20,15,84,24,'#1a2234','#566c83','#adb9c1');
   R(g,31,36,62,84,'#0c1a2b');R(g,39,41,46,75,'#1f526b');
   for(let i=0;i<8;i++){R(g,43+i%3*5,46+i*8,29+(i%2)*5,3,i%2?'#2b718a':'#3d8aa2')}
   R(g,55,45,14,58,'#59bfd2');R(g,60,41,4,67,'#a3e6d5');R(g,39,107,46,5,'#17344e');
   for(let x=17;x<104;x+=15){R(g,x,17,2,18,'#1e3048');R(g,x+4,21,3,8,'#e0c47c')}
   masonry(g,12,39,22,85,'#364755');masonry(g,91,39,22,85,'#354958');
   edge(g,52,4,20,14,'#19212f','#b7a26f','#eee6a4');
 });
 const atlasAnchor=make(48,74,g=>{
   R(g,3,66,42,7,'#131e26');edge(g,8,11,32,56,'#1d2936','#576e7c','#a4b9b5');
   R(g,12,18,24,8,'#3d8a9a');R(g,18,26,12,25,'#142b3c');
   for(let i=0;i<4;i++)R(g,14+i*6,31+i%2*6,3,16,'#62aabc');
   R(g,16,54,16,5,'#d1b871');R(g,13,5,22,6,'#d7c68c');
 });
 const surturForge=make(112,106,g=>{
   R(g,2,97,108,8,'#111319');
   for(let x=7;x<104;x+=15){R(g,x,59+(x%3)*5,12,40,'#24272e');R(g,x+2,61+(x%3)*5,7,24,'#4e4b4c')}
   edge(g,17,18,78,80,'#18191f','#54504c','#918473');
   R(g,29,29,54,64,'#151518');R(g,33,33,46,52,'#4a2224');
   for(const [x,y,w,h,c]of [[37,57,38,28,'#a63e21'],[41,51,30,33,'#eb5a21'],[45,62,22,22,'#ff9a2b'],[50,68,12,16,'#ffdc60'],[54,40,4,36,'#f7b751']])R(g,x,y,w,h,c);
   R(g,24,16,64,9,'#a89a80');R(g,28,9,56,9,'#34333a');R(g,43,5,26,9,'#d0a563');
   for(let x of [21,85]){R(g,x,28,6,64,'#25262b');R(g,x+2,31,3,30,'#8a7770')}
   R(g,16,88,80,7,'#181b1f');R(g,23,92,66,3,'#7d4d3a');
 });
 const surturSpire=make(49,108,g=>{
   R(g,1,100,47,7,'#16191d');
   for(const [x,y,w,h]of [[22,5,7,93],[16,17,20,82],[9,48,34,51],[4,78,43,21]])R(g,x,y,w,h,'#20252b');
   for(const [x,y,w,h]of [[24,12,4,77],[18,24,5,55],[13,59,5,29],[30,39,6,50]])R(g,x,y,w,h,'#5a5555');
   for(const [x,y,w,h]of [[24,38,4,25],[20,55,4,21],[31,66,4,17]])R(g,x,y,w,h,'#dd6530');
   R(g,25,13,3,15,'#cd8e4c');R(g,5,95,39,5,'#4f3830');
 });
 const typhonShard=make(106,116,g=>{
   R(g,3,107,100,8,'#171d27');
   // crystalline split stone, blue storm veins and separate broken peaks.
   for(const [x,y,w,h]of [[13,67,18,37],[28,36,16,68],[42,13,18,93],[58,45,15,57],[73,33,15,70],[88,73,11,29]])R(g,x,y,w,h,'#1f2d3f');
   for(const [x,y,w,h]of [[17,68,8,30],[32,42,8,53],[45,19,10,79],[61,49,7,46],[75,39,8,56]])R(g,x,y,w,h,'#49677f');
   for(const [x,y,w,h]of [[20,70,4,19],[36,44,4,38],[49,22,4,52],[65,50,3,31],[79,44,3,33]])R(g,x,y,w,h,'#9bc3c4');
   for(const [x,y,w,h]of [[54,39,6,10],[57,48,10,5],[61,53,5,20],[58,72,10,6],[54,78,6,17],[47,93,10,4]])R(g,x,y,w,h,'#dcebc3');
   R(g,4,102,98,5,'#394153');
 });
 const typhonPillar=make(43,96,g=>{
   R(g,1,89,41,6,'#171b25');edge(g,8,12,26,78,'#1c2434','#485c71','#a4afb1');
   R(g,13,9,16,6,'#e1d3a0');R(g,17,25,8,51,'#20344c');
   for(let i=0;i<4;i++){R(g,12+i%2*4,34+i*11,18,3,'#70a5b7');R(g,22,37+i*11,4,4,'#d3deb7')}
 });
 const blueRune=make(53,42,g=>{
   R(g,2,31,49,8,'#15222e');R(g,5,26,43,8,'#45536a');
   for(let i=0;i<5;i++)R(g,10+i*7,17+(i%2)*5,6,13,'#55758a');
   R(g,20,3,14,21,'#15445b');R(g,24,0,6,24,'#a7dadd');R(g,13,27,26,4,'#96a6ac');
 });
 return {elder_aion_root:root,elder_aion_rune:rune,
 elder_anubis_pylon:anubisPylon,elder_anubis_sarc:sarc,
 elder_argus_eye:argusEye,elder_argus_pillar:argusPillar,
 elder_atlas_gate:atlasGate,elder_atlas_anchor:atlasAnchor,
 elder_surtur_forge:surturForge,elder_surtur_spire:surturSpire,
 elder_typhon_shard:typhonShard,elder_typhon_pillar:typhonPillar,
 elder_blue_rune:blueRune};
}
return {makeElderSprites};
})();