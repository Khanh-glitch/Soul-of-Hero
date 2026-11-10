import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// QA-only compare-page bridge (postMessage works cross-origin over file://):
// {cmd:'avfx20-boot'} auto-enters a run and plays #20 restored; {cmd:'avfx20-seek',t};
// {cmd:'avfx20-mode',m}. Registered at app root so it works from the title screen.
// Never touches gameplay/save — drives the same QA-only __d20qa hooks as FX Lab.
if (!(window as any).__avfx20bridge) {
  (window as any).__avfx20bridge = true;
  window.addEventListener('message', (e) => {
    const d = (e && e.data) || {};
    const q = (window as any).__d20qa;
    if (d.cmd === 'avfx20-boot') {
      const click = (label: string) => { const el = [...document.querySelectorAll('button')].find(b => (b.textContent || '').includes(label)); if (el && !(el as HTMLButtonElement).disabled) { (el as HTMLButtonElement).click(); return true; } return false; };
      const boot = () => { if ((window as any).__soh?.run) { if (q) { q.client.mode = 'restored'; q.play(); } return; } click('New run'); setTimeout(() => { click('Meadow Bay'); setTimeout(() => { click('Begin the 14 days'); setTimeout(boot, 1000); }, 400); }, 500); };
      boot();
    }
    if (!q) return;
    if (d.cmd === 'avfx20-seek' && typeof d.t === 'number') q.seek(d.t);
    if (d.cmd === 'avfx20-mode' && (d.m === 'current' || d.m === 'restored')) q.client.mode = d.m;
  });
}
