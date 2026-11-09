/** Handmade 1x pixel-art props and dock surface for Gulfhead / Westmouth / Saltwick.
 * Canvas figures are deliberately block-based, no licensed stock atlases or filtering.
 * These are only visuals, not gameplay devices or usable cargo.
 */
import {mk,type Sprite} from '../game/art';
export function makeUrbanHarborSprites(factory:typeof mk):Record<string,Sprite>{
 const c01_city_banner=factory(25,55,g=>{
  g.fillStyle='#2a2d33';g.fillRect(11,2,4,52);g.fillStyle='#baab89';g.fillRect(12,5,2,45);
  g.fillStyle='#d5b06f';g.fillRect(6,4,17,4);g.fillStyle='#8d2d45';g.fillRect(14,9,11,27);
  g.fillStyle='#d69f65';g.fillRect(15,11,9,3);g.fillRect(15,30,9,3);
  g.fillStyle='#e3ce94';g.fillRect(17,17,5,4);g.fillRect(18,23,3,4);
  g.fillStyle='#4a342b';g.fillRect(9,51,10,3);
 });
 const c01_arched_gate=factory(57,49,g=>{
  g.fillStyle='rgba(14,18,29,.4)';g.fillRect(3,43,52,5);
  g.fillStyle='#464b55';g.fillRect(4,9,12,35);g.fillRect(40,9,12,35);g.fillRect(11,6,37,8);
  g.fillStyle='#a99f91';g.fillRect(5,8,8,32);g.fillRect(43,8,8,32);g.fillRect(13,7,32,7);
  g.fillStyle='#d3bfa1';g.fillRect(8,10,4,25);g.fillRect(44,10,4,25);
  g.fillStyle='#293039';g.fillRect(15,20,27,19);g.fillRect(18,16,21,4);g.fillRect(22,13,13,5);
  g.fillStyle='#d6af70';g.fillRect(17,8,24,3);g.fillRect(16,16,4,3);g.fillRect(38,16,4,3);
  g.fillStyle='#9a774e';g.fillRect(5,40,10,4);g.fillRect(41,40,10,4);
  for(let i=0;i<5;i++){g.fillStyle='#686a69';g.fillRect(5+(i%3)*14,14+i*6,2,2)}
 });
 const c01_canopy_market=factory(64,38,g=>{
  g.fillStyle='#3f3429';g.fillRect(5,18,4,20);g.fillRect(53,18,4,20);
  g.fillStyle='#99805c';g.fillRect(6,8,52,14);g.fillStyle='#cd9e65';g.fillRect(8,5,48,5);
  for(let i=0;i<6;i++){g.fillStyle=i%2?'#8f3b43':'#dcc08b';g.fillRect(8+i*8,10,8,12)}
  g.fillStyle='#31343d';g.fillRect(7,21,49,3);g.fillStyle='#725b40';g.fillRect(14,27,35,5);
  g.fillStyle='#a2a885';g.fillRect(17,24,13,4);g.fillStyle='#c59c69';g.fillRect(34,24,11,5);
  g.fillStyle='#e7d0a2';g.fillRect(18,25,5,2);g.fillRect(34,24,4,2);
 });
 const c01_cargo_hook=factory(41,58,g=>{
  g.fillStyle='#30363b';g.fillRect(7,51,31,5);g.fillStyle='#716451';g.fillRect(6,13,6,38);
  g.fillStyle='#d9ad70';g.fillRect(8,10,31,5);g.fillRect(31,15,3,16);
  g.fillStyle='#333a43';g.fillRect(30,30,5,12);g.fillStyle='#c1b7a2';g.fillRect(31,32,3,13);
  g.fillStyle='#d2ae64';g.fillRect(29,43,7,4);g.fillStyle='#53616c';g.fillRect(26,45,2,6);g.fillRect(35,46,2,5);
  g.fillStyle='#7c5637';g.fillRect(17,49,13,6);g.fillStyle='#b18c64';g.fillRect(18,50,11,2);
 });
 const c01_quay_lamp=factory(26,42,g=>{
  g.fillStyle='#2a2b2f';g.fillRect(11,18,5,23);g.fillStyle='#998365';g.fillRect(13,18,2,21);
  g.fillStyle='#33353d';g.fillRect(5,9,18,3);g.fillRect(6,24,18,3);
  g.fillStyle='#d6a15c';g.fillRect(9,12,10,12);g.fillStyle='#fff2b2';g.fillRect(11,13,6,8);
  g.fillStyle='#edb859';g.fillRect(13,14,2,7);g.fillStyle='#4b4f55';g.fillRect(8,5,12,4);
  g.fillStyle='#bb9b6a';g.fillRect(7,36,13,3);g.fillStyle='#293038';g.fillRect(7,39,16,3);
 });
 const c01_mooring=factory(23,30,g=>{
  g.fillStyle='rgba(16,18,25,.35)';g.fillRect(6,26,15,3);
  g.fillStyle='#484334';g.fillRect(7,5,8,23);g.fillStyle='#bea078';g.fillRect(9,5,4,18);
  g.fillStyle='#34353b';g.fillRect(3,5,17,6);g.fillRect(5,21,13,3);
  g.fillStyle='#a6a99c';g.fillRect(4,6,15,2);g.fillStyle='#d5b981';g.fillRect(9,2,4,3);
 });
 const c01_rope_cart=factory(44,29,g=>{
  g.fillStyle='#312f2b';g.fillRect(5,9,34,15);g.fillStyle='#9d7446';g.fillRect(6,8,31,12);
  g.fillStyle='#cbab72';g.fillRect(7,9,29,3);g.fillStyle='#333c42';g.fillRect(6,20,6,7);g.fillRect(29,20,8,7);
  g.fillStyle='#b69d6d';for(let i=0;i<4;i++){g.fillRect(12+i*5,12,3,7)}
  g.fillStyle='#5c4032';g.fillRect(15,5,15,4);g.fillStyle='#cbad80';g.fillRect(17,7,10,2);
 });
 const c01_white_salt_pan=factory(50,31,g=>{
  g.fillStyle='#454a4e';g.fillRect(2,13,46,16);g.fillStyle='#9b9d8b';g.fillRect(4,11,42,14);
  g.fillStyle='#e8dbad';g.fillRect(6,10,38,13);g.fillStyle='#f7e9c3';g.fillRect(8,12,34,8);
  g.fillStyle='#cec4a5';g.fillRect(6,19,40,4);g.fillStyle='#a79c82';g.fillRect(2,25,46,3);
  g.fillStyle='#c1c0b1';g.fillRect(10,9,12,2);g.fillRect(28,7,12,3);
 });
 const c01_brine_pipe=factory(37,39,g=>{
  g.fillStyle='#29333b';g.fillRect(3,31,34,5);g.fillStyle='#53606a';g.fillRect(4,10,7,25);
  g.fillStyle='#899ca0';g.fillRect(6,9,3,21);g.fillStyle='#4e6773';g.fillRect(7,7,23,6);
  g.fillStyle='#283741';g.fillRect(26,7,6,25);g.fillStyle='#b4a47c';g.fillRect(24,10,9,3);
  g.fillStyle='#aa744d';g.fillRect(23,23,12,4);g.fillStyle='#d6b585';g.fillRect(27,16,5,4);
 });
 const c01_roof_dormer=factory(52,34,g=>{
  g.fillStyle='rgba(19,21,24,.35)';g.fillRect(4,30,42,3);
  g.fillStyle='#363940';g.fillRect(6,14,40,17);g.fillStyle='#b2a38c';g.fillRect(10,14,32,13);
  g.fillStyle='#292d36';g.fillRect(2,15,48,4);g.fillStyle='#63524a';g.fillRect(9,12,34,4);
  g.fillStyle='#d3b98a';g.fillRect(14,15,25,3);g.fillStyle='#56616c';g.fillRect(17,19,19,7);
  g.fillStyle='#9fb1b8';g.fillRect(20,20,12,4);g.fillStyle='#323840';g.fillRect(25,18,3,10);
  g.fillStyle='#e1bf85';g.fillRect(8,7,37,5);g.fillStyle='#4e4c4c';g.fillRect(13,3,28,6);
 });
 return {c01_city_banner,c01_arched_gate,c01_canopy_market,c01_cargo_hook,c01_quay_lamp,c01_mooring,c01_rope_cart,c01_white_salt_pan,c01_brine_pipe,c01_roof_dormer};
}
/** Render same physical pier geometry with harbor-specific masonry, timber, salt staining. */
export function drawUrbanHarborDeckTile(g:CanvasRenderingContext2D,x:number,y:number,id:string,edges:number):void {
 const salt=id.startsWith('po_saltharbor.'),west=id.startsWith('po_westmouth.'),gulf=id.startsWith('po_gulfhead.'),elev=/skywalk|gallery|gantry|balcony|veranda|lookout|canopy|high|arcades/i.test(id);
 const X=x*16,Y=y*16;
 const dark=salt?'#586168':west?'#454c51':'#413e37',mid=salt?'#a6aea8':west?'#857965':'#98744f',hi=salt?'#d9d7b6':west?'#b9aa89':'#c3a778';
 g.fillStyle='rgba(16,26,33,.48)';g.fillRect(X+1,Y+2,15,14);g.fillStyle=dark;g.fillRect(X,Y,16,16);
 if(salt&&!elev){for(let r=0;r<3;r++){g.fillStyle=(r+x+y)%3?mid:hi;g.fillRect(X+1,Y+r*5+1,14,4);g.fillStyle=dark;g.fillRect(X+1,Y+r*5+5,14,1)}g.fillStyle='#e3d9b8';if((x*7+y*3)%4===0)g.fillRect(X+8,Y+3,5,3)}
 else for(let r=0;r<4;r++){g.fillStyle=((r+x+2*y)%4===0)?hi:mid;g.fillRect(X+1,Y+r*4,14,3);g.fillStyle=dark;g.fillRect(X,Y+r*4+3,16,1);g.fillStyle='rgba(25,20,14,.3)';if((x+y+r)%5===0)g.fillRect(X+4+r*2,Y+r*4+1,2,1)}
 if(elev){g.fillStyle='#b59a76';g.fillRect(X+2,Y+6,12,1);g.fillStyle='#d7c08e';if(x%3===0)g.fillRect(X+12,Y+2,1,3)}
 if(edges&1){g.fillStyle=hi;g.fillRect(X+2,Y,2,3);g.fillRect(X+13,Y,2,3);g.fillStyle=dark;g.fillRect(X,Y,16,1)}
 if(edges&2){g.fillStyle=dark;g.fillRect(X,Y+14,16,2);g.fillStyle=hi;g.fillRect(X+11,Y+13,2,3)}
 if(edges&4){g.fillStyle=dark;g.fillRect(X,Y,2,16);if(y%3===0){g.fillStyle=hi;g.fillRect(X,Y+4,3,2)}}
 if(edges&8){g.fillStyle=dark;g.fillRect(X+14,Y,2,16);if(y%3===0){g.fillStyle=hi;g.fillRect(X+13,Y+7,3,2)}}
}