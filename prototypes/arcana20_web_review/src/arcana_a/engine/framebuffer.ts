/** P0 A world-field framebuffer subset. HDR ink, authored coverage and bloom. */
export class Framebuffer {
 readonly W:number;readonly H:number;readonly bw:number;readonly bh:number;
 readonly buf:Float32Array;readonly coverage:Float32Array;readonly multiplier:Float32Array;readonly influence:Uint8Array;
 readonly bloomA:Float32Array;readonly bloomB:Float32Array;
 constructor(W=416,H=234){this.W=W;this.H=H;this.bw=W>>2;this.bh=H>>2;this.buf=new Float32Array(W*H*3);this.coverage=new Float32Array(W*H);this.multiplier=new Float32Array(W*H);this.influence=new Uint8Array(W*H);this.bloomA=new Float32Array(this.bw*this.bh*3);this.bloomB=new Float32Array(this.bw*this.bh*3);}
 clear(){this.buf.fill(0);this.coverage.fill(0);this.multiplier.fill(1);this.influence.fill(0);}
 private splat(x:number,y:number,r:number,g:number,b:number,w:number){if(x<0||y<0||x>=this.W||y>=this.H)return;const p=y*this.W+x,i=p*3;if(w!==0)this.influence[p]=1;this.buf[i]+=r*w;this.buf[i+1]+=g*w;this.buf[i+2]+=b*w;}
 add(x:number,y:number,r:number,g:number,b:number,a=1){const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;if(fx<.02&&fy<.02){this.splat(x0,y0,r,g,b,a);return;}this.splat(x0,y0,r,g,b,(1-fx)*(1-fy)*a);this.splat(x0+1,y0,r,g,b,fx*(1-fy)*a);this.splat(x0,y0+1,r,g,b,(1-fx)*fy*a);this.splat(x0+1,y0+1,r,g,b,fx*fy*a);}
 addPx(x:number,y:number,r:number,g:number,b:number,a=1){this.splat(x|0,y|0,r,g,b,a);}
 blend(x:number,y:number,r:number,g:number,b:number,a:number){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=this.W||y>=this.H)return;const p=y*this.W+x,i=p*3,ia=1-a;this.coverage[p]=a+this.coverage[p]*ia;this.influence[p]=1;this.buf[i]=this.buf[i]*ia+r*a;this.buf[i+1]=this.buf[i+1]*ia+g*a;this.buf[i+2]=this.buf[i+2]*ia+b*a;}
 mul(x:number,y:number,m:number){x=Math.floor(x);y=Math.floor(y);if(x<0||y<0||x>=this.W||y>=this.H)return;const p=y*this.W+x,i=p*3;this.multiplier[p]*=m;this.influence[p]=1;this.buf[i]*=m;this.buf[i+1]*=m;this.buf[i+2]*=m;}
 computeBloom(){const {W,H,bw,bh,buf,bloomA:a,bloomB:b}=this,weights=[.0702,.1311,.1907,.216,.1907,.1311,.0702];a.fill(0);
  for(let y=0;y<H;y++){if((y>>2)>=bh)continue;for(let x=0;x<W;x++){const i=(y*W+x)*3,o=((y>>2)*bw+(x>>2))*3,l=buf[i]*.3+buf[i+1]*.55+buf[i+2]*.15;if(l>.65){const k=((l-.65)/(l+1e-5))*.0625;a[o]+=buf[i]*k;a[o+1]+=buf[i+1]*k;a[o+2]+=buf[i+2]*k;}}}
  for(let pass=0;pass<2;pass++){for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const o=(y*bw+x)*3;for(let c=0;c<3;c++){let v=0;for(let k=-3;k<=3;k++)v+=a[(y*bw+Math.max(0,Math.min(bw-1,x+k)))*3+c]*weights[k+3];b[o+c]=v;}}
   for(let y=0;y<bh;y++)for(let x=0;x<bw;x++){const o=(y*bw+x)*3;for(let c=0;c<3;c++){let v=0;for(let k=-3;k<=3;k++)v+=b[(Math.max(0,Math.min(bh-1,y+k))*bw+x)*3+c]*weights[k+3];a[o+c]=v;}}}
 }
}
