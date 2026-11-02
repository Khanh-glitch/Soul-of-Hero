/** P0 #16 A growth with selected C material. Isolated source role; incomplete
 * until C shared-clock fusion, world output and review are done. */
import {Framebuffer} from './engine/framebuffer';import {Pool} from './engine/particles';
import {field,glow,streak,pulseRing} from './engine/draw';
import {RNG,TAU,lerp,seg,easeOut,smoothstep,hash2 as aHash2} from './engine/math';
import {P,ramp,rampD,type RGB} from '../arcana_c/engine/palette';import {bayer,inv,hash2} from '../arcana_c/engine/math';
const C={x:232,y:124},SQ=1.45;const round=(x:number)=>x<0?-Math.round(-x):Math.round(x);
function cSurface(layer:number,petal:number,u:number,v:number,x:number,y:number,t:number):RGB{const av=Math.abs(v),th=bayer(round(x),round(y));if(layer===0)return rampD(P.gold,.55+.4*(1-av),th);if(layer===1){const cu=u*7+hash2(petal,Math.floor(u*7))*.3,cv=(v+1)*2.5,wall=cu%1<.16||cv%1<.16;return av>.85?ramp(P.bloom,.15):rampD(P.bloom,.25+.42*(1-av)+(wall?.15:0),th);}const unfold=easeOut(inv(2.6,6,t),2);let tone=.28+.2*(1-av);if(av<.1)tone+=.25;if(((u*9-av*1.5)%1+1)%1<.12)tone+=.12;if(unfold<1&&u>.86)tone+=.25;if(av>.86)tone=.12;return rampD(P.leaf,tone,th);}
function inkSplat(f:Framebuffer,x:number,y:number,c:RGB){const x0=Math.floor(x),y0=Math.floor(y),fx=x-x0,fy=y-y0;if(fx<.02&&fy<.02){f.blend(x0,y0,...c,1);return;}f.blend(x0,y0,...c,(1-fx)*(1-fy));f.blend(x0+1,y0,...c,fx*(1-fy));f.blend(x0,y0+1,...c,(1-fx)*fy);f.blend(x0+1,y0+1,...c,fx*fy);}
/** Exact A noise lattice reused across the authored dense sheet samples. */
export class WorldseedNoise {
 private minY:number;private data:Float64Array;private readonly width=151;
 constructor(t:number){this.minY=Math.floor(Math.min(-t*1.1,-t*1.1*4))-1;const maxY=Math.ceil(Math.max(5-t*1.1,(5-t*1.1)*4))+1;this.data=new Float64Array((maxY-this.minY+1)*this.width);for(let y=this.minY;y<=maxY;y++)for(let x=0;x<this.width;x++)this.data[(y-this.minY)*this.width+x]=aHash2(x,y);}
 x(x:number){const out:number[]=[];for(let i=0;i<3;i++){const n=Math.floor(x),f=x-n;out.push(n,f*f*(3-2*f));x*=2;}return out;}
 y(y:number){const out:number[]=[];for(let i=0;i<3;i++){const n=Math.floor(y),f=y-n;out.push((n-this.minY)*this.width,f*f*(3-2*f));y*=2;}return out;}
 sample(x:number[],y:number[]){let a=.5,s=0,n=0;for(let i=0;i<3;i++){const at=x[i*2]+y[i*2],u=x[i*2+1],v=y[i*2+1],d=this.data,l0=lerp(d[at],d[at+1],u),l1=lerp(d[at+this.width],d[at+this.width+1],u);s+=a*lerp(l0,l1,v);n+=a;a*=.5;}return s/n;}
}
export class WorldseedGrowth {
  rng = new RNG(0x5eed);
  layers: {
    count: number;
    len: number;
    w: number;
    t0: number;
    sp: number;
    tilt: number;
    hue: number;
    tremble: number;
  }[] = [];
  pollen = new Pool();
  CRACK = 2.0;
  BLOOM = 5.3;
  FOLD = 6.8;

