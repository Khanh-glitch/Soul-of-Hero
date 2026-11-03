// Review-tool movement only: NOT a canonical SOH speed or gameplay law.
// Circle vs tile/AABB resolution, axis sliding, corner assist, sub-step anti-tunneling.
export function makeCollision(world,{structures=[],props=[]}={}){
  const W=world.grid.w,H=world.grid.h;
  const grid=new Uint8Array(W*H);
  grid.set(world.collision);
  for(const s of structures){
    for(const [tx,ty] of s.solidTiles||[])if(tx>=0&&ty>=0&&tx<W&&ty<H)grid[ty*W+tx]=1;
    for(const [tx,ty] of s.openTiles||[])if(tx>=0&&ty>=0&&tx<W&&ty<H)grid[ty*W+tx]=0;
  }
  const rects=[];
  for(const p of props){
    if(!p.solid||!p.collider)continue;
    rects.push({x:p.x+p.collider.x,y:p.y+p.collider.y,w:p.collider.w,h:p.collider.h,id:p.id});
  }
  return {W,H,grid,rects};
}
export function blocked(c,x,y,r=4){
  const W=c.W,H=c.H;
  const x0=Math.floor((x-r)/16),x1=Math.floor((x+r)/16),y0=Math.floor((y-r)/16),y1=Math.floor((y+r)/16);
  for(let ty=y0;ty<=y1;ty++)for(let tx=x0;tx<=x1;tx++){
    if(tx<0||ty<0||tx>=W||ty>=H)return true;
    if(c.grid[ty*W+tx]){
      const cx=Math.max(tx*16,Math.min(x,(tx+1)*16)),cy=Math.max(ty*16,Math.min(y,(ty+1)*16));
      if((x-cx)**2+(y-cy)**2<r*r)return true;
    }
  }
  for(const q of c.rects){
    const cx=Math.max(q.x,Math.min(x,q.x+q.w)),cy=Math.max(q.y,Math.min(y,q.y+q.h));
    if((x-cx)**2+(y-cy)**2<r*r)return true;
  }
  return false;
}
export function move(c,pos,dx,dy,r=4){
  const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
  let x=pos.x,y=pos.y;
  for(let i=0;i<steps;i++){
    const sx=dx/steps,sy=dy/steps;
    let moved=false;
    if(!blocked(c,x+sx,y,r)){x+=sx;moved=true;}
    if(!blocked(c,x,y+sy,r)){y+=sy;moved=true;}
    if(!moved){ // corner assist: try a tiny perpendicular nudge, then the intended axis
      for(const [ox,oy] of [[0,-2],[0,2],[-2,0],[2,0]]){
        if(!blocked(c,x+ox,y+oy,r)){
          const nx=x+ox,ny=y+oy;
          if(!blocked(c,nx+sx,ny,r)||!blocked(c,nx,ny+sy,r)){x=nx;y=ny;if(!blocked(c,x+sx,y,r))x+=sx;if(!blocked(c,x,y+sy,r))y+=sy;moved=true;break;}
        }
      }
    }
  }
  return {x,y};
}
export function bfs(c,start,goal){
  const W=c.W,H=c.H,s=Math.floor(start.y/16)*W+Math.floor(start.x/16),g=Math.floor(goal.y/16)*W+Math.floor(goal.x/16);
  if(c.grid[s]||c.grid[g])return null;
  const prev=new Int32Array(W*H).fill(-1),seen=new Uint8Array(W*H),q=[s];seen[s]=1;let head=0;
  while(head<q.length){const i=q[head++];if(i===g){const out=[];let k=i;while(k>=0){out.push({x:(k%W)*16+8,y:((k/W)|0)*16+8});k=prev[k];}return out.reverse();}const x=i%W,y=(i/W)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(seen[j]||c.grid[j])continue;seen[j]=1;prev[j]=i;q.push(j);}}
  return null;
}
