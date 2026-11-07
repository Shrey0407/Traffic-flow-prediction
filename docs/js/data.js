// docs/js/data.js: loads the JSON written by src/05_export_site.py and src/06_export_playground.py
// and turns the per-row table into typed arrays. The browser only filters and averages; no model runs here.
(function () {
  "use strict";
  const TF = window.TF;

  async function getJSON(url, optional) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(url + " (" + r.status + ")");
      return await r.json();
    } catch (e) { if (optional) return null; throw e; }
  }

  // one block (val or test) -> typed arrays + derived calendar fields
  function prep(b, segments) {
    const n = b.n, f32 = (a) => Float32Array.from(a, (x) => (x == null ? NaN : x));
    const o = { n, segments, models: b.models.slice(), pred: {} };
    o.h = Int32Array.from(b.h); o.seg = Uint8Array.from(b.seg); o.rain = Uint8Array.from(b.rain); o.hol = Uint8Array.from(b.hol);
    o.actual = f32(b.actual); o.now = f32(b.now);
    o.pred.persistence = o.now;
    for (const m of Object.keys(b.pred)) o.pred[m] = f32(b.pred[m]);
    o.hourO = new Uint8Array(n); o.dayO = new Int16Array(n); o.dowO = new Uint8Array(n);
    o.hourT = new Uint8Array(n); o.dayT = new Int16Array(n); o.dowT = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const h = o.h[i], t = h + 2;
      o.dayO[i] = Math.floor(h / 24); o.hourO[i] = h % 24; o.dowO[i] = (o.dayO[i] + 6) % 7;  // 2017-01-01 was a Sunday
      o.dayT[i] = Math.floor(t / 24); o.hourT[i] = t % 24; o.dowT[i] = (o.dayT[i] + 6) % 7;
    }
    o.err = {};     // signed error: actual - forecast
    for (const m of Object.keys(o.pred)) {
      const e = new Float32Array(n), p = o.pred[m];
      for (let i = 0; i < n; i++) e[i] = o.actual[i] - p[i];
      o.err[m] = e;
    }
    o.dayMin = Math.min(...o.dayO); o.dayMax = Math.max(...o.dayO);
    o.dayTMin = Math.min(...o.dayT); o.dayTMax = Math.max(...o.dayT);
    o.index = new Map();
    for (let i = 0; i < n; i++) o.index.set(o.seg[i] * 100000 + o.h[i], i);
    o.at = (seg, h) => { const k = o.index.get(seg * 100000 + h); return k === undefined ? -1 : k; };
    return o;
  }

  TF.load = async function () {
    const [metrics, paired, cases, summary, sensors, play] = await Promise.all([
      getJSON("data/metrics.json"), getJSON("data/test_paired.json", true), getJSON("data/error_cases.json", true),
      getJSON("data/data_summary.json"), getJSON("data/sensors.json", true), getJSON("data/playground.json", true),
    ]);
    const D = (TF.D = { metrics, paired: paired || [], cases: cases || [], summary, sensors, play: null, m: {}, p: {} });
    metrics.forEach((r) => { D.m[r.model] = r; });
    D.paired.forEach((r) => { D.p[r.reference] = r; });
    summary.missing_pct = summary.missing_rate * 100;
    D.s = summary;
    if (play) {
      D.play = { dq: play.dq || null, selected: play.selected, segments: play.segments.map(String), val: prep(play.val, play.segments.map(String)), test: prep(play.test, play.segments.map(String)) };
    }
    TF.ready = true;
    return D;
  };

  // ---- shared mask + metric helpers used by Lab and Discoveries ----
  // f: {segs:Set|null, d0, d1, hours:Set|null, basis, dows:Set|null, hol, rain, period}
  TF.mask = function (B, f) {
    const n = B.n, m = new Uint8Array(n), basisT = f.basis === "target";
    const hour = basisT ? B.hourT : B.hourO, dow = basisT ? B.dowT : B.dowO;
    for (let i = 0; i < n; i++) {
      if (f.segs && !f.segs.has(B.seg[i])) continue;
      if (B.dayO[i] < f.d0 || B.dayO[i] > f.d1) continue;
      if (f.hours && !f.hours.has(hour[i])) continue;
      if (f.dows && !f.dows.has(dow[i])) continue;
      if (f.hol === "no" && B.hol[i]) continue;
      if (f.hol === "only" && !B.hol[i]) continue;
      if (f.rain === "rain" && !B.rain[i]) continue;
      if (f.rain === "dry" && B.rain[i]) continue;
      if (f.period && f.period !== "all") {
        const h = B.hourO[i], rush = B.dowO[i] < 5 && ((h >= 7 && h <= 9) || (h >= 16 && h <= 18));
        if ((f.period === "rush") !== rush) continue;
      }
      m[i] = 1;
    }
    return m;
  };
  TF.score = function (B, mask, model) {
    const e = B.err[model]; let n = 0, a = 0, s = 0, b = 0;
    for (let i = 0; i < B.n; i++) {
      if (!mask[i]) continue; const x = e[i]; if (Number.isNaN(x)) continue;
      n++; a += Math.abs(x); s += x * x; b += x;
    }
    return n ? { n, mae: a / n, rmse: Math.sqrt(s / n), bias: b / n } : { n: 0, mae: NaN, rmse: NaN, bias: NaN };
  };
  // paired day-block bootstrap of mean(|eA|) - mean(|eB|); returns {diff, lo, hi, days}
  TF.pairedBoot = function (B, mask, A, Bm, draws = 1000) {
    const eA = B.err[A], eB = B.err[Bm], per = new Map();
    for (let i = 0; i < B.n; i++) {
      if (!mask[i]) continue;
      const d = B.dayO[i]; let r = per.get(d); if (!r) per.set(d, (r = [0, 0]));
      r[0] += Math.abs(eA[i]) - Math.abs(eB[i]); r[1] += 1;
    }
    const rows = Array.from(per.values()), D = rows.length;
    let sum = 0, cnt = 0; rows.forEach((r) => { sum += r[0]; cnt += r[1]; });
    if (D < 5 || !cnt) return { diff: cnt ? sum / cnt : NaN, lo: NaN, hi: NaN, days: D };
    const rnd = TF.rng(20241107), out = [];
    for (let k = 0; k < draws; k++) {
      let s = 0, c = 0;
      for (let j = 0; j < D; j++) { const r = rows[Math.floor(rnd() * D)]; s += r[0]; c += r[1]; }
      out.push(s / c);
    }
    out.sort((x, y) => x - y);
    return { diff: sum / cnt, lo: out[Math.floor(draws * 0.025)], hi: out[Math.floor(draws * 0.975)], days: D };
  };
  TF.defaultFilter = (B) => ({ segs: null, d0: B.dayMin, d1: B.dayMax, hours: null, basis: "origin", dows: null, hol: "all", rain: "all", period: "all" });
})();
