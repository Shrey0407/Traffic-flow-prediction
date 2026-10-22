// docs/js/main.js
// Reads precomputed JSON from docs/data/ (written by src/05_export_site.py). No model code runs in the browser.
// Every number shown on the page comes from those files.

const DATA = {
  metrics: "data/metrics.json",
  models: "data/models.json",
  grid: "data/error_grid.json",
  summary: "data/data_summary.json",
  paired: "data/test_paired.json",
  cases: "data/error_cases.json",
  predictions: (model) => `data/predictions_${model}.json`,
};
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MODEL_ORDER = ["linear", "ridge", "lasso", "decision_tree", "random_forest", "xgboost", "voting_ensemble", "persistence", "hour_of_week"];
const BASELINES = ["persistence", "hour_of_week"];
const MIN_N_ALL = 30;      // a weekday-hour cell over all segments needs at least this many hours
const MIN_N_SEGMENT = 4;   // a single segment has only ~5 hours per cell in the test block, so the bar is lower

const $ = (id) => document.getElementById(id);
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? "–" : Number(x).toFixed(d);

const store = { m: {}, p: {}, s: {}, c: {} };
let forecastChart = null, barChart = null, predictionRows = [], gridCells = [];

async function getJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  return res.json();
}

// ---------- fill <span data-bind="m.model.field|decimals|comma"> from the loaded JSON ----------
function bindAll() {
  document.querySelectorAll("[data-bind]").forEach((el) => {
    const [path, dec, flag] = el.dataset.bind.split("|");
    const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), store);
    if (v === null || v === undefined || Number.isNaN(v)) return;
    if (typeof v === "string") { el.textContent = v; return; }
    el.textContent = flag === "comma" ? Number(v).toLocaleString("en-US") : fmt(v, Number(dec ?? 2));
  });
}

// ---------- data summary, split table, segment list ----------
function renderSummary(s) {
  s.missing_pct = s.missing_rate * 100;
  store.s = s;
  $("seg-list").textContent = s.segments.join(", ");
  $("data-summary").innerHTML = `<dl class="facts">
    <dt>Dataset</dt><dd>${s.dataset}</dd>
    <dt>Segments</dt><dd>${s.sensors} (${s.segments.join(", ")})</dd>
    <dt>Period</dt><dd>${s.start} to ${s.end}</dd>
    <dt>Hourly rows</dt><dd>${s.rows.toLocaleString("en-US")}; missing speed ${(s.missing_rate * 100).toFixed(3)}%</dd>
    <dt>Model rows</dt><dd>${s.n_train.toLocaleString("en-US")} train / ${s.n_val.toLocaleString("en-US")} validation / ${s.n_test.toLocaleString("en-US")} test</dd></dl>`;
  const names = { train: "Train", val: "Validation", test: "Test" };
  $("split-table").querySelector("tbody").innerHTML = ["train", "val", "test"].map((k) => {
    const b = s.splits[k];
    return `<tr><td>${names[k]}</td><td>${b.start.slice(0, 16)}</td><td>${b.end.slice(0, 16)}</td><td>${b.rows.toLocaleString("en-US")}</td></tr>`;
  }).join("");
}

