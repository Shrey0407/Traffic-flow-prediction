// docs/js/util.js: small helpers shared by every other script. No dependencies.
(function () {
  "use strict";
  const TF = (window.TF = { ready: false });

  TF.$ = (s, r = document) => r.querySelector(s);
  TF.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  TF.fmt = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x)) ? "–" : Number(x).toFixed(d);
  TF.sign = (x, d = 2) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(d);
  TF.comma = (x) => Number(x).toLocaleString("en-US");
  TF.DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  TF.hh = (h) => String(h).padStart(2, "0") + ":00";

  TF.MODELS = {
    persistence: { label: "Persistence", kind: "baseline", flex: 0, blurb: "Forecast = the speed right now.", why: "The simplest possible forecast and the reference for skill.", assume: "Traffic changes slowly.", how: "Copies the current speed forward two hours." },
    hour_of_week: { label: "Hour-of-week table", kind: "baseline", flex: 1, blurb: "Forecast = the usual speed for this sensor, weekday and hour.", why: "Needs no learning: a strong bar for any model.", assume: "Traffic repeats every week.", how: "Looks up the training-data average for the same sensor, weekday and hour (a 1,344-entry table)." },
    linear: { label: "Linear regression", kind: "linear", flex: 2, blurb: "Weighted sum of the 16 features.", why: "Interpretable starting point.", assume: "Speed is a straight-line function of the features.", how: "Least squares: finds one weight per feature." },
    ridge: { label: "Ridge", kind: "linear", flex: 2, blurb: "Linear model with an L2 penalty.", why: "Stabilises weights when features overlap (lags, rolling means).", assume: "Linear, with correlated lags.", how: "Least squares plus a penalty on large weights." },
    lasso: { label: "Lasso", kind: "linear", flex: 2, blurb: "Linear model with an L1 penalty.", why: "Can switch weak features off.", assume: "Linear, with some useless features.", how: "Least squares plus a penalty that pushes weak weights to zero." },
    decision_tree: { label: "Decision tree", kind: "tree", flex: 3, blurb: "A flowchart of yes/no rules.", why: "Captures “weekday and 08:00 means slow” without hand-made interaction terms.", assume: "Thresholds and interactions matter.", how: "Splits the data into groups that reduce squared error." },
    random_forest: { label: "Random forest", kind: "tree", flex: 4, blurb: "Average of many decorrelated trees.", why: "Reduces the variance of a single tree.", assume: "Many weak, noisy trees average to a stable one.", how: "Trains hundreds of trees on random samples and averages them." },
    xgboost: { label: "XGBoost", kind: "tree", flex: 5, blurb: "Trees added one by one, each fixing the last one's errors.", why: "Strong default for tabular data.", assume: "Errors have structure a next tree can learn.", how: "Boosting: every new tree fits the remaining error." },
    voting_ensemble: { label: "Voting ensemble", kind: "ensemble", flex: 5, blurb: "Average of random forest, XGBoost and decision tree.", why: "Chosen by the validation rule.", assume: "Different models make different mistakes.", how: "Takes the mean of three models' forecasts." },
  };
  TF.ORDER = ["persistence", "hour_of_week", "linear", "ridge", "lasso", "decision_tree", "random_forest", "xgboost", "voting_ensemble"];
  TF.label = (m) => (TF.MODELS[m] ? TF.MODELS[m].label : m);
  TF.color = (m) => getComputedStyle(document.documentElement).getPropertyValue("--c-" + m).trim() || "#999";
  TF.cssv = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  TF.el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === "class") e.className = v;
      else if (k === "html") e.innerHTML = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };
  const NS = "http://www.w3.org/2000/svg";
  TF.svg = (tag, attrs = {}, ...kids) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) { if (v != null && v !== false) e.setAttribute(k, v); }
    kids.flat().forEach((c) => c != null && e.append(c.nodeType ? c : document.createTextNode(c)));
    return e;
  };

  // deterministic random numbers (so bootstrap results do not jump around)
  TF.rng = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- tooltip ----
  const tip = () => document.getElementById("tip");
  TF.showTip = (html, x, y) => {
    const t = tip(); if (!t) return;
    t.innerHTML = html; t.classList.add("on");
    const w = t.offsetWidth, h = t.offsetHeight;
    let left = x + 14, top = y + 14;
    if (left + w > window.innerWidth - 8) left = x - w - 14;
    if (top + h > window.innerHeight - 8) top = y - h - 14;
    t.style.left = Math.max(8, left) + "px"; t.style.top = Math.max(8, top) + "px";
  };
  TF.hideTip = () => { const t = tip(); if (t) t.classList.remove("on"); };
  TF.tipOn = (node, htmlFn) => {
    node.addEventListener("pointermove", (e) => TF.showTip(typeof htmlFn === "function" ? htmlFn(e) : htmlFn, e.clientX, e.clientY));
    node.addEventListener("pointerleave", TF.hideTip);
  };

  let toastTimer;
  TF.toast = (msg) => {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("on");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 2600);
  };

  // ---- segmented control: buttons with data-v, one pressed ----
  TF.seg = (root, onChange) => {
    const api = {
      value: () => { const b = root.querySelector('button[aria-pressed="true"]'); return b ? b.dataset.v : null; },
      set(v, silent) {
        root.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
        if (!silent && onChange) onChange(v);
      },
    };
    root.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-v]"); if (!b || !root.contains(b)) return;
      api.set(b.dataset.v);
    });
    return api;
  };

  // ---- statistics ----
  TF.dateOf = (day) => new Date(Date.UTC(2017, 0, 1 + day)).toISOString().slice(0, 10);
  TF.dayOf = (iso) => Math.round((Date.parse(iso + "T00:00:00Z") - Date.UTC(2017, 0, 1)) / 86400000);
  TF.mean = (a) => a.reduce((s, x) => s + x, 0) / (a.length || 1);

  // linear colour ramp between hex colours
  const hex = (c) => { c = c.replace("#", ""); if (c.length === 3) c = c.split("").map((x) => x + x).join(""); return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); };
  TF.ramp = (stops, t) => {
    t = Math.max(0, Math.min(1, t));
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(t * n)), f = t * n - i;
    const a = hex(stops[i]), b = hex(stops[i + 1]);
    return "rgb(" + a.map((x, k) => Math.round(x + (b[k] - x) * f)).join(",") + ")";
  };

  TF.countUp = (el, to, dec) => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = to.toFixed(dec); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (to * e).toFixed(dec);
      if (p < 1) requestAnimationFrame(step); else el.textContent = to.toFixed(dec);
    };
    requestAnimationFrame(step);
  };
})();