  constructor() {
    const r = this.rng;
    const specs = [
      { count: 5, len: 26, w: 0.55, t0: 2.1, sp: 1.1, hue: 0.35, tremble: 2 },
      { count: 8, len: 46, w: 0.42, t0: 2.5, sp: 0.75, hue: 0.55, tremble: 1.2 },
      { count: 12, len: 74, w: 0.3, t0: 3.0, sp: 0.5, hue: 0.72, tremble: 0.6 },
      { count: 16, len: 104, w: 0.22, t0: 3.6, sp: 0.36, hue: 0.9, tremble: 0.3 },
    ];
    for (const s of specs) this.layers.push({ ...s, tilt: r.angle() });
  }

  update(dt: number, t: number) {
    if (t < this.CRACK && this.pollen.count() < 40 && this.rng.next() < 0.4) {
      const a = this.rng.angle();
      this.pollen.spawn({
        x: C.x + Math.cos(a) * this.rng.range(8, 22),
        y: C.y + (Math.sin(a) * this.rng.range(6, 16)) / SQ,
        vx: this.rng.range(-5, 5),
        vy: this.rng.range(-8, 2),
        life: 3,
        k: 0,
        seed: this.rng.next() * 999,
      });
    }
    if (t > this.BLOOM && t < this.BLOOM + 0.7 && this.pollen.count() < 520) {
      for (let i = 0; i < 24; i++) {
        const a = this.rng.angle();
        const sp = this.rng.range(30, 230);
        this.pollen.spawn({
          x: C.x,
          y: C.y,
          vx: Math.cos(a) * sp,
          vy: (Math.sin(a) * sp) / SQ,
          life: this.rng.range(1.2, 3.0),
          k: this.rng.next(),
          a: this.rng.angle(),
          av: this.rng.range(-4, 4),
          size: this.rng.range(0.8, 2.4),
          seed: this.rng.next() * 999,
        });
      }
    }
    this.pollen.each((p) => {
      p.vx *= Math.exp(-1.1 * dt);
      p.vy *= Math.exp(-1.1 * dt);
      p.vy -= 8 * dt;
    });
    this.pollen.step(dt);
  }

  casterLight(t: number) {
    return 0.15 + 0.5 * seg(t, 2, 5) + 1.1 * (1 - seg(t, this.BLOOM, this.BLOOM + 0.9));
  }

