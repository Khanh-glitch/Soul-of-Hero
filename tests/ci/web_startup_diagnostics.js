// Present useful evidence instead of a silent black screen on Web startup failure.
// Inserted into exported index.html before the Godot bootloader by GitHub Actions.
(() => {
  const errors = [];
  const started = Date.now();
  function report(...items) {
    const line = items.map(x => x instanceof Error ? (x.stack || x.message) : String(x)).join(" ");
    if (/error|fail|missing|preload|parse|wasm|webgl/i.test(line)) {
      errors.push(line.slice(0, 550));
      if (errors.length > 16) errors.shift();
    }
  }
  const previousError = console.error.bind(console);
  console.error = (...items) => { report(...items); previousError(...items); };
  window.addEventListener("error", event => report(event.message || "Uncaught browser error"));
  window.addEventListener("unhandledrejection", event =>
    report("Unhandled browser promise: " + String(event.reason)));
  function display() {
    let overlay = document.getElementById("soul-web-diagnostics");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "soul-web-diagnostics";
      Object.assign(overlay.style, {
        position: "fixed", zIndex: "2147483647", left: "12px", right: "12px",
        top: "12px", padding: "16px", color: "#eee", background: "#21151cf2",
        border: "1px solid #a85a5a", borderRadius: "8px", font: "14px monospace",
        whiteSpace: "pre-wrap", pointerEvents: "auto", maxHeight: "85vh",
        overflow: "auto",
      });
      document.body.appendChild(overlay);
    }
    const route = window.__soulHeroRoute || "(chưa vào màn game)";
    overlay.textContent = "SOUL OF HERO — WEB STARTUP DIAGNOSTIC\n"
      + "Godot AppRoot: " + (window.__soulHeroAppReady ? "READY" : "NOT READY")
      + "\nRoute: " + route
      + "\n\n" + (errors.slice(-7).join("\n") || "Chưa nhận được lỗi. Mở F12 → Console để xem chi tiết.")
      + "\n\nVui lòng chụp phần này và gửi cho nhóm phát triển.";
  }
  window.setInterval(() => {
    if (window.__soulHeroRoute && window.__soulHeroRoute !== "boot") {
      document.getElementById("soul-web-diagnostics")?.remove();
      return;
    }
    if (Date.now() - started > 18000 && document.body) display();
  }, 1500);
})();
