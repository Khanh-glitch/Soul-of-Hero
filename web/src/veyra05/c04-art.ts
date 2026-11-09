/** C04 handmade pixel visual grammar. No sourced/proprietary assets, no Gameplay. */
import {mk,type Sprite} from '../game/art';
export function makeWaterfrontSprites(factory:typeof mk):Record<string,Sprite> {
 const c04_quay_sign=factory(26,29,g=>{g.fillStyle='#322b25';g.fillRect(11,7,4,22);g.fillRect(2,3,23,14);g.fillStyle='#c09b65';g.fillRect(3,4,21,11);g.fillStyle='#eee0ae';g.fillRect(5,5,17,2);g.fillRect(5,12,15,1);g.fillStyle='#4c6065';g.fillRect(7,9,7,3);g.fillStyle='#c0a365';g.fillRect(12,16,2,9);});
 const c04_rope_pulley=factory(35,43,g=>{g.fillStyle='#313638';g.fillRect(6,39,24,3);g.fillStyle='#a87c4b';g.fillRect(7,9,5,31);g.fillRect(8,8,24,4);g.fillStyle='#433e3a';g.fillRect(28,12,3,15);g.fillStyle='#d2c19b';g.fillRect(27,14,2,16);g.fillStyle='#998272';g.fillRect(24,28,8,4);g.fillStyle='#d1b074';g.fillRect(29,31,3,6);g.fillStyle='#554c3a';g.fillRect(4,34,15,4);});
 const c04_bollard=factory(17,26,g=>{g.fillStyle='#22262b';g.fillRect(6,22,10,3);g.fillStyle='#47372c';g.fillRect(6,5,6,19);g.fillStyle='#aa8053';g.fillRect(7,4,4,18);g.fillStyle='#d8be8d';g.fillRect(4,3,10,3);g.fillStyle='#b1a68a';g.fillRect(5,13,8,3);g.fillStyle='#e0c695';g.fillRect(5,13,5,1);});
 const c04_lamp=factory(22,37,g=>{g.fillStyle='#32312d';g.fillRect(8,17,5,20);g.fillStyle='#a78a5e';g.fillRect(10,17,2,18);g.fillStyle='#252d33';g.fillRect(4,8,14,4);g.fillRect(5,18,12,3);g.fillStyle='#b3834b';g.fillRect(6,11,10,7);g.fillStyle='#fce9aa';g.fillRect(8,12,6,5);g.fillStyle='#fcbd64';g.fillRect(10,13,2,4);g.fillStyle='#4b4540';g.fillRect(7,5,8,3);});
 const c04_signal=factory(30,39,g=>{g.fillStyle='#4a4037';g.fillRect(13,4,4,35);g.fillStyle='#aa9067';g.fillRect(14,6,2,32);g.fillStyle='#e1b76b';g.fillRect(1,10,28,3);g.fillStyle='#c34f42';g.fillRect(19,12,9,11);g.fillStyle='#e9cd94';g.fillRect(20,13,6,3);g.fillStyle='#333b40';g.fillRect(13,1,4,7);});
 const c04_tide_gate=factory(26,28,g=>{g.fillStyle='#343837';g.fillRect(2,2,22,24);g.fillStyle='#6b7777';g.fillRect(5,4,16,20);for(let x=6;x<21;x+=4){g.fillStyle='#273f49';g.fillRect(x,5,2,18)}g.fillStyle='#b2aaa1';g.fillRect(4,15,19,3);g.fillStyle='#bda978';g.fillRect(9,2,8,4);});
 const c04_torn_notice=factory(23,27,g=>{g.fillStyle='#423127';g.fillRect(2,3,19,22);g.fillStyle='#ccb58e';g.fillRect(4,4,15,17);g.fillStyle='#e7cf9e';g.fillRect(5,5,12,11);g.fillStyle='#746c5e';for(let y=8;y<18;y+=3)g.fillRect(7,y,8,1);g.fillStyle='#8d573d';g.fillRect(15,20,5,5);g.fillStyle='#242326';g.fillRect(4,3,2,3);});
 const c04_splinter_pile=factory(35,20,g=>{g.fillStyle='rgba(20,30,29,.45)';g.fillRect(2,16,30,4);g.fillStyle='#40352c';g.fillRect(4,10,27,4);g.fillRect(5,4,22,3);g.fillStyle='#a48056';g.fillRect(3,9,20,3);g.fillRect(7,3,18,2);g.fillStyle='#c7a77d';g.fillRect(15,7,16,2);g.fillStyle='#30332f';g.fillRect(19,13,4,5);});
 const c04_broken_post=factory(24,33,g=>{g.fillStyle='#303138';g.fillRect(7,27,15,4);g.fillStyle='#544132';g.fillRect(9,9,8,22);g.fillStyle='#977148';g.fillRect(10,9,5,17);g.fillStyle='#c7a879';g.fillRect(10,6,2,7);g.fillRect(12,3,2,4);g.fillStyle='#2d302e';g.fillRect(13,2,4,5);g.fillStyle='#d1c39e';g.fillRect(8,20,9,2);});
 const c04_warning=factory(23,29,g=>{g.fillStyle='#3a302b';g.fillRect(10,7,4,21);g.fillRect(2,2,19,17);g.fillStyle='#d2a55f';g.fillRect(4,4,15,13);g.fillStyle='#342e30';g.fillRect(10,6,2,7);g.fillRect(10,14,2,2);g.fillStyle='#e3d3a4';g.fillRect(4,4,15,1);});
 const c04_crow=factory(27,16,g=>{g.fillStyle='#293438';g.fillRect(6,6,15,7);g.fillRect(4,4,9,3);g.fillRect(16,3,7,5);g.fillStyle='#586368';g.fillRect(7,7,7,3);g.fillStyle='#d0a970';g.fillRect(22,6,4,2);g.fillStyle='#d7d2b9';g.fillRect(19,5,1,1);g.fillStyle='#332d2b';g.fillRect(10,13,1,3);g.fillRect(17,13,1,3);});
 const c04_algae_sluice=factory(24,18,g=>{g.fillStyle='#344951';g.fillRect(2,5,20,10);g.fillStyle='#567c7c';g.fillRect(4,6,16,5);g.fillStyle='#819b6d';for(let x=5;x<20;x+=4)g.fillRect(x,10,2,5);g.fillStyle='#b4bca0';g.fillRect(2,4,20,2);});
 const c04_tern=factory(25,18,g=>{g.fillStyle='#d5d7ca';g.fillRect(6,8,14,6);g.fillRect(12,4,8,5);g.fillStyle='#f0eacc';g.fillRect(5,8,12,3);g.fillStyle='#586574';g.fillRect(8,10,9,3);g.fillStyle='#c2a46b';g.fillRect(20,7,5,2);g.fillStyle='#2d333b';g.fillRect(18,6,2,2);g.fillStyle='#a55b45';g.fillRect(10,14,1,3);g.fillRect(14,14,1,3);});
 const c04_feather_basket=factory(21,17,g=>{g.fillStyle='#6c4c32';g.fillRect(2,8,17,8);g.fillStyle='#aa8d57';g.fillRect(3,9,15,5);g.fillStyle='#d4d6d0';g.fillRect(6,4,3,7);g.fillRect(11,2,2,9);g.fillRect(14,5,3,6);g.fillStyle='#6c5a45';g.fillRect(4,13,14,2);});
 const c04_reed_screen=factory(35,28,g=>{g.fillStyle='#463d2d';g.fillRect(3,4,3,23);g.fillRect(28,4,3,23);g.fillStyle='#8e9a64';g.fillRect(5,8,24,13);for(let x=7;x<28;x+=4){g.fillStyle='#c2ba87';g.fillRect(x,4+(x%3),2,18)}g.fillStyle='#655139';g.fillRect(3,6,28,2);g.fillRect(3,21,28,2);});
 const fish_drying_rack=factory(29,24,g=>{g.fillStyle='#543a27';g.fillRect(2,3,3,21);g.fillRect(24,3,3,21);g.fillRect(3,5,22,3);for(let x=7;x<23;x+=5){g.fillStyle='#98afb0';g.fillRect(x,9,4,11);g.fillStyle='#d7d9c2';g.fillRect(x+1,10,1,7);g.fillStyle='#243949';g.fillRect(x+2,12,1,1)}});
 const rope_coil=factory(18,14,g=>{g.fillStyle='#392b24';g.fillRect(1,8,16,5);g.fillStyle='#bca279';for(let r=1;r<5;r+=2){g.beginPath();g.lineWidth=2;g.strokeStyle='#bca279';g.ellipse(9,7,r+3,r,0,0,6.29);g.stroke()}});
 return {c04_quay_sign,c04_rope_pulley,c04_bollard,c04_lamp,c04_signal,c04_tide_gate,c04_torn_notice,c04_splinter_pile,c04_broken_post,c04_warning,c04_crow,c04_algae_sluice,c04_tern,c04_feather_basket,c04_reed_screen,fish_drying_rack,rope_coil};
}
export function drawWaterfrontDeckTile(g:CanvasRenderingContext2D,x:number,y:number,poiId:string,edgeMask:number):void{
 const X=x*16,Y=y*16, ruin=poiId.startsWith('po_dpier.'), tern=poiId.startsWith('po_gullpier.'), west=poiId.startsWith('po_westbank.');
 const raised=/truss|skyway|gallery|trestle|perch|platform|veranda/.test(poiId);
 const dark=ruin?'#333d3b':tern?'#4c4a38':west?'#48382c':'#49372d';
 const mid=ruin?'#687574':tern?'#9d986b':west?'#98724c':'#886544';
 const hi=ruin?'#9ca4a2':tern?'#cbc89b':west?'#c4a072':'#c2a075';
 g.fillStyle='rgba(8,17,22,.55)';g.fillRect(X+1,Y+2,15,14);
 g.fillStyle=dark;g.fillRect(X,Y,16,16);
 for(let i=0;i<4;i++){let yy=Y+i*4;g.fillStyle=((x*17+y*11+i*13)%5<2)?hi:mid;g.fillRect(X+1,yy,14,3);g.fillStyle='rgba(15,15,17,.32)';g.fillRect(X,yy+3,16,1);if((x+y+i)%7===0){g.fillStyle=dark;g.fillRect(X+3+i*3,yy,2,2)}}
 if(ruin){g.fillStyle='#293235';if((x*5+y*3)%9===0){g.fillRect(X+8,Y+4,6,2);g.fillRect(X+11,Y+8,3,4)}}
 if(raised){g.fillStyle='#e0c496';if((x+y)%3===0)g.fillRect(X+4,Y+4,2,2);g.fillStyle=dark;g.fillRect(X+1,Y+8,14,1)}
 // Railing posts/beam ends are drawn only on exterior deck tile edges.
 if(edgeMask&1){g.fillStyle='#d0b88b';g.fillRect(X+2,Y,3,2);g.fillRect(X+13,Y,2,2);g.fillStyle='#392e28';g.fillRect(X,Y,16,1)}
 if(edgeMask&2){g.fillStyle=dark;g.fillRect(X,Y+15,16,1);g.fillStyle='#d5b382';g.fillRect(X+2,Y+13,2,3)}
 if(edgeMask&4){g.fillStyle=dark;g.fillRect(X,Y,2,16);if(y%3===0){g.fillStyle='#c6b18a';g.fillRect(X,Y+4,3,4)}}
 if(edgeMask&8){g.fillStyle=dark;g.fillRect(X+14,Y,2,16);if(y%3===0){g.fillStyle='#c6b18a';g.fillRect(X+13,Y+7,3,3)}}
}