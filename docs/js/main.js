// docs/js/main.js
// Loads precomputed JSON from docs/data/ and renders the interactions.
// No model code here: everything shown was computed in Python (src/05_export_site.py).

const DATA = {
  metrics: "data/metrics.json",
  models: "data/models.json",
  grid: "data/error_grid.json",
  summary: "data/data_summary.json",
  predictions: (model) => `data/predictions_${model}.json`,
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
let forecastChart = null;
let predictionRows = [];
let gridCells = [];

// ---------- helpers ----------
async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

function fmt(x, digits = 2) {
  return x === null || x === undefined || Number.isNaN(x) ? "–" : Number(x).toFixed(digits);
}

// ---------- data summary ----------
async function renderSummary() {
  const s = await getJSON(DATA.summary);
  document.getElementById("data-summary").innerHTML = `
    <dl>
      <dt>Dataset</dt><dd>${s.dataset}</dd>
      <dt>Segments used</dt><dd>${s.sensors} (${s.segments.join(", ")})</dd>
      <dt>Period</dt><dd>${s.start} to ${s.end}</dd>
      <dt>Hourly rows</dt><dd>${s.rows.toLocaleString()} (missing speed: ${(s.missing_rate * 100).toFixed(2)}%)</dd>
      <dt>Training / validation / test rows</dt><dd>${s.n_train.toLocaleString()} / ${s.n_val.toLocaleString()} / ${s.n_test.toLocaleString()}</dd>
      <dt>Split dates</dt><dd>validation starts ${s.train_end}; test starts ${s.val_end} (${s.test_start} to ${s.test_end})</dd>
    </dl>`;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("st-seg", s.sensors);
  set("st-rows", s.rows.toLocaleString());
}

// ---------- results table ----------
async function renderMetrics() {
  const rows = await getJSON(DATA.metrics);
  const tbody = document.querySelector("#metrics-table tbody");
  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    if (r.selected) tr.className = "selected";
    const ci = r.ci_low === null || r.ci_low === undefined ? "–" : `${fmt(r.ci_low)} – ${fmt(r.ci_high)}`;
    tr.innerHTML = `
      <td>${r.model}${r.selected ? " (selected)" : ""}</td>
      <td>${fmt(r.val_mae)}</td>
      <td>${fmt(r.test_mae)}</td>
      <td>${fmt(r.test_rmse)}</td>
      <td>${fmt(r.skill, 3)}</td>
      <td>${ci}</td>`;
    tbody.appendChild(tr);
  }
  const best = rows.find((r) => r.selected);
  if (best) {
    document.getElementById("headline").textContent =
      `${best.model} reaches ${fmt(best.test_mae)} km/h test MAE, skill ${fmt(best.skill, 3)} versus persistence.`;
    document.getElementById("headline-box").hidden = false;
    const base = rows.find((r) => r.model === "hour_of_week");
    if (base) document.getElementById("st-base").textContent = fmt(base.test_mae);
  }
}

// ---------- Interaction 1: forecast explorer ----------
async function loadPredictions(model) {
  predictionRows = await getJSON(DATA.predictions(model));

  const segments = [...new Set(predictionRows.map((r) => r.segment))].sort();
  const segSel = document.getElementById("segment-select");
  segSel.innerHTML = segments.map((s) => `<option>${s}</option>`).join("");

  populateDates();
  drawForecast();
}

function populateDates() {
  const seg = document.getElementById("segment-select").value;
  const dates = [...new Set(
    predictionRows.filter((r) => r.segment === seg).map((r) => r.t.slice(0, 10))
  )].sort();
  document.getElementById("date-select").innerHTML =
    dates.map((d) => `<option>${d}</option>`).join("");
}

function drawForecast() {
  const seg = document.getElementById("segment-select").value;
  const day = document.getElementById("date-select").value;
  const rows = predictionRows
    .filter((r) => r.segment === seg && r.t.startsWith(day))
    .sort((a, b) => a.t.localeCompare(b.t));

  const labels = rows.map((r) => r.t.slice(11, 16));
  const css = getComputedStyle(document.documentElement);
  const col = (n) => css.getPropertyValue(n).trim();
  const muted = col("--muted"), line = col("--line");
  const base = { tension: 0.3, pointRadius: 0, pointHoverRadius: 5 };
  const data = {
    labels,
    datasets: [
      { ...base, label: "Actual (km/h)", data: rows.map((r) => r.actual), borderColor: col("--c-actual"), backgroundColor: col("--c-actual"), borderWidth: 3 },
      { ...base, label: "Predicted (km/h)", data: rows.map((r) => r.pred), borderColor: col("--c-pred"), backgroundColor: col("--c-pred"), borderWidth: 3, borderDash: [7, 4] },
      { ...base, label: "Persistence (km/h)", data: rows.map((r) => r.persist), borderColor: col("--c-persist"), backgroundColor: col("--c-persist"), borderWidth: 1.5 },
    ],
  };

  const ctx = document.getElementById("forecast-chart");
  if (forecastChart) forecastChart.destroy();
  forecastChart = new Chart(ctx, {
    type: "line",
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: muted, usePointStyle: true, boxWidth: 8 } } },
      scales: {
        y: { title: { display: true, text: "Speed (km/h)", color: muted }, ticks: { color: muted }, grid: { color: line } },
        x: { title: { display: true, text: "Hour the forecast was made (t); values are for t + 2 h", color: muted }, ticks: { color: muted }, grid: { display: false } },
      },
    },
  });

  // Slice statistics
  if (rows.length) {
    const mae = rows.reduce((s, r) => s + Math.abs(r.actual - r.pred), 0) / rows.length;
    const maeP = rows.reduce((s, r) => s + Math.abs(r.actual - r.persist), 0) / rows.length;
    document.getElementById("slice-stats").textContent =
      `Selected slice: model MAE ${fmt(mae)} km/h, persistence MAE ${fmt(maeP)} km/h, ` +
      `skill ${fmt(1 - mae / maeP, 3)} (${rows.length} hours).`;
  } else {
    document.getElementById("slice-stats").textContent = "No data for this selection.";
  }
}