// ---------- metrics: validation table, results table, bar chart, headline, conclusion ----------
function renderMetrics(rows, paired) {
  rows = [...rows].sort((a, b) => MODEL_ORDER.indexOf(a.model) - MODEL_ORDER.indexOf(b.model));
  rows.forEach((r) => { store.m[r.model] = r; });
  paired.forEach((r) => { store.p[r.reference] = r; });

  $("val-table").querySelector("tbody").innerHTML = [...rows].sort((a, b) => a.val_mae - b.val_mae).map((r) =>
    `<tr class="${r.selected ? "selected" : ""}"><td>${r.model}${r.selected ? " (selected)" : ""}</td><td>${fmt(r.val_mae, 3)}</td><td class="na">${BASELINES.includes(r.model) ? "baseline" : "trained"}</td></tr>`).join("");

  $("metrics-table").querySelector("tbody").innerHTML = rows.map((r) => {
    const scored = r.test_mae !== null && r.test_mae !== undefined;
    const na = '<td class="na">n/a</td>';
    const ci = r.ci_low == null ? '<td class="na">&ndash;</td>' : `<td>${fmt(r.ci_low, 3)} &ndash; ${fmt(r.ci_high, 3)}</td>`;
    return `<tr class="${r.selected ? "selected" : ""} ${BASELINES.includes(r.model) ? "base" : ""}">
      <td>${r.model}${r.selected ? " (selected)" : ""}</td><td>${fmt(r.val_mae, 3)}</td>
      ${scored ? `<td>${fmt(r.test_mae, 3)}</td><td>${fmt(r.test_rmse, 3)}</td><td>${fmt(r.skill, 3)}</td>` : na + na + na}${ci}</tr>`;
  }).join("");

  const sel = rows.find((r) => r.selected), how = store.m.hour_of_week, per = store.m.persistence, pd = store.p.hour_of_week;
  if (sel && how && per) {
    const diff = sel.test_mae - how.test_mae;
    const valDiff = sel.val_mae - how.val_mae;
    const spans = pd ? ` (paired difference ${pd.mean_diff >= 0 ? "+" : ""}${fmt(pd.mean_diff, 3)} km/h, 95% interval ${fmt(pd.ci_low, 3)} to ${fmt(pd.ci_high, 3)}${pd.ci_low <= 0 && pd.ci_high >= 0 ? ", which includes zero" : ""})` : "";
    const s = store.s;
    const period = s.splits ? `${s.splits.test.start.slice(0, 10)} to ${s.splits.test.end.slice(0, 10)}` : "the test block";
    $("headline").textContent =
      `On the test block (${period}) the ${sel.model} reached a mean absolute error of ${fmt(sel.test_mae, 3)} km/h for speed two hours ahead, ` +
      `against ${fmt(per.test_mae, 3)} for persistence (skill ${fmt(sel.skill, 3)}) and ${fmt(how.test_mae, 3)} for the hour-of-week mean.`;
    $("headline-honest").textContent =
      `Hour-of-week is a strong baseline and the trained model does not clearly beat it: it is ${fmt(Math.abs(diff), 3)} km/h ${diff > 0 ? "worse" : "better"} on test` +
      ` and ${fmt(Math.abs(valDiff), 3)} km/h ${valDiff > 0 ? "worse" : "better"} on validation${pd ? "; the test interval for the difference " + (pd.ci_low <= 0 && pd.ci_high >= 0 ? "includes zero" : "excludes zero") : ""}.`;
    $("results-read").textContent =
      `Reading the table: the ${sel.model} is far better than persistence on test (skill ${fmt(sel.skill, 3)}) but ${diff > 0 ? "not better" : "better"} than hour-of-week (${fmt(sel.test_mae, 3)} against ${fmt(how.test_mae, 3)} km/h${spans.replace(/^ \(/, "; ").replace(/\)$/, "")}).`;
    $("conclusion-dyn").textContent =
      `Answer: ${diff > 0 ? "no" : "yes, by a small margin"}. The selected ${sel.model} reached a test MAE of ${fmt(sel.test_mae, 3)} km/h` +
      (sel.ci_low == null ? "" : ` (95% interval ${fmt(sel.ci_low, 3)} to ${fmt(sel.ci_high, 3)})`) +
      `, against ${fmt(how.test_mae, 3)} km/h for the hour-of-week mean and ${fmt(per.test_mae, 3)} for persistence. ` +
      (diff > 0 ? `It beats persistence by a wide margin (skill ${fmt(sel.skill, 3)}) but is ${fmt(diff, 3)} km/h worse than hour-of-week on test, and ${fmt(valDiff, 3)} km/h worse on validation. ` : `It improves on hour-of-week by ${fmt(-diff, 3)} km/h. `) +
      `This describes these eight segments and this period only.`;
  }
  drawBar(rows);
}

