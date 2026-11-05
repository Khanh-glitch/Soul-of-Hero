/** U05 isolated audition entry. Canvas is ALWAYS native 640x360 at 1x. */
import { U05Game } from './game';
import { U05_SCENE_IDS, U05_SCENES } from './scenes.generated';

const canvas = document.getElementById('u05') as HTMLCanvasElement;
const game = new U05Game(canvas);
(window as any).__u05 = game.api();
(window as any).__u05Game = game;

const params = new URLSearchParams(location.search);
const initialScene = params.get('scene');
if (initialScene && U05_SCENE_IDS.includes(initialScene)) game.setScene(initialScene);
if (params.has('physical')) game.setPhysical(params.get('physical') === '1');

const root = document.getElementById('ui')!;
const selector = document.createElement('div');
selector.className = 'row';
for (const id of U05_SCENE_IDS) {
  const s = U05_SCENES.find((x: any) => x.id === id);
  const b = document.createElement('button');
  b.textContent = `${id.replace('po_', '')}`;
  b.title = s?.name || id;
  b.dataset.scene = id;
  b.onclick = () => { game.setScene(id); game.setPhysical(true); sync(); };
  selector.appendChild(b);
}
const toggle = document.createElement('button');
toggle.id = 'toggle';
toggle.textContent = 'Physical: ON';
toggle.onclick = () => { game.setPhysical(!game.state().physical); sync(); };
selector.appendChild(toggle);
root.appendChild(selector);
const status = document.createElement('pre');
status.id = 'status';
root.appendChild(status);
const note = document.createElement('div');
note.className = 'note';
note.textContent = 'CREATOR_CHOSEN_U05 v1 — scale intent only. NOT_YET_VALIDATED full Gameplay integration. No visual acceptance. WASD / arrows to walk.';
root.appendChild(note);

function sync() {
  const st = game.state();
  for (const b of Array.from(selector.querySelectorAll('button[data-scene]'))) (b as HTMLButtonElement).classList.toggle('on', (b as HTMLButtonElement).dataset.scene === st.sceneId);
  toggle.textContent = `Physical: ${st.physical ? 'ON' : 'OFF'}`;
}
setInterval(() => {
  const st = game.state();
  status.textContent =
    `scene=${st.sceneId} physical=${st.physical ? 'ON' : 'OFF'} viewport=${st.viewport.join('x')} zoom=${st.zoom}\n` +
    `U=${st.U} TILE=${st.TILE} frame=${st.frameTiles.join('x')} hero=${st.heroSpritePx.join('x')} speed=${st.speedPxPerSec}\n` +
    `player tile=${st.player.tile.join(',')} px=${st.player.px.toFixed(1)},${st.player.py.toFixed(1)} au=${st.player.au.map((v: number) => v.toFixed(2)).join(',')}\n` +
    `walkable=${st.walkableHere} wallBlocked=${st.wallBlockedHere} roofsHidden=${st.draw.roofHiddenCount || 0} wallsDrawn=${st.draw.wallsDrawn || 0} doorsDrawn=${st.draw.doorsDrawn || 0}\n` +
    `displayCanvases=${st.stats.displayCanvases} residentChunks=${st.stats.residentChunks} materializedAllCells=${st.stats.materializedAllCells}\n` +
    `clock simMs=${st.stats.simMs} dayMs=${st.dayLengthMs}`;
  sync();
}, 400);
sync();
