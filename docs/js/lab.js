// docs/js/lab.js: Playground, Forecast explorer, Error heatmap, "Beat the forecast" game.
// Everything is computed in the browser from docs/data/playground.json.
(function () {
  "use strict";
  const TF = window.TF, $ = TF.$, $$ = TF.$$, el = TF.el, svg = TF.svg, fmt = TF.fmt;
  let P = null;                                  // TF.D.play
  const blocks = () => ({ test: P.test, val: P.val });
  const pgSegChips = {};
  const PG = { split: "test", segs: new Set(), d0: 0, d1: 0, hours: new Set(), basis: "origin", dows: new Set(), hol: "all", rain: "all", period: "all", models: new Set(), metric: "mae" };
  const ALL_HOURS = [...Array(24).keys()], ALL_DOWS = [...Array(7).keys()];
  let pgSeg = {};

  // ======================= tabs =======================
  TF.openTab = function (name, scroll = true) {
    $$(".tab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.tab === name)));
    $$(".lab").forEach((p) => { p.hidden = p.id !== "tab-" + name; });
    if (name === "heat" && P) drawHeat();
    if (name === "explore" && P) drawExplorer();
    if (name === "game" && P && !GM.row) gameNew();
    if (scroll) $("#lab").scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // ======================= PLAYGROUND =======================
  const blk = () => P[PG.split];
  function resetPG(split) {
    PG.split = split || PG.split;
    const B = blk();
    PG.segs = new Set(P.segments.map((_, i) => i));
    PG.d0 = B.dayMin; PG.d1 = B.dayMax; PG.hours = new Set(ALL_HOURS); PG.dows = new Set(ALL_DOWS);
    PG.hol = "all"; PG.rain = "all"; PG.period = "all"; PG.basis = "origin";
    PG.models = new Set(B.models);
  }
  const filterObj = () => ({ segs: PG.segs.size === P.segments.length ? null : PG.segs, d0: PG.d0, d1: PG.d1, hours: PG.hours.size === 24 ? null : PG.hours, basis: PG.basis, dows: PG.dows.size === 7 ? null : PG.dows, hol: PG.hol, rain: PG.rain, period: PG.period });

  function buildPG() {
    const sens = $("#pg-sensors");
    sens.append(el("button", { class: "chip", type: "button", onclick: () => { PG.segs = PG.segs.size === P.segments.length ? new Set() : new Set(P.segments.map((_, i) => i)); renderPG(); } }, "all / none"));
    P.segments.forEach((s, i) => {
      const c = el("button", { class: "chip", type: "button", "aria-pressed": "true", onclick: () => { PG.segs.has(i) ? PG.segs.delete(i) : PG.segs.add(i); renderPG(); } }, s.slice(-4));
      c.title = "Sensor " + s; pgSegChips[i] = c; sens.append(c);
    });
    // hours: click or drag to paint
    const hb = $("#pg-hours"); let painting = null;
    ALL_HOURS.forEach((h) => {
      const b = el("button", { type: "button", "aria-pressed": "true", "data-h": h }, String(h).padStart(2, "0"));
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); painting = !PG.hours.has(h); PG.hours[painting ? "add" : "delete"](h); renderPG(); });
      b.addEventListener("pointerenter", () => { if (painting === null) return; PG.hours[painting ? "add" : "delete"](h); renderPG(); });
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); PG.hours.has(h) ? PG.hours.delete(h) : PG.hours.add(h); renderPG(); } });
      hb.append(b);
    });
    addEventListener("pointerup", () => { painting = null; });
    const db = $("#pg-dows");
    TF.DOW.forEach((d, i) => db.append(el("button", { type: "button", "aria-pressed": "true", "data-d": i, onclick: () => { PG.dows.has(i) ? PG.dows.delete(i) : PG.dows.add(i); renderPG(); } }, d)));
    pgSeg.split = TF.seg($("#pg-split"), (v) => { resetPG(v); setupDateRange(); renderPG(); });
    pgSeg.period = TF.seg($("#pg-period"), (v) => { PG.period = v; renderPG(); });
    pgSeg.hol = TF.seg($("#pg-hol"), (v) => { PG.hol = v; renderPG(); });
    pgSeg.rain = TF.seg($("#pg-rain"), (v) => { PG.rain = v; renderPG(); });
    pgSeg.metric = TF.seg($("#pg-metric"), (v) => { PG.metric = v; renderPG(); });
    $("#pg-d0").addEventListener("input", (e) => { PG.d0 = Math.min(+e.target.value, PG.d1); renderPG(); });
    $("#pg-d1").addEventListener("input", (e) => { PG.d1 = Math.max(+e.target.value, PG.d0); renderPG(); });
    $("#pg-presets").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) preset(b.dataset.p); });
    setupDateRange();
  }
  function setupDateRange() {
    const B = blk();
    ["#pg-d0", "#pg-d1"].forEach((id) => { const r = $(id); r.min = B.dayMin; r.max = B.dayMax; });
  }
  // preset scenarios used by the buttons and by the Discoveries cards
  function preset(name, opts = {}) {
    const split = opts.split || PG.split;
    resetPG(split); setupDateRange();
    const set = (o) => Object.assign(PG, o);
    switch (name) {
      case "rush": set({ period: "rush" }); break;
      case "off": set({ period: "off" }); break;
      case "ramp": set({ basis: "origin", hours: new Set([5, 6, 14, 15, 16]), dows: new Set([0, 1, 2, 3, 4]) }); break;
      case "weekend": set({ dows: new Set([5, 6]) }); break;
      case "rain": set({ rain: "rain" }); break;
      case "holiday": set({ hol: "only" }); break;
      case "reset": break;
      default: break;
    }
    if (opts.set) set(opts.set);
    renderPG();
  }
  TF.setPlayground = function (name, opts = {}) {
    if (!P) return; preset(name, opts); TF.openTab("play");
    const o = $(".out"); o.classList.remove("pulse"); void o.offsetWidth; o.classList.add("pulse");
  };

  function renderPG() {
    const B = blk(), f = filterObj(), mask = TF.mask(B, f);
    // controls reflect state
    pgSeg.split.set(PG.split, true); pgSeg.period.set(PG.period, true); pgSeg.hol.set(PG.hol, true); pgSeg.rain.set(PG.rain, true); pgSeg.metric.set(PG.metric, true);
    P.segments.forEach((_, i) => pgSegChips[i].setAttribute("aria-pressed", String(PG.segs.has(i))));
    $$("#pg-hours button").forEach((b) => b.setAttribute("aria-pressed", String(PG.hours.has(+b.dataset.h))));
    $$("#pg-dows button").forEach((b) => b.setAttribute("aria-pressed", String(PG.dows.has(+b.dataset.d))));
    $("#pg-d0").value = PG.d0; $("#pg-d1").value = PG.d1;
    $("#pg-dates").textContent = TF.dateOf(PG.d0).slice(5) + " → " + TF.dateOf(PG.d1).slice(5);
    $("#pg-seg-n").textContent = PG.segs.size + " of " + P.segments.length;

    const models = B.models;
    const sc = {}; models.forEach((m) => { sc[m] = TF.score(B, mask, m); });
    const per = TF.score(B, mask, "persistence"), n = per.n;
    const val = (m) => PG.metric === "mae" ? sc[m].mae : PG.metric === "rmse" ? sc[m].rmse : PG.metric === "bias" ? sc[m].bias : (per.mae > 0 ? 1 - sc[m].mae / per.mae : NaN);
    const lowerBetter = PG.metric === "mae" || PG.metric === "rmse";
    const rank = (m) => (PG.metric === "bias" ? Math.abs(val(m)) : lowerBetter ? val(m) : -val(m));
    const ordered = [...models].sort((a, b) => rank(a) - rank(b));

    // summary
    const total = B.n, pct = ((n / total) * 100).toFixed(n / total < 0.1 ? 1 : 0);
    $("#pg-block-note").textContent = PG.split === "val" ? "Validation block: all nine methods, each fitted on the training block only." : "Test block: only the selected model and the two baselines are scored on test, by design. Scoring every model on test would be selecting on test. Switch to Validation to compare all nine.";
    $("#pg-n").textContent = TF.comma(n) + " hours";
    const sparse = n < 30 ? ["bad", "Too few rows to trust"] : n < 100 ? ["warn", "Small sample: treat differences with care"] : ["muted", ""];
    const nd = new Set(); for (let i = 0; i < B.n; i++) if (mask[i]) nd.add(B.dayO[i]);
    $("#pg-n-note").innerHTML = `<span>${pct}% of the ${PG.split === "test" ? "test" : "validation"} block · ${nd.size} days</span> <span class="${sparse[0]}">${sparse[1]}</span>`;

    // bars
    const vals = ordered.map(val).filter((v) => !Number.isNaN(v)), maxv = Math.max(0.0001, ...vals.map(Math.abs)) * 1.08, box = $("#pg-bars");
    const prev = new Map($$("#pg-bars .fill").map((f2) => [f2.dataset.m, f2.style.width]));
    box.innerHTML = "";
    ordered.forEach((m, i) => {
      const v = val(m), w = Number.isNaN(v) ? 0 : (Math.abs(v) / maxv) * 100;
      const fill = el("div", { class: "fill" + (v < 0 && PG.metric !== "bias" ? " neg" : ""), "data-m": m, style: `width:${prev.get(m) || "0%"}` });
      const row = el("div", { class: "bar" + (i === 0 && n >= 1 ? " win" : "") + (m === P.selected ? " sel" : ""), style: `--mc: var(--c-${m})` },
        el("button", { class: "name", type: "button", title: TF.MODELS[m].blurb, onclick: () => TF.focusModel(m) }, el("i"), TF.label(m), i === 0 && n > 0 ? el("span", { class: "best" }, "lowest") : null),
        el("div", { class: "track" }, fill), el("span", { class: "v" }, PG.metric === "skill" || PG.metric === "bias" ? TF.sign(v, 2) : fmt(v, 2)));
      box.append(row);
      requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.width = w + "%"; }));
    });

    // verdict: winner, then table-vs-model gap with bootstrap
    const v = $("#pg-verdict"); v.innerHTML = "";
    const unit = PG.metric === "skill" ? "" : " km/h";
    if (!n) { v.textContent = "No hours match these filters. Loosen one of them."; }
    else {
      const top = ordered[0], second = ordered[1];
      let t = `<b>${TF.label(top)}</b> leads on ${PG.metric.toUpperCase()}: ${PG.metric === "skill" || PG.metric === "bias" ? TF.sign(val(top), 3) : fmt(val(top), 3)}${unit}`;
      const bt = TF.pairedBoot(B, mask, top, second);
      if (!Number.isNaN(bt.lo)) {
        const clear = bt.hi < -0.01 || bt.lo > 0.01;
        t += `. MAE difference vs ${TF.label(second)} (leader − runner-up): <b>${TF.sign(bt.diff, 3)}</b> km/h, 95% range ${TF.sign(bt.lo, 2)} to ${TF.sign(bt.hi, 2)} over ${bt.days} days: ` + (clear ? '<span class="good">a clear difference</span>.' : '<span class="warn">inside the noise, so call it a tie.</span>');
      } else t += `. <span class="warn">Fewer than 5 days selected, so no noise estimate.</span>`;
      v.innerHTML = t;
    }
    $("#pg-help").textContent = PG.metric === "mae" ? "MAE: average size of the miss in km/h (lower is better)."
      : PG.metric === "rmse" ? "RMSE: like MAE but big misses count extra (lower is better)."
      : PG.metric === "skill" ? "Skill: 1 − MAE/MAE of persistence. 0 = no better than ‘speed now’, 1 = perfect, negative = worse than persistence."
      : "Bias: average of (actual − forecast). Positive = the method forecasts too slow on average, negative = too fast. Bars show size only.";

    // self-check against the numbers in the results table
    const full = !f.segs && !f.hours && !f.dows && f.hol === "all" && f.rain === "all" && f.period === "all" && f.d0 === B.dayMin && f.d1 === B.dayMax;
    const chk = $("#pg-check");
    if (full && PG.metric === "mae") {
      const bad = [];
      ordered.forEach((m) => { const r = TF.D.m[m], ref = r ? (PG.split === "test" ? r.test_mae : r.val_mae) : null; if (ref != null && Math.abs(ref - sc[m].mae) > (PG.split === "test" ? 0.005 : 0.03)) bad.push(m); });
      chk.innerHTML = bad.length ? `<span class="bad">${bad.join(", ")} differ(s) from the Results table: re-run src/06_export_playground.py.</span>` : "With no filters these numbers match the Results table.";
    } else chk.textContent = "";
  }

  // ---------- focus a model from elsewhere on the page ----------
  TF.focusModel = function (m, scroll) {
    if (!P) { TF.toast("Run src/06_export_playground.py to enable the Lab"); return; }
    const inTest = P.test.models.includes(m), split = inTest ? PG.split : "val";
    resetPG(split);
    const pick = (B) => [m, "voting_ensemble", "hour_of_week", "persistence"].filter((x, i, a) => a.indexOf(x) === i && B.models.includes(x));
    setupDateRange();
    EX.split = split; EX.models = new Set(pick(P[split])); clampDay(); exModelChips();
    HM.split = split; HM.model = m; fillHmModels();
    renderPG(); if (scroll) TF.openTab("play");
    TF.toast(TF.label(m) + (!inTest ? " is shown on the Validation block (it is not scored on test)" : " selected"));
  };

  // ======================= FORECAST EXPLORER =======================
  const EX = { split: "test", seg: 0, day: 0, models: new Set(["voting_ensemble", "hour_of_week", "persistence"]), shown: 24, timer: null };
  let exSeg;
  function exRows() {
    const B = P[EX.split], rows = [];
    for (let i = 0; i < B.n; i++) if (B.seg[i] === EX.seg && B.dayT[i] === EX.day) rows.push(i);
    return rows.sort((a, b) => B.hourT[a] - B.hourT[b]);
  }
  function buildExplorer() {
    const s = $("#ex-seg"); P.segments.forEach((sg, i) => s.append(el("option", { value: i }, "Sensor " + sg)));
    s.addEventListener("change", () => { EX.seg = +s.value; stopPlay(); drawExplorer(); });
    exSeg = TF.seg($("#ex-split"), (v) => { EX.split = v; EX.models = new Set([...EX.models].filter((m) => P[v].models.includes(m))); if (EX.models.size < 2) EX.models = new Set(["voting_ensemble", "hour_of_week", "persistence"]); clampDay(); stopPlay(); exModelChips(); drawExplorer(); });
    $("#ex-date").addEventListener("change", (e) => { const d = TF.dayOf(e.target.value); EX.day = d; clampDay(); stopPlay(); drawExplorer(); });
    $("#ex-prev").addEventListener("click", () => { EX.day--; clampDay(); stopPlay(); drawExplorer(); });
    $("#ex-next").addEventListener("click", () => { EX.day++; clampDay(); stopPlay(); drawExplorer(); });
    $("#ex-rand").addEventListener("click", () => { const B = P[EX.split]; EX.day = B.dayTMin + 1 + Math.floor(Math.random() * (B.dayTMax - B.dayTMin - 1)); stopPlay(); drawExplorer(); });
    $("#ex-worst").addEventListener("click", worstDay);
    $("#ex-play").addEventListener("click", () => (EX.timer ? stopPlay() : startPlay()));
    EX.day = P.test.dayTMin + 1; exModelChips();
    const ch = $("#ex-chart"); ch.addEventListener("pointermove", exHover); ch.addEventListener("pointerleave", () => { TF.hideTip(); const g = $("#ex-guide"); if (g) g.style.display = "none"; });
  }
  function clampDay() { const B = P[EX.split]; EX.day = Math.max(B.dayTMin, Math.min(B.dayTMax, EX.day)); }
  function exModelChips() {
    const box = $("#ex-models"); box.innerHTML = "";
    P[EX.split].models.forEach((m) => box.append(el("button", { class: "chip", type: "button", style: `--chip: var(--c-${m})`, "aria-pressed": String(EX.models.has(m)), onclick: (e) => { EX.models.has(m) ? EX.models.delete(m) : EX.models.add(m); e.currentTarget.setAttribute("aria-pressed", String(EX.models.has(m))); drawExplorer(); } }, el("span", { class: "dot" }), TF.label(m))));
  }
  function worstDay() {
    const B = P[EX.split], m = [...EX.models].find((x) => x !== "persistence" && x !== "hour_of_week") || "voting_ensemble", e = B.err[m], per = new Map();
    for (let i = 0; i < B.n; i++) if (B.seg[i] === EX.seg) { const r = per.get(B.dayT[i]) || [0, 0]; r[0] += Math.abs(e[i]); r[1]++; per.set(B.dayT[i], r); }
    let best = null, bv = -1; per.forEach((r, d) => { if (r[1] >= 18 && r[0] / r[1] > bv) { bv = r[0] / r[1]; best = d; } });
    if (best != null) { EX.day = best; stopPlay(); drawExplorer(); TF.toast(`Worst day for ${TF.label(m)} on this sensor: MAE ${bv.toFixed(1)} km/h`); }
  }
  function stopPlay() { clearInterval(EX.timer); EX.timer = null; EX.shown = 24; const b = $("#ex-play"); if (b) b.textContent = "Replay live"; }
  function startPlay() { EX.shown = 0; $("#ex-play").textContent = "⏸ Stop"; EX.timer = setInterval(() => { EX.shown++; drawExplorer(true); if (EX.shown >= 24) stopPlay(); }, 450); drawExplorer(true); }

  let exGeom = null;
  function drawExplorer(live) {
    if (!P) return;
    const B = P[EX.split], rows = exRows(), W = 900, H = 340, L = 44, R = 14, T = 16, Bt = 34;
    $("#ex-seg").value = EX.seg; $("#ex-date").value = TF.dateOf(EX.day); $("#ex-date").min = TF.dateOf(B.dayTMin); $("#ex-date").max = TF.dateOf(B.dayTMax);
    exSeg.set(EX.split, true);
    $$("#ex-models .chip").forEach((c, i) => c.setAttribute("aria-pressed", String(EX.models.has(B.models[i]))));
    const ms = B.models.filter((m) => EX.models.has(m));
    const shown = rows.filter((i) => !live || B.hourT[i] < EX.shown);
    let lo = Infinity, hi = -Infinity;
    rows.forEach((i) => { [B.actual[i], ...ms.map((m) => B.pred[m][i])].forEach((v) => { if (!Number.isNaN(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    if (!rows.length) { $("#ex-chart").innerHTML = '<p class="muted">No rows for this sensor and day in this block.</p>'; $("#ex-info").textContent = ""; return; }
    lo = Math.max(0, Math.floor((lo - 6) / 10) * 10); hi = Math.min(130, Math.ceil((hi + 4) / 10) * 10); if (hi - lo < 40) lo = Math.max(0, hi - 40);
    const X = (h) => L + (h / 23) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bt);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `Actual speed and forecasts for sensor ${P.segments[EX.seg]} on ${TF.dateOf(EX.day)}` });
    for (let v = lo; v <= hi; v += 10) { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, String(v))); }
    for (let h = 0; h < 24; h += 3) S.append(svg("text", { class: "axis-lab", x: X(h), y: H - 12, "text-anchor": "middle" }, TF.hh(h)));
    S.append(svg("text", { class: "axis-lab", x: 4, y: 12 }, "km/h"));
    const path = (get, cls, style) => {
      let d = "", pen = false;
      shown.forEach((i) => { const v = get(i); if (Number.isNaN(v)) { pen = false; return; } d += (pen ? "L" : "M") + X(B.hourT[i]).toFixed(1) + " " + Y(v).toFixed(1); pen = true; });
      return svg("path", { d, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round", class: cls, style });
    };
    ms.forEach((m) => S.append(path((i) => B.pred[m][i], "", `stroke:var(--c-${m});stroke-width:${m === "voting_ensemble" ? 3 : 2};${m === "persistence" ? "stroke-dasharray:6 5;" : ""}opacity:.95`)));
    S.append(path((i) => B.actual[i], "", "stroke:var(--c-actual);stroke-width:3.5"));
    shown.forEach((i) => { if (!Number.isNaN(B.actual[i])) S.append(svg("circle", { cx: X(B.hourT[i]), cy: Y(B.actual[i]), r: 3.4, style: "fill:var(--c-actual)" })); });
    if (live && shown.length) { const last = shown[shown.length - 1]; S.append(svg("line", { x1: X(B.hourT[last]), x2: X(B.hourT[last]), y1: T, y2: H - Bt, style: "stroke:var(--lane);stroke-width:2;stroke-dasharray:3 4" })); }
    S.append(svg("line", { id: "ex-guide", y1: T, y2: H - Bt, style: "stroke:var(--muted);stroke-width:1;display:none" }));
    const box = $("#ex-chart"); box.innerHTML = ""; box.append(S);
    exGeom = { B, rows: shown, ms, X, L, W, R };
    $("#ex-legend").innerHTML = `<span style="--mc:var(--c-actual)"><i></i>Actual</span>` + ms.map((m) => `<span style="--mc:var(--c-${m})"><i class="${m === "persistence" ? "dash" : ""}"></i>${TF.label(m)}</span>`).join("");
    // day stats
    const info = $("#ex-info"), cells = [];
    ms.forEach((m) => { let s = 0, n = 0; rows.forEach((i) => { const e = Math.abs(B.err[m][i]); if (!Number.isNaN(e)) { s += e; n++; } }); cells.push({ m, mae: n ? s / n : NaN }); });
    cells.sort((a, b) => a.mae - b.mae);
    const rain = rows.filter((i) => B.rain[i]).length, hol = rows.some((i) => B.hol[i]);
    const dow = TF.DOW[B.dowT[rows[0]]];
    info.innerHTML = `<b>${dow} ${TF.dateOf(EX.day)}</b> · sensor ${P.segments[EX.seg]}${hol ? " · holiday" : ""}${rain ? ` · ${rain} rainy hours` : ""}<br>Day MAE: ` + cells.map((c) => `<span style="color:var(--c-${c.m})">●</span> ${TF.label(c.m)} <b>${fmt(c.mae, 2)}</b>`).join(" &nbsp; ") + `<br><span class="muted">Best this day: ${TF.label(cells[0].m)}.</span>`;
  }
  function exHover(e) {
    if (!exGeom || !exGeom.rows.length) return;
    const svgEl = $("#ex-chart svg"); const r = svgEl.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * 900;
    const h = Math.round(((x - exGeom.L) / (exGeom.W - exGeom.L - exGeom.R)) * 23); if (h < 0 || h > 23) return TF.hideTip();
    const i = exGeom.rows.find((k) => exGeom.B.hourT[k] === h); if (i === undefined) return TF.hideTip();
    const B = exGeom.B, g = $("#ex-guide"); g.setAttribute("x1", exGeom.X(h)); g.setAttribute("x2", exGeom.X(h)); g.style.display = "";
    TF.showTip(`<b>${TF.hh(h)}</b> (forecast made at ${TF.hh((h + 22) % 24)})<br>Actual <b>${fmt(B.actual[i], 1)}</b> km/h<br>` + exGeom.ms.map((m) => `<span style="color:var(--c-${m})">●</span> ${TF.label(m)} ${fmt(B.pred[m][i], 1)} <span style="opacity:.7">(miss ${fmt(Math.abs(B.err[m][i]), 1)})</span>`).join("<br>"), e.clientX, e.clientY);
  }
  TF.openExplorer = function (o) {
    if (!P) return;
    if (o.split) { EX.split = o.split; exSeg.set(o.split, true); }
    if (o.seg != null) EX.seg = P.segments.indexOf(String(o.seg));
    if (EX.seg < 0) EX.seg = 0;
    if (o.date) EX.day = TF.dayOf(o.date);
    EX.models = new Set(["voting_ensemble", "hour_of_week", "persistence"].filter((m) => P[EX.split].models.includes(m)));
    clampDay(); stopPlay(); exModelChips(); TF.openTab("explore"); if (o.play) startPlay();
  };

  // ======================= HEATMAP =======================
  const HM = { split: "test", model: "voting_ensemble", metric: "mae", seg: "all", rain: "all", basis: "origin", min: 30, userMin: false };
  function buildHeat() {
    const ms = $("#hm-seg"); ms.append(el("option", { value: "all" }, "All 8 sensors")); P.segments.forEach((s, i) => ms.append(el("option", { value: i }, "Sensor " + s)));
    TF.seg($("#hm-split"), (v) => { HM.split = v; fillHmModels(); drawHeat(); });
    TF.seg($("#hm-rain"), (v) => { HM.rain = v; drawHeat(); });
    $("#hm-model").addEventListener("change", (e) => { HM.model = e.target.value; drawHeat(); });
    $("#hm-metric").addEventListener("change", (e) => { HM.metric = e.target.value; drawHeat(); });
    $("#hm-seg").addEventListener("change", (e) => { HM.seg = e.target.value; HM.min = HM.seg === "all" ? 30 : 4; drawHeat(); });
    fillHmModels();
  }
  function fillHmModels() {
    const sel = $("#hm-model"); sel.innerHTML = "";
    P[HM.split].models.forEach((m) => sel.append(el("option", { value: m }, TF.label(m))));
    if (!P[HM.split].models.includes(HM.model)) HM.model = "voting_ensemble";
    sel.value = HM.model;
    $$("#hm-metric option").forEach((o) => { o.disabled = o.value === "gap" && HM.model === "hour_of_week"; });
    if (HM.metric === "gap" && HM.model === "hour_of_week") { HM.metric = "mae"; $("#hm-metric").value = "mae"; }
  }
  function heatCells() {
    const B = P[HM.split], hour = HM.basis === "target" ? B.hourT : B.hourO, dow = HM.basis === "target" ? B.dowT : B.dowO;
    const cell = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ n: 0, m: 0, how: 0, per: 0 })));
    const em = B.err[HM.model], eh = B.err.hour_of_week, ep = B.err.persistence;
    for (let i = 0; i < B.n; i++) {
      if (HM.seg !== "all" && B.seg[i] !== +HM.seg) continue;
      if (HM.rain === "rain" && !B.rain[i]) continue;
      if (HM.rain === "dry" && B.rain[i]) continue;
      const c = cell[dow[i]][hour[i]]; c.n++; c.m += Math.abs(em[i]); c.how += Math.abs(eh[i]); c.per += Math.abs(ep[i]);
    }
    return cell;
  }
  function drawHeat() {
    if (!P) return;
    $("#hm-model").value = HM.model; $("#hm-metric").value = HM.metric; fillHmSplitUi();
    const cells = heatCells(), grid = $("#hm-grid"); grid.innerHTML = "";
    const metricVal = (c) => HM.metric === "mae" ? c.m / c.n : HM.metric === "gap" ? (c.m - c.how) / c.n : (c.per > 0 ? 1 - c.m / c.per : NaN);
    let vmax = 0.001, vmin = 0;
    cells.forEach((row) => row.forEach((c) => { if (c.n >= HM.min) { const v = metricVal(c); if (!Number.isNaN(v)) { vmax = Math.max(vmax, Math.abs(v)); vmin = Math.min(vmin, v); } } }));
    if (HM.metric === "mae") vmax = Math.max(vmax, 1);
    const colour = (v) => {
      if (HM.metric === "mae") return TF.ramp([TF.cssv("--heat0"), TF.cssv("--heat1"), TF.cssv("--heat2")], v / vmax);
      if (HM.metric === "gap") { const t = v / vmax; return t < 0 ? TF.ramp([TF.cssv("--bg2"), TF.cssv("--good")], -t) : TF.ramp([TF.cssv("--bg2"), TF.cssv("--bad")], t); }
      return TF.ramp([TF.cssv("--heat2"), TF.cssv("--heat1"), TF.cssv("--heat0")], (v - Math.min(0, vmin)) / (Math.max(0.01, 1 - Math.min(0, vmin))));
    };
    grid.append(el("div"));
    ALL_HOURS.forEach((h) => grid.append(el("div", { class: "hh" }, h % 3 === 0 ? String(h) : "")));
    TF.DOW.forEach((d, di) => {
      grid.append(el("div", { class: "hl" }, d));
      ALL_HOURS.forEach((h) => {
        const c = cells[di][h], ok = c.n >= HM.min, v = c.n ? metricVal(c) : NaN;
        const b = el("button", { class: "hc" + (ok && !Number.isNaN(v) ? "" : " low"), type: "button", "aria-label": `${d} ${TF.hh(h)}` });
        if (ok && !Number.isNaN(v)) b.style.background = colour(v);
        TF.tipOn(b, () => `<b>${d} ${TF.hh(h)}</b> (${HM.basis === "origin" ? "forecast made" : "forecast for"})<br>${c.n} rows${c.n < HM.min ? " <span style='color:var(--warn)'>(too few: greyed)</span>" : ""}<br>` + (c.n ? `${TF.label(HM.model)} MAE <b>${fmt(c.m / c.n, 2)}</b><br>Table MAE ${fmt(c.how / c.n, 2)} · Persistence MAE ${fmt(c.per / c.n, 2)}<br>Gap to table ${TF.sign((c.m - c.how) / c.n, 2)} km/h` : ""));
        b.addEventListener("click", () => {
          if (!ok) { TF.toast("Too few rows in that cell. Lower “Min rows per cell” or pick all sensors."); return; }
          TF.setPlayground("reset", { split: HM.split, set: { basis: HM.basis, hours: new Set([h]), dows: new Set([di]), segs: HM.seg === "all" ? new Set(P.segments.map((_, i) => i)) : new Set([+HM.seg]), rain: HM.rain } });
        });
        grid.append(b);
      });
    });
    const sc = $("#hm-scale"), g = (a) => `linear-gradient(90deg,${a.join(",")})`;
    const stops = HM.metric === "mae" ? [TF.cssv("--heat0"), TF.cssv("--heat1"), TF.cssv("--heat2")] : HM.metric === "gap" ? [TF.cssv("--good"), TF.cssv("--bg2"), TF.cssv("--bad")] : [TF.cssv("--heat2"), TF.cssv("--heat1"), TF.cssv("--heat0")];
    sc.innerHTML = ""; sc.append(el("span", {}, HM.metric === "mae" ? "0 km/h" : HM.metric === "gap" ? "model better" : "worse than persistence"), el("i", { style: `background:${g(stops)}` }), el("span", {}, HM.metric === "mae" ? vmax.toFixed(1) + " km/h" : HM.metric === "gap" ? "table better" : "skill 1"), el("span", { style: "margin-left:12px" }, "▨ hatched = fewer than " + HM.min + " rows"));
    $("#hm-note").textContent = HM.metric === "gap" ? "Blue cells: the model beats the hour-of-week table. Orange cells: the table wins. Click a cell to open it in the Playground." : "Hover a cell for details. Click a cell to send that weekday and hour to the Playground.";
  }
  function fillHmSplitUi() { $$("#hm-split button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === HM.split))); $$("#hm-rain button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === HM.rain))); $("#hm-seg").value = HM.seg; }

  // ======================= GAME =======================
  const GM = { mode: "rush", round: 0, rows: [], row: null, locked: false, tally: null, rounds: 10 };
  const PLAYERS = [["you", "You", "--c-you"], ["voting_ensemble", "Ensemble", "--c-voting_ensemble"], ["hour_of_week", "Hour-of-week table", "--c-hour_of_week"], ["persistence", "Persistence", "--c-persistence"]];
  function gameReset() { GM.round = 0; GM.tally = Object.fromEntries(PLAYERS.map(([k]) => [k, { n: 0, sum: 0, wins: 0 }])); $("#gm-final").textContent = ""; gameNew(); drawScore(); }
  function history(B, i, k) { const out = []; for (let j = k; j >= 0; j--) { const idx = B.at(B.seg[i], B.h[i] - j); out.push(idx < 0 ? NaN : B.now[idx]); } return out; }
  function gameNew() {
    const B = P.test; let pool = [];
    for (let i = 0; i < B.n; i++) {
      if (history(B, i, 11).some(Number.isNaN)) continue;
      const rush = B.dowO[i] < 5 && ((B.hourO[i] >= 7 && B.hourO[i] <= 9) || (B.hourO[i] >= 16 && B.hourO[i] <= 18));
      if (GM.mode === "rush" && !rush) continue;
      if (GM.mode === "change" && Math.abs(B.actual[i] - B.now[i]) < 12) continue;
      pool.push(i);
    }
    GM.row = pool[Math.floor(Math.random() * pool.length)]; GM.locked = false;
    $("#gm-guess").value = 70; $("#gm-guess-val").textContent = "–"; $("#gm-lock").disabled = true; $("#gm-lock").hidden = false; $("#gm-next").hidden = true; $("#gm-guess").disabled = false;
    $("#gm-msg").textContent = "Look at the last 12 hours, then move the slider to guess the speed two hours from now.";
    $("#gm-round").textContent = `Round ${GM.round + 1} of ${GM.rounds}`;
    drawGame();
  }
  function drawGame(reveal) {
    const B = P.test, i = GM.row, hist = history(B, i, 11), W = 640, H = 300, L = 40, R = 90, T = 14, Bt = 30, lo = 20, hi = 120;
    const X = (k) => L + (k / 13) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bt);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Speeds over the last 12 hours at this sensor" });
    for (let v = lo; v <= hi; v += 20) { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 6, y: Y(v) + 4, "text-anchor": "end" }, String(v))); }
    const t0 = B.h[i];
    for (let k = 0; k <= 13; k += 1) if (k % 3 === 0 || k === 11 || k === 13) S.append(svg("text", { class: "axis-lab", x: X(k), y: H - 10, "text-anchor": "middle" }, k === 11 ? "now" : k === 13 ? "t+2" : TF.hh(((t0 - 11 + k) % 24 + 24) % 24).slice(0, 2)));
    S.append(svg("path", { d: hist.map((v, k) => (k ? "L" : "M") + X(k) + " " + Y(v)).join(""), fill: "none", style: "stroke:var(--c-actual);stroke-width:3.5", "stroke-linejoin": "round" }));
    hist.forEach((v, k) => S.append(svg("circle", { cx: X(k), cy: Y(v), r: 3.5, style: "fill:var(--c-actual)" })));
    S.append(svg("line", { x1: X(11), x2: X(11), y1: T, y2: H - Bt, style: "stroke:var(--muted);stroke-dasharray:3 4" }));
    S.append(svg("rect", { x: X(13) - 14, y: T, width: 28, height: H - T - Bt, rx: 8, style: "fill:var(--card2)" }));
    const g = +$("#gm-guess").value, show = $("#gm-guess-val").textContent !== "–";
    if (show && !reveal) { S.append(svg("line", { x1: X(11), y1: Y(hist[11]), x2: X(13), y2: Y(g), style: "stroke:var(--c-you);stroke-width:2.5;stroke-dasharray:5 4" })); S.append(svg("circle", { cx: X(13), cy: Y(g), r: 7, style: "fill:var(--c-you)" })); }
    if (reveal) {
      const items = [["you", g], ["voting_ensemble", B.pred.voting_ensemble[i]], ["hour_of_week", B.pred.hour_of_week[i]], ["persistence", B.now[i]]];
      S.append(svg("path", { d: `M${X(11)} ${Y(hist[11])} L${X(13)} ${Y(B.actual[i])}`, style: "stroke:var(--c-actual);stroke-width:3.5", fill: "none" }));
      items.forEach(([k, v]) => { const col = k === "you" ? "var(--c-you)" : `var(--c-${k})`; S.append(svg("circle", { cx: X(13), cy: Y(v), r: 6, style: `fill:${col}` })); });
      S.append(svg("circle", { cx: X(13), cy: Y(B.actual[i]), r: 8, style: "fill:var(--c-actual);stroke:var(--bg);stroke-width:2" }));
      // right-hand labels, nudged apart so they do not overlap
      const lab = [["Actual", B.actual[i], "var(--c-actual)"], ...items.map(([k, v]) => [k === "you" ? "You" : k === "voting_ensemble" ? "Ensemble" : k === "hour_of_week" ? "Table" : "Persist.", v, k === "you" ? "var(--c-you)" : `var(--c-${k})`])].sort((a, b) => b[1] - a[1]);
      let prevY = -99; lab.forEach(([t, v, col]) => { let y = Math.max(Y(v), prevY + 14); prevY = y; S.append(svg("text", { x: X(13) + 22, y: y + 4, style: `fill:${col};font-family:var(--mono);font-size:11px;font-weight:700` }, `${t} ${v.toFixed(0)}`)); });
    }
    const box = $("#gm-chart"); box.innerHTML = ""; box.append(S);
    const seg = P.segments[B.seg[i]], when = `${TF.DOW[B.dowO[i]]} ${TF.hh(B.hourO[i])}`;
    $("#gm-target").textContent = TF.hh(B.hourT[i]);
    box.append(el("p", { class: "small", style: "margin:6px 0 0" }, `Sensor ${seg} · it is ${when}${B.rain[i] ? " · raining" : ""}${B.hol[i] ? " · holiday" : ""} · speed now: `, el("b", {}, B.now[i].toFixed(0) + " km/h")));
  }
  function drawScore() {
    const rows = PLAYERS.map(([k, name, col]) => { const t = GM.tally[k]; return `<tr><td><span style="color:var(${col})">●</span> ${name}</td><td>${t.n}</td><td>${t.n ? (t.sum / t.n).toFixed(2) : "–"}</td><td>${t.wins}</td></tr>`; });
    $("#gm-table tbody").innerHTML = rows.join("");
  }
  function lockIn() {
    if (GM.locked) return; GM.locked = true;
    const B = P.test, i = GM.row, g = +$("#gm-guess").value, act = B.actual[i];
    const miss = { you: Math.abs(g - act), voting_ensemble: Math.abs(act - B.pred.voting_ensemble[i]), hour_of_week: Math.abs(act - B.pred.hour_of_week[i]), persistence: Math.abs(act - B.now[i]) };
    const best = Object.entries(miss).sort((a, b) => a[1] - b[1])[0][0];
    PLAYERS.forEach(([k]) => { const t = GM.tally[k]; t.n++; t.sum += miss[k]; });
    GM.tally[best].wins++; GM.round++;
    drawGame(true); drawScore();
    $("#gm-guess").disabled = true; $("#gm-lock").hidden = true;
    const rank = Object.entries(miss).sort((a, b) => a[1] - b[1]).map((x) => x[0]).indexOf("you") + 1;
    const nm = { you: "You", voting_ensemble: "the ensemble", hour_of_week: "the table", persistence: "persistence" };
    $("#gm-msg").innerHTML = `Actual speed: <b>${act.toFixed(0)} km/h</b>. You missed by <b>${miss.you.toFixed(1)}</b>, ensemble ${miss.voting_ensemble.toFixed(1)}, table ${miss.hour_of_week.toFixed(1)}, persistence ${miss.persistence.toFixed(1)}. ` + (best === "you" ? "🏆 You beat every method this round!" : `Closest this round: ${nm[best]}. You ranked #${rank} of 4.`);
    if (GM.round >= GM.rounds) {
      const avg = (k) => GM.tally[k].sum / GM.tally[k].n, order = PLAYERS.map(([k]) => k).sort((a, b) => avg(a) - avg(b));
      $("#gm-final").innerHTML = `<b>Game over.</b> Lowest average miss: <b>${order[0] === "you" ? "YOU" : nm[order[0]]}</b> (${avg(order[0]).toFixed(2)} km/h). ` + (order[0] === "hour_of_week" || order[0] === "voting_ensemble" ? "Over many hours, the weekly pattern is hard to beat." : "");
      $("#gm-next").hidden = true; $("#gm-lock").hidden = true;
      $("#gm-msg").innerHTML += "<br>Press “New game” to play again.";
    } else $("#gm-next").hidden = false;
  }
  function buildGame() {
    TF.seg($("#gm-mode"), (v) => { GM.mode = v; gameReset(); });
    $("#gm-guess").addEventListener("input", (e) => { $("#gm-guess-val").textContent = e.target.value; $("#gm-lock").disabled = false; drawGame(); });
    $("#gm-lock").addEventListener("click", lockIn); $("#gm-next").addEventListener("click", gameNew); $("#gm-reset").addEventListener("click", gameReset);
    gameReset();
  }

  // ======================= init =======================
  TF.initLab = function () {
    document.addEventListener("click", (e) => { const a = e.target.closest("[data-open-tab]"); if (a) { e.preventDefault(); TF.openTab(a.dataset.openTab); } });
    $$(".tab").forEach((t) => t.addEventListener("click", () => TF.openTab(t.dataset.tab, false)));
    P = TF.D.play;
    if (!P) {
      const msg = "The Lab needs docs/data/playground.json. From the repo root run:  python src/06_export_playground.py  and reload (serve docs/ over http; opening index.html directly will not load data).";
      const b = $("#lab-error"); b.hidden = false; b.textContent = msg;
      $$(".lab").forEach((p) => (p.hidden = true)); $$(".tab").forEach((t) => (t.disabled = true)); return;
    }
    resetPG("val"); buildPG(); renderPG(); buildExplorer(); buildHeat(); buildGame();
    TF.openTab("play", false);
    addEventListener("keydown", (e) => { if (e.key === "Escape") TF.hideTip(); });
    const mo = new MutationObserver(() => { if (!$("#tab-heat").hidden) drawHeat(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  };
})();