function drawBar(rows) {
  if (!window.Chart) return;
  const ink = css("--ink"), muted = css("--muted"), rule = css("--rule"), accent = css("--accent"), mono = css("--mono");
  const sorted = [...rows].sort((a, b) => a.val_mae - b.val_mae);
  if (barChart) barChart.destroy();
  barChart = new Chart($("bar-chart"), {
    type: "bar",
    data: {
      labels: sorted.map((r) => r.model),
      datasets: [
        { label: "Validation MAE", data: sorted.map((r) => r.val_mae), backgroundColor: css("--sand") },
        { label: "Test MAE (scored models only)", data: sorted.map((r) => r.test_mae), backgroundColor: accent },
      ],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { labels: { color: ink, font: { family: mono, size: 11 } } },
                 tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.x, 3)} km/h` } } },
      scales: { x: { title: { display: true, text: "MAE (km/h), lower is better", color: muted, font: { family: mono, size: 11 } }, ticks: { color: muted, font: { family: mono } }, grid: { color: rule } },
                y: { ticks: { color: ink, font: { family: mono, size: 11 } }, grid: { display: false } } },
    },
  });
}

// ---------- failure-case statistics ----------
function renderCases(cases) {
  cases.forEach((c) => {
    const el = $(`case-${c.case}-stat`);
    if (!el) return;
    el.textContent = `Segment ${c.segment}, ${c.day}. Day MAE: model ${fmt(c.day_mae_model)}, hour-of-week ${fmt(c.day_mae_how)}, persistence ${fmt(c.day_mae_persistence)} km/h. ` +
      `Largest miss: forecast made at ${c.worst_origin.slice(11, 16)}, predicted ${fmt(c.worst_pred, 1)}, actual ${fmt(c.worst_actual, 1)} km/h.`;
  });
}

// ---------- Interaction 1: forecast explorer ----------
async function loadPredictions(model) {
  predictionRows = await getJSON(DATA.predictions(model));
  const segs = [...new Set(predictionRows.map((r) => r.segment))].sort();
  $("segment-select").innerHTML = segs.map((s) => `<option>${s}</option>`).join("");
  populateDates();
  drawForecast();
}
function populateDates() {
  const seg = $("segment-select").value;
  const dates = [...new Set(predictionRows.filter((r) => r.segment === seg).map((r) => r.t.slice(0, 10)))].sort();
  $("date-select").innerHTML = dates.map((d) => `<option>${d}</option>`).join("");
}
function drawForecast() {
  if (!window.Chart) return;
  const seg = $("segment-select").value, day = $("date-select").value, model = $("model-select").value;
  const rows = predictionRows.filter((r) => r.segment === seg && r.t.startsWith(day)).sort((a, b) => a.t.localeCompare(b.t));
  const ink = css("--ink"), accent = css("--accent"), muted = css("--muted"), rule = css("--rule"), mono = css("--mono");
  const base = { tension: 0.2, pointRadius: 0, pointHoverRadius: 4 };
  const labels = rows.map((r) => r.t.slice(11, 16));
  if (forecastChart) forecastChart.destroy();
  forecastChart = new Chart($("forecast-chart"), {
    type: "line",
    data: { labels, datasets: [
      { ...base, label: "Actual", data: rows.map((r) => r.actual), borderColor: ink, backgroundColor: ink, borderWidth: 2.4 },
      { ...base, label: `Forecast (${model})`, data: rows.map((r) => r.pred), borderColor: accent, backgroundColor: accent, borderWidth: 2, borderDash: [6, 4] },
      { ...base, label: "Persistence", data: rows.map((r) => r.persist), borderColor: css("--sand"), backgroundColor: css("--sand"), borderWidth: 1.8 },
    ] },
    options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: { legend: { labels: { color: ink, font: { family: mono, size: 11 }, boxWidth: 22, boxHeight: 2 } },
                 tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmt(c.parsed.y, 1)} km/h`, title: (items) => `Forecast made at ${items[0].label}, for two hours later` } } },
      scales: {
        y: { title: { display: true, text: "Speed two hours after the forecast (km/h)", color: muted, font: { family: mono, size: 11 } }, ticks: { color: muted, font: { family: mono } }, grid: { color: rule } },
        x: { title: { display: true, text: "Hour the forecast was made (t); values are for t + 2 h", color: muted, font: { family: mono, size: 11 } }, ticks: { color: muted, font: { family: mono } }, grid: { display: false } },
      },
    },
  });
  if (rows.length) {
    const mae = rows.reduce((s, r) => s + Math.abs(r.actual - r.pred), 0) / rows.length;
    const maeP = rows.reduce((s, r) => s + Math.abs(r.actual - r.persist), 0) / rows.length;
    $("slice-stats").textContent = `Selected slice (${rows.length} hours): ${model} MAE ${fmt(mae)} km/h, persistence MAE ${fmt(maeP)} km/h, skill ${fmt(1 - mae / maeP, 3)}.`;
  } else $("slice-stats").textContent = "No data for this selection.";
}

