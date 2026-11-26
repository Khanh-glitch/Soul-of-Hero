import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { loadItemAtlas } from "./game/item-atlas";
import { startDomI18n, setI18nAudit } from "./ui/i18n-dom";
import { ScreenFit } from "./ui/ScreenFit";
import { Veil } from "./ui/veil";

if (import.meta.env.VITE_SOH_QA === '1') setI18nAudit(true);
startDomI18n();
// Internal QA build only: lets the browser harness list on-screen text the Vietnamese phrase book does not cover.
if (import.meta.env.VITE_SOH_QA === '1') {
  void Promise.all([import('./ui/i18n-dom'), import('./game/i18n'), import('./game/catalog')]).then(([dom, i18n, cat]) => {
    const names = new Set<string>();
    for (const table of [cat.ITEMS, (cat as any).STRUCTS, (cat as any).CREATURES, (cat as any).RECIPES]) for (const v of Object.values(table ?? {})) { const n = (v as any)?.name; if (typeof n === 'string') names.add(n); }
    (window as any).__sohI18n = { setLang: i18n.setLang, getLang: i18n.getLang, audit: dom.setI18nAudit, missing: () => [...dom.untranslated.entries()].filter(([k]) => !names.has(k)), names: () => [...names] };
  });
}

// The approved item art is decoded before the first frame, so no screen ever shows a placeholder for a mapped item.
void loadItemAtlas().finally(() => createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Veil />
    <ScreenFit />
  </StrictMode>
));