// ---------- Interaction 2: error heatmap ----------
function renderGrid() {
  const metric = document.getElementById("grid-metric").value;
  const seg = document.getElementById("grid-segment").value;
  const cond = document.getElementById("grid-condition").value;
  const cells = gridCells.filter((c) => c.segment === seg && c.condition === cond);

  const values = cells.map((c) => c[metric]).filter((v) => v !== null && !Number.isNaN(v));
  const lo = Math.min(...values), hi = Math.max(...values);
  const colour = (v) => {
    // green (low error / high skill) to red (high error / low skill)
    const t = (v - lo) / (hi - lo || 1);
    const hue = metric === "mae" ? 120 - 120 * t : 120 * t;
    return `hsl(${hue}, 70%, 75%)`;
  };
  // Per-segment cells hold only a few hours each, so the "enough data" threshold is lower there.
  const minN = seg === "all" ? 20 : 3;
  const dec = metric === "mae" ? 1 : 2;
  document.getElementById("lg-lo").textContent = fmt(metric === "mae" ? lo : hi, dec) + (metric === "mae" ? " km/h (low error)" : " (better than persistence)");
  document.getElementById("lg-hi").textContent = fmt(metric === "mae" ? hi : lo, dec) + (metric === "mae" ? " km/h (high error)" : " (worse)");

  let html = "<table><thead><tr><th>Day</th>";
  for (let h = 0; h < 24; h++) html += `<th>${h}</th>`;
  html += "</tr></thead><tbody>";
  for (let d = 0; d < 7; d++) {
    html += `<tr><th>${DAYS[d]}</th>`;
    for (let h = 0; h < 24; h++) {
      const c = cells.find((x) => x.dow === d && x.hour === h);
      if (!c) { html += "<td class=\"low-sample\"></td>"; continue; }
      const low = c.n < minN || c[metric] === null;
      html += `<td class="${low ? "low-sample" : ""}"
                   style="${low ? "" : `background:${colour(c[metric])}`}"
                   title="MAE ${fmt(c.mae)} km/h, skill ${fmt(c.skill, 3)}, n=${c.n}${low ? " (low sample)" : ""}">
                 ${fmt(c[metric], metric === "mae" ? 1 : 2)}</td>`;
    }
    html += "</tr>";
  }
  html += "</tbody></table>";
  document.getElementById("error-grid").innerHTML = html;
}

// ---------- wiring ----------
document.addEventListener("DOMContentLoaded", async () => {
  try {
    await renderSummary();
    await renderMetrics();

    const models = await getJSON(DATA.models);
    const modelSel = document.getElementById("model-select");
    modelSel.innerHTML = models
      .map((m) => `<option value="${m.model}"${m.selected ? " selected" : ""}>${m.model}</option>`)
      .join("");
    await loadPredictions(modelSel.value);

    document.getElementById("segment-select").addEventListener("change", () => {
      populateDates(); drawForecast();
    });
    document.getElementById("date-select").addEventListener("change", drawForecast);
    modelSel.addEventListener("change", () => loadPredictions(modelSel.value));

    gridCells = await getJSON(DATA.grid);
    const segs = [...new Set(gridCells.map((c) => c.segment))].sort((a, b) =>
      a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b));
    document.getElementById("grid-segment").innerHTML = segs.map((s) => `<option>${s}</option>`).join("");
    renderGrid();
    for (const id of ["grid-metric", "grid-segment", "grid-condition"]) {
      document.getElementById(id).addEventListener("change", renderGrid);
    }
  } catch (err) {
    console.error(err);
    const box = document.getElementById("load-error");
    box.hidden = false;
    box.innerHTML = `<strong>Results are not available yet.</strong> ${err.message}.
       Run <code>python src/05_export_site.py</code>, then view the site through a server with
       <code>python -m http.server 8000</code> from the <code>docs</code> folder
       (opening index.html directly will not work).`;
  }
});

// ---------- navigation: mobile menu and active-section highlight ----------
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("menu-btn");
  const links = document.getElementById("nav-links");
  btn.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(open));
  });
  links.addEventListener("click", () => { links.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); });

  const anchors = [...links.querySelectorAll("a")];
  const byId = new Map(anchors.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      anchors.forEach((a) => a.classList.remove("active"));
      const a = byId.get(e.target.id);
      if (a) { a.classList.add("active"); a.scrollIntoView({ block: "nearest", inline: "center" }); }
    }
  }, { rootMargin: "-30% 0px -65% 0px" });
  document.querySelectorAll("main section").forEach((sec) => io.observe(sec));
});
