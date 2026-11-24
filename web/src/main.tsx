import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { loadItemAtlas } from "./game/item-atlas";

// The approved item art is decoded before the first frame, so no screen ever shows a placeholder for a mapped item.
void loadItemAtlas().finally(() => createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
));