  fragmentGravityAxis={x:0,y:1};
  private fragments(f:Framebuffer,t:number){
    if(t<this.FOLD||t>=9)return;
    for(let li=0;li<this.layers.length;li++){const layer=this.layers[li];for(let petal=0;petal<layer.count;petal++){
      const detach=this.FOLD+.025*((petal+li*3)%9);if(t<detach)continue;const age=Math.max(0,t-detach),alpha=smoothstep(0,.16,age)*(1-smoothstep(1,2,age));if(alpha<=.001)continue;
      const sourceFold=seg(detach,this.FOLD,8);let u=easeOut(seg(detach,layer.t0,layer.t0+1/layer.sp),2);u*=1-easeOut(sourceFold,1.6);const bloomK=seg(detach,this.BLOOM,this.BLOOM+.5),pulse=bloomK>0?1+.18*Math.sin(detach*7-li*1.2)*Math.max(0,1-(detach-this.BLOOM)*.6):1,len=layer.len*u*pulse,a0=layer.tilt+petal/layer.count*TAU,tremble=Math.sin(detach*(3+layer.tremble*3)+petal)*layer.tremble*.02;
      let points=Array.from({length:5},(_,j)=>{const pos=lerp(.5,.98,j/4),a=a0+tremble*pos+Math.sin(pos*2.5)*.12,r=(5+li*5)*u+len*pos;return{x:C.x+Math.cos(a)*r,y:C.y+Math.sin(a)*r/SQ-pos*pos*10*u};});const center=points[2],dx=center.x-C.x,dy=center.y-C.y,mag=Math.hypot(dx,dy)||1,travel=(1-Math.exp(-1.3*age))/1.3,velocity=16+(petal*7+li*11)%17,drift={x:dx/mag*velocity*travel+this.fragmentGravityAxis.x*9*age*age,y:dy/mag*velocity*travel+this.fragmentGravityAxis.y*9*age*age},spin=((petal+li)%2===0?-1:1)*age*(.35+(petal%4)*.12),co=Math.cos(spin),si=Math.sin(spin);points=points.map(p=>({x:center.x+(p.x-center.x)*co-(p.y-center.y)*si+drift.x,y:center.y+(p.x-center.x)*si+(p.y-center.y)*co+drift.y}));
      for(let i=0;i<4;i++){const p0=points[i],p1=points[i+1],vx=p1.x-p0.x,vy=p1.y-p0.y,d=Math.hypot(vx,vy),normal={x:-vy/(d||1),y:vx/(d||1)},steps=Math.max(1,Math.ceil(d));for(let k=0;k<steps;k++){const frac=k/steps,ss=(i+frac)/4,sourceU=lerp(.5,.98,ss),w=len*layer.w*Math.sin(Math.pow(sourceU,.6)*Math.PI)*(.6+.4*Math.sin(Math.PI*ss)),cx=lerp(p0.x,p1.x,frac),cy=lerp(p0.y,p1.y,frac);for(let j=-Math.ceil(w);j<=Math.ceil(w);j++){const v=j/Math.max(w,.001);if(Math.abs(v)>1)continue;const x=cx+normal.x*j,y=cy+normal.y*j,c=cSurface(li,petal,sourceU,v,x,y,t);f.blend(round(x),round(y),...c,alpha);}}}
    }}
  }
  render(fb: Framebuffer, t: number) {
    const crack = seg(t, this.CRACK, this.CRACK + 0.5);
    const fold = seg(t, this.FOLD, 8.0);
    const bloomK = seg(t, this.BLOOM, this.BLOOM + 0.5);

    // --- the seed
    const seedR = lerp(7, 10, Math.sin(t * 1.4) * 0.5 + 0.5) * (1 - crack * 0.35) * (1 - fold);
    if (seedR > 0.5) {
      const rot = t * 0.7;
      field(fb, C.x - seedR * 1.4, C.y - seedR * 1.4, C.x + seedR * 1.4, C.y + seedR * 1.4, (x, y, o) => {
        const dx = x - C.x,
          dy = (y - C.y) * 1.2;
        const d = Math.hypot(dx, dy);
        if (d > seedR) return;
        const a = Math.atan2(dy, dx) + rot;
        const veins = Math.abs(Math.sin(a * 3 + d * 0.5));
        let h = 0.22 + (1 - d / seedR) * 0.2 + veins * 0.35 * (1 - d / seedR);
        if (d > seedR - 1.2) h = 0.62;
        fb.blend(x,y,...rampD(P.leaf,h,bayer(x,y)),1);
      });
      glow(fb, C.x, C.y, seedR * 2.4, [1.0, 0.85, 0.4], 0.3 + crack * 0.6);
      if (crack > 0) {
        for (let i = -seedR; i <= seedR; i++) {
          const k = 1 - Math.abs(i) / seedR;
          fb.add(C.x + i * 0.3, C.y + i, 2.4 * k * crack, 2.2 * k * crack, 1.6 * k * crack, 1);
        }
      }
    }

    // --- the unfolding: each layer is a sheet of petals with its own speed
    const noise = t>=2.1&&fold<1?new WorldseedNoise(t):null;
    for (let li = this.layers.length - 1; li >= 0; li--) {
      const L = this.layers[li];
      let u = easeOut(seg(t, L.t0, L.t0 + 1 / L.sp), 2);
      if (fold > 0) u *= 1 - easeOut(fold, 1.6);
      if (u <= 0.01) continue;
      const pulse = bloomK > 0 ? 1 + 0.18 * Math.sin(t * 7 - li * 1.2) * Math.max(0, 1 - (t - this.BLOOM) * 0.6) : 1;
      for (let i = 0; i < L.count; i++) {
        const a0 = L.tilt + (i / L.count) * TAU;
        const len = L.len * u * pulse;
        const tremble = Math.sin(t * (3 + L.tremble * 3) + i) * L.tremble * 0.02;
        const us=Math.max(6,Math.ceil(len)),vs=Math.max(4,Math.ceil(len*L.w*.9));
        const ys=Array.from({length:vs+1},(_,jj)=>noise!.y(Math.abs(jj/vs*2-1)*5-t*1.1));
        for(let ii=0;ii<=us;ii++){const uu=ii/us,xNoise=noise!.x(uu*7+i*2),a=a0+tremble*uu+Math.sin(uu*2.5)*.12,ca=Math.cos(a),sa=Math.sin(a),rr=(5+li*5)*u+len*uu,wid=len*L.w*Math.sin(Math.pow(uu,.6)*Math.PI),wave=Math.max(0,Math.sin(uu*8-t*5+li*1.5));
          for(let jj=0;jj<=vs;jj++){const v=jj/vs*2-1,av=Math.abs(v),cell=noise!.sample(xNoise,ys[jj]),vein=Math.exp(-Math.pow(av*4,2))*.3;let h=.16+cell*.26+vein+Math.pow(av,4)*.5+wave*.2*(bloomK>0?1.6:.6);h*=(1-uu*.2)*smoothstep(.02,.26,uu);if(h<.05)continue;const x=C.x+ca*rr-sa*v*wid,y=C.y+(sa*rr+ca*v*wid)/SQ-uu*uu*10*u;inkSplat(fb,x,y,cSurface(li,i,uu,v,x,y,t));}
        }
      }
    }

    // --- the luminous core deep inside
    const coreU = seg(t, 4.0, this.BLOOM);
    if (coreU > 0 && fold < 1) {
      const rr = (3 + coreU * 9) * (1 + bloomK * 1.4) * (1 - fold);
      glow(fb, C.x, C.y - 4, rr * 1.9, [1.3, 1.2, 0.7], 0.3 + bloomK * 0.55);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU + t * 0.8;
        const c = ramp(P.gold, 0.8);
        streak(fb, C.x, C.y - 4, C.x + Math.cos(a) * rr, C.y - 4 + (Math.sin(a) * rr) / SQ, 1.4, 0.4, c, 0.8);
      }
    }

    if (bloomK > 0 && bloomK < 1) {
      const k = Math.sin(bloomK * Math.PI);
      pulseRing(fb, C.x, C.y, bloomK * 120, 30 * (1 - bloomK) + 6, ramp(P.bloom, 0.5), k * 0.22, SQ, 0.14, 1.3);
      fb.flash[0] += 0.1 * k * k;
      fb.flash[1] += 0.09 * k * k;
    }

    this.pollen.each((p) => {
      const l = p.life / p.max;
      const tw = 0.55 + 0.45 * Math.sin(t * 7 + p.seed);
      const c = p.k < 0.5 ? ramp(P.gold, 0.5 + l * 0.4) : ramp(P.bloom, 0.5 + l * 0.4);
      fb.add(p.x, p.y, c[0] * 0.6 * tw, c[1] * 0.6 * tw, c[2] * 0.6 * tw, l);
      if (p.size > 1.8) {
        const a = p.a + p.av * (p.max - p.life);
        fb.add(p.x + Math.cos(a) * 1.4, p.y + Math.sin(a), c[0] * 0.4, c[1] * 0.4, c[2] * 0.4, l * 0.7);
      }
    });
    this.fragments(fb,t);
  }
}
