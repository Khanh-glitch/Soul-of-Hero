/** Original, deterministic industrial waterfront 1x pixel drawings — C02. */
import {mk,type Sprite} from '../game/art';
export function makeIndustrialHarborSprites(factory:typeof mk):Record<string,Sprite>{
 const c02_ore_tipple=factory(70,67,g=>{
  g.fillStyle='rgba(7,16,18,.42)';g.fillRect(6,60,64,6);
  g.fillStyle='#323c44';g.fillRect(6,18,7,43);g.fillRect(56,18,8,43);g.fillRect(12,14,48,7);
  g.fillStyle='#9d7c58';g.fillRect(13,17,44,4);g.fillStyle='#cfaa73';g.fillRect(20,12,25,4);
  g.fillStyle='#59656a';g.fillRect(16,24,38,12);g.fillStyle='#212d36';g.fillRect(20,26,33,8);
  g.fillStyle='#ad864f';g.fillRect(30,36,20,7);g.fillStyle='#6d5340';g.fillRect(35,42,12,15);
  g.fillStyle='#c2b59b';g.fillRect(34,44,3,13);g.fillRect(45,44,3,11);
  g.fillStyle='#313a3b';for(let i=0;i<5;i++)g.fillRect(14+i*9,21,2,23);
  g.fillStyle='#caa270';g.fillRect(5,58,58,3);g.fillStyle='#d0a568';g.fillRect(22,48,27,3);
 });
 const c02_rail_wagon=factory(58,37,g=>{
  g.fillStyle='rgba(21,22,23,.4)';g.fillRect(4,30,52,5);g.fillStyle='#303e43';g.fillRect(2,18,53,15);
  g.fillStyle='#99734e';g.fillRect(5,13,49,16);g.fillStyle='#b69a65';g.fillRect(7,13,45,3);
  g.fillStyle='#333b3c';g.fillRect(9,16,39,9);g.fillStyle='#6e7873';g.fillRect(10,17,36,7);
  g.fillStyle='#cfad76';g.fillRect(15,19,24,2);g.fillStyle='#293039';g.fillRect(10,28,8,8);g.fillRect(40,28,9,8);
  g.fillStyle='#9fa19c';g.fillRect(12,31,4,3);g.fillRect(43,31,4,3);g.fillStyle='#bd915d';g.fillRect(1,25,55,3);
 });
 const c02_chain_gantry=factory(78,79,g=>{
  g.fillStyle='rgba(17,22,27,.38)';g.fillRect(8,72,66,6);
  g.fillStyle='#343e45';g.fillRect(8,17,10,57);g.fillRect(62,17,10,57);g.fillRect(12,10,57,9);
  g.fillStyle='#b28152';g.fillRect(9,19,6,52);g.fillRect(64,19,6,52);g.fillRect(18,12,46,5);
  g.fillStyle='#ded0a5';g.fillRect(22,13,35,2);g.fillStyle='#576b71';g.fillRect(20,21,41,6);
  g.fillStyle='#34383b';g.fillRect(38,24,4,31);
  for(let i=0;i<5;i++){g.fillStyle='#b2b5a8';g.fillRect(39,28+i*5,2,2)}
  g.fillStyle='#dfb770';g.fillRect(32,55,17,4);g.fillStyle='#7e5937';g.fillRect(33,60,15,11);
  g.fillStyle='#333944';g.fillRect(28,68,27,4);g.fillStyle='#e6c487';g.fillRect(17,8,39,3);
 });
 const c02_industrial_chimney=factory(42,90,g=>{
  g.fillStyle='rgba(24,21,20,.38)';g.fillRect(9,82,28,6);g.fillStyle='#3c3634';g.fillRect(11,12,24,70);
  g.fillStyle='#996a55';g.fillRect(14,13,18,66);g.fillStyle='#c89567';g.fillRect(17,15,5,60);
  g.fillStyle='#45444b';for(let y=19;y<77;y+=13)g.fillRect(10,y,26,4);
  g.fillStyle='#c5b19a';g.fillRect(9,10,28,5);g.fillStyle='#2c3138';g.fillRect(12,6,22,7);
  g.fillStyle='#e2b57c';g.fillRect(16,4,17,3);g.fillStyle='#62686b';g.fillRect(22,1,12,4);
 });
 const c02_steel_truss=factory(77,37,g=>{
  g.fillStyle='rgba(12,19,26,.38)';g.fillRect(3,31,70,5);
  g.fillStyle='#33424c';g.fillRect(2,7,72,5);g.fillRect(2,26,72,6);
  g.fillStyle='#a5977c';g.fillRect(3,9,70,3);g.fillRect(3,28,70,3);
  g.strokeStyle='#b2a38b';g.lineWidth=3;for(let x=4;x<68;x+=12){g.beginPath();g.moveTo(x,12);g.lineTo(x+12,26);g.moveTo(x+12,12);g.lineTo(x,26);g.stroke()}
  g.fillStyle='#272c33';for(let x=4;x<76;x+=12){g.fillRect(x,10,3,18)}
 });
 const c02_ore_bins=factory(59,41,g=>{
  g.fillStyle='rgba(20,16,17,.35)';g.fillRect(5,34,49,5);g.fillStyle='#313d45';g.fillRect(4,10,50,26);
  g.fillStyle='#8c6c4d';g.fillRect(6,11,46,5);g.fillStyle='#c1a073';g.fillRect(8,13,43,2);
  for(let x=8;x<51;x+=15){g.fillStyle='#3e4f57';g.fillRect(x,18,12,14);g.fillStyle='#767d78';g.fillRect(x+2,19,9,9);g.fillStyle='#bd976b';g.fillRect(x+4,17,4,3)}
  g.fillStyle='#222f33';g.fillRect(2,31,54,5);g.fillStyle='#c6b08b';g.fillRect(12,35,37,2);
 });
 const c02_warning_lamp=factory(29,42,g=>{
  g.fillStyle='rgba(21,27,24,.3)';g.fillRect(7,37,21,4);g.fillStyle='#38434c';g.fillRect(11,13,6,27);
  g.fillStyle='#b5a585';g.fillRect(13,15,2,22);g.fillStyle='#252c35';g.fillRect(5,6,19,7);
  g.fillStyle='#eabb5e';g.fillRect(9,11,12,11);g.fillStyle='#ffeb9b';g.fillRect(12,12,7,7);
  g.fillStyle='#604336';g.fillRect(10,23,12,3);g.fillStyle='#b49464';g.fillRect(3,3,23,4);
 });
 const c02_heat_grate=factory(45,29,g=>{
  g.fillStyle='#313a3c';g.fillRect(2,6,41,21);g.fillStyle='#8a7563';g.fillRect(5,9,35,16);
  for(let x=7;x<40;x+=5){g.fillStyle='#252e36';g.fillRect(x,9,2,16);g.fillStyle='#b79c72';g.fillRect(x+2,11,2,12)}
  g.fillStyle='#c55d39';g.fillRect(7,14,29,2);g.fillStyle='#9c4b34';g.fillRect(5,23,35,3);
  g.fillStyle='#d3b38b';g.fillRect(4,5,36,3);
 });
 const c02_tide_gate=factory(69,58,g=>{
  g.fillStyle='rgba(14,21,29,.4)';g.fillRect(5,51,61,5);
  g.fillStyle='#313941';g.fillRect(5,9,8,45);g.fillRect(57,9,8,45);
  g.fillStyle='#a59c87';g.fillRect(8,10,5,40);g.fillRect(58,10,5,40);
  g.fillStyle='#4e5a63';g.fillRect(13,18,44,30);g.fillStyle='#7d817d';g.fillRect(16,20,38,24);
  g.fillStyle='#a98f72';for(let y=21;y<44;y+=6)g.fillRect(16,y,38,2);
  g.fillStyle='#303c44';for(let x=20;x<53;x+=8)g.fillRect(x,14,3,33);
  g.fillStyle='#dbb986';g.fillRect(10,5,52,6);g.fillStyle='#a78960';g.fillRect(21,2,29,3);
 });
 const c02_counterweight=factory(50,63,g=>{
  g.fillStyle='rgba(23,25,26,.38)';g.fillRect(6,56,40,6);
  g.fillStyle='#3d4751';g.fillRect(5,12,9,48);g.fillRect(37,12,9,48);
  g.fillStyle='#b9a885';g.fillRect(7,14,6,40);g.fillRect(39,14,6,40);
  g.fillStyle='#252e34';g.fillRect(7,10,39,5);
  g.fillStyle='#bd955f';g.fillRect(14,18,23,5);g.fillStyle='#697479';g.fillRect(18,23,16,26);
  g.fillStyle='#d0c2a3';g.fillRect(20,25,3,21);g.fillStyle='#252d35';g.fillRect(24,4,5,35);
  g.fillStyle='#e0b874';g.fillRect(20,48,14,5);g.fillStyle='#353f43';g.fillRect(16,53,22,5);
 });
 return {c02_ore_tipple,c02_rail_wagon,c02_chain_gantry,c02_industrial_chimney,c02_steel_truss,c02_ore_bins,c02_warning_lamp,c02_heat_grate,c02_tide_gate,c02_counterweight};
}
export function drawIndustrialHarborTile(g:CanvasRenderingContext2D,x:number,y:number,id:string,edges:number):void {
 const iron=id.startsWith('po_ironharbor.'),ember=id.startsWith('po_ember.'),sand=id.startsWith('po_sandgate.');
 const high=/rail|bridge|truss|belt|gantry|gatewalk|sky|overhead|control|stack/i.test(id);const X=x*16,Y=y*16;
 const deep=iron?'#303e47':ember?'#3f3537':'#485057';const line=iron?'#7b8990':ember?'#98755b':'#a9a69b';const trim=iron?'#c1b89c':ember?'#d19b66':'#d8cfab';
 g.fillStyle='rgba(16,20,29,.35)';g.fillRect(X+1,Y+2,15,14);g.fillStyle=deep;g.fillRect(X,Y,16,16);
 if(sand&&!high){for(let r=0;r<4;r++){g.fillStyle=r%2?line:trim;g.fillRect(X+1,Y+4*r,14,3);g.fillStyle=deep;g.fillRect(X,Y+4*r+3,16,1)}}
 else{for(let r=0;r<4;r++){g.fillStyle=((x*3+y+r)%5===0)?trim:line;g.fillRect(X+1,Y+r*4,14,3);g.fillStyle=deep;g.fillRect(X,Y+r*4+3,16,1);if((r+x+y)%7===0){g.fillStyle='#353c3c';g.fillRect(X+4,Y+r*4+1,4,1)}}}
 if(ember){g.fillStyle='#7a4b3a';if((x+3*y)%9===0)g.fillRect(X+3,Y+4,8,2)}
 if(high){g.fillStyle=deep;g.fillRect(X+7,Y+1,2,14);g.fillStyle=trim;g.fillRect(X+3,Y+3,10,1)}
 if(edges&1){g.fillStyle=trim;g.fillRect(X+2,Y,3,2);g.fillRect(X+12,Y,3,2)}
 if(edges&2){g.fillStyle=deep;g.fillRect(X,Y+14,16,2);g.fillStyle=trim;g.fillRect(X+4,Y+13,3,2)}
 if(edges&4){g.fillStyle=deep;g.fillRect(X,Y,2,16);g.fillStyle=trim;if(y%3===0)g.fillRect(X,Y+6,3,2)}
 if(edges&8){g.fillStyle=deep;g.fillRect(X+14,Y,2,16);g.fillStyle=trim;if(y%3===0)g.fillRect(X+13,Y+5,3,2)}
}