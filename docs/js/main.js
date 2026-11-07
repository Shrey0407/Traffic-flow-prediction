// docs/js/main.js: boot. Reads precomputed JSON from docs/data/ (written by src/05_export_site.py and src/06_export_playground.py).
// No model code runs in the browser; it only filters and averages the exported forecasts.
(function () {
  "use strict";
  const TF = window.TF;
  document.addEventListener("DOMContentLoaded", async () => {
    TF.initStatic();                       // parts that need no data (steps, quiz, nav, theme)
    try {
      await TF.load();
    } catch (e) {
      const b = document.getElementById("load-error");
      b.hidden = false;
      b.textContent = "Could not load the data files (" + e.message + "). Serve the docs/ folder over http (python -m http.server 8000 --directory docs); opening index.html directly will not load data.";
      console.error(e); return;
    }
    TF.initStory();
    TF.initHero();
    TF.initLab();
    TF.initDiscoveries();
    if (location.hash) { const t = document.querySelector(location.hash); if (t) t.scrollIntoView(); }
  });
})();