// ---------- Interaction 2: error heatmap (monochrome: darker = worse) ----------
function renderGrid() {
  const metric = $("grid-metric").value, seg = $("grid-segment").value, cond = $("grid-condition").value;
  const cells = gridCells.filter((c) => c.segment === seg && c.condition === cond);
  const minN = seg === "all" ? MIN_N_ALL : MIN_N_SEGMENT;
  const ok = (c) => c.n >= minN && c[metric] !== null && !Number.isNaN(c[metric]);
  const vals = cells.filter(ok).map((c) => c[metric]);
  const lo = vals.length ? Math.min(...vals) : 0, hi = vals.length ? Math.max(...vals) : 1;
  const t = (v) => { const x = (v - lo) / (hi - lo || 1); return metric === "skill" ? 1 - x : x; };
  // warm scale: cream (good) to rust (bad)
  const A = [246, 239, 230], B = [168, 67, 28];
  const shade = (v) => { const k = t(v); return `rgb(${A.map((a, i) => Math.round(a + (B[i] - a) * k)).join(",")})`; };
  const dec = metric === "mae" ? 1 : 2;
  $("lg-lo").textContent = metric === "mae" ? `${fmt(lo, dec)} km/h (low error)` : `${fmt(hi, dec)} (better than persistence)`;
  $("lg-hi").textContent = metric === "mae" ? `${fmt(hi, dec)} km/h (high error)` : `${fmt(lo, dec)} (worse)`;
  $("grid-note").textContent = seg === "all"
    ? `Cells with fewer than ${MIN_N_ALL} hours are pale.`
    : `One segment has only about 5 hours per cell in the test block, so cells with fewer than ${MIN_N_SEGMENT} hours are pale and the rest are indicative only. Use "all" for stable patterns.`;
  let h = "<table><thead><tr><th></th>";
  for (let i = 0; i < 24; i++) h += `<th>${i}</th>`;
  h += "</tr></thead><tbody>";
  for (let d = 0; d < 7; d++) {
    h += `<tr><th>${DAYS[d]}</th>`;
    for (let i = 0; i < 24; i++) {
      const c = cells.find((x) => x.dow === d && x.hour === i);
      if (!c) { h += '<td class="low-sample"></td>'; continue; }
      const good = ok(c);
      h += `<td class="${good ? "" : "low-sample"}" style="${good ? `background:${shade(c[metric])};color:${t(c[metric]) < 0.55 ? "#1b2330" : "#fff"}` : ""}"
        title="${DAYS[d]} ${i}:00 | MAE ${fmt(c.mae)} km/h | skill ${fmt(c.skill, 3)} | n=${c.n}${good ? "" : " (too few hours)"}">${fmt(c[metric], dec)}</td>`;
    }
    h += "</tr>";
  }
  $("error-grid").innerHTML = h + "</tbody></table>";
}

// ---------- start-up ----------
document.addEventListener("DOMContentLoaded", async () => {
  const problems = [];
  const attempt = async (fn) => { try { await fn(); } catch (e) { console.error(e); problems.push(e.message); } };
  const waitChart = async () => { for (let i = 0; i < 50 && !window.Chart; i++) await new Promise((r) => setTimeout(r, 100)); };

  await attempt(async () => renderSummary(await getJSON(DATA.summary)));
  let metrics = [], paired = [], cases = [];
  await attempt(async () => { paired = await getJSON(DATA.paired); });
  await attempt(async () => { cases = await getJSON(DATA.cases); renderCases(cases); });
  await attempt(async () => { metrics = await getJSON(DATA.metrics); });
  await waitChart();
  if (metrics.length) renderMetrics(metrics, paired);
  bindAll();

  await attempt(async () => {
    const models = await getJSON(DATA.models);
    const sel = $("model-select");
    sel.innerHTML = models.map((m) => `<option value="${m.model}"${m.selected ? " selected" : ""}>${m.model}${m.selected ? " (selected)" : ""}</option>`).join("");
    await loadPredictions(sel.value);
    $("segment-select").addEventListener("change", () => { populateDates(); drawForecast(); });
    $("date-select").addEventListener("change", drawForecast);
    sel.addEventListener("change", () => loadPredictions(sel.value));
  });

  await attempt(async () => {
    gridCells = await getJSON(DATA.grid);
    const segs = [...new Set(gridCells.map((c) => c.segment))].sort((a, b) => a === "all" ? -1 : b === "all" ? 1 : a.localeCompare(b));
    $("grid-segment").innerHTML = segs.map((s) => `<option>${s}</option>`).join("");
    renderGrid();
    for (const id of ["grid-metric", "grid-segment", "grid-condition"]) $(id).addEventListener("change", renderGrid);
  });

  if (problems.length) {
    const box = $("load-error");
    box.hidden = false;
    box.innerHTML = `<strong>Some results could not be loaded.</strong> ${problems.join("; ")}. Run <code>python src/05_export_site.py</code>, then serve the <code>docs</code> folder with <code>python -m http.server 8000</code>. Opening the file directly will not load the data.`;
    if (!metrics.length) { $("headline").textContent = "Results could not be loaded."; $("conclusion-dyn").textContent = "Results could not be loaded."; }
  }
});

// ---------- navigation: mobile menu and active-section highlight ----------
document.addEventListener("DOMContentLoaded", () => {
  const btn = $("menu-btn"), links = $("nav-links");
  btn.addEventListener("click", () => { const open = links.classList.toggle("open"); btn.setAttribute("aria-expanded", String(open)); });
  links.addEventListener("click", () => { links.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); });
  const anchors = [...links.querySelectorAll("a")];
  const byId = new Map(anchors.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      anchors.forEach((a) => a.classList.remove("active"));
      const a = byId.get(e.target.id);
      if (a) a.classList.add("active");
    }
  }, { rootMargin: "-25% 0px -65% 0px" });
  document.querySelectorAll("main section").forEach((sec) => io.observe(sec));
});
