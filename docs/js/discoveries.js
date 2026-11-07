// docs/js/discoveries.js: bonus observations. Every number is computed live from the exported rows (or the metrics files),
// and every card has a "Try it" button that sets the Lab up so a reader can check the claim.
(function () {
  "use strict";
  const TF = window.TF, $ = TF.$, el = TF.el, fmt = TF.fmt, sg = TF.sign;

  function cards() {
    const D = TF.D, P = D.play, out = [];
    const T = P && P.test, V = P && P.val;
    const f = (o) => ({ ...TF.defaultFilter(T), ...o });
    const hourSet = (a) => new Set(a);
    const ENS = "voting_ensemble", HOW = "hour_of_week", PER = "persistence";
    const median = (a) => { const s = Float64Array.from(a).sort(); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

    // 1. the table ties the ensemble (authoritative numbers from the results files)
    {
      const e = D.m[ENS], h = D.m[HOW], p = D.p[HOW];
      if (e && h && p) {
        const inc = p.ci_low <= 0 && p.ci_high >= 0;
        out.push({ emo: "🤝", title: "A lookup table ties a model of hundreds of trees", ev: inc ? "mid" : "strong",
          big: `${fmt(h.test_mae, 3)} vs ${fmt(e.test_mae, 3)}`, small: "table vs ensemble, test MAE (km/h)",
          text: `The hour-of-week table (no learning, just averages) is ${fmt(e.test_mae - h.test_mae, 3)} km/h ${e.test_mae > h.test_mae ? "ahead of" : "behind"} the ensemble. The paired difference is ${sg(p.mean_diff, 3)} with a 95% range of ${fmt(p.ci_low, 3)} to ${fmt(p.ci_high, 3)}` + (inc ? ", which includes zero: no clear winner. The honest reading is “no improvement shown”, not “worse”." : "."),
          try: P && ["reset", { set: { models: new Set([ENS, HOW]) } }] });
      }
    }
    if (!P) return out;

    // 2. crossover: wins the rush, loses the rest
    {
      const m1 = TF.mask(T, f({ period: "rush" })), m2 = TF.mask(T, f({ period: "off" }));
      const a = TF.pairedBoot(T, m1, ENS, HOW), b = TF.pairedBoot(T, m2, ENS, HOW), n1 = TF.score(T, m1, ENS).n, n2 = TF.score(T, m2, ENS).n;
      const clear = a.hi < -0.01 && b.lo > 0.01;
      out.push({ emo: "🔀", title: "The ensemble wins the rush, loses the rest", ev: clear ? "strong" : "mid",
        big: `${sg(a.diff, 2)} / ${sg(b.diff, 2)}`, small: `ensemble − table, km/h: weekday rush (${TF.comma(n1)} h) / off-peak (${TF.comma(n2)} h)`,
        text: `In weekday rush hours (forecast made 07–09 or 16–18) the ensemble is better than the table by ${fmt(-a.diff, 2)} km/h (95% range ${sg(a.lo, 2)} to ${sg(a.hi, 2)}). Off-peak it is worse by ${fmt(b.diff, 2)} (${sg(b.lo, 2)} to ${sg(b.hi, 2)}). Once a jam has started, the latest speeds and neighbours reveal it. Otherwise the table’s clean average is steadier.`,
        try: ["rush", { set: { models: new Set([ENS, HOW, PER]) } }] });
    }

    // 3. hardest forecasts are made just before the rush
    {
      const byHour = [];
      for (let h = 0; h < 24; h++) { const m = TF.mask(T, f({ hours: hourSet([h]) })); byHour.push({ h, e: TF.score(T, m, ENS).mae, w: TF.score(T, m, HOW).mae, p: TF.score(T, m, PER).mae }); }
      const top = [...byHour].sort((x, y) => y.e - x.e).slice(0, 4).map((x) => x.h).sort((x, y) => x - y);
      const on = byHour.filter((x) => x.h === 5 || x.h === 6);
      const e56 = TF.mean(on.map((x) => x.e)), w56 = TF.mean(on.map((x) => x.w)), p56 = TF.mean(on.map((x) => x.p));
      out.push({ emo: "📉", title: "The hardest forecasts are made just before the rush", ev: "strong",
        big: top.map((h) => String(h).padStart(2, "0")).join(" · "), small: "hours of day with the largest ensemble error (forecast made at)",
        text: `A forecast made at 05–06 is about the 07–08 jam, and one made at 14–16 is about the 16–18 jam. At that moment the road still looks normal, so persistence misses by ${fmt(p56, 1)} km/h at 05–06 and the ensemble by ${fmt(e56, 1)}. The table, which knows rush hour is coming, does better (${fmt(w56, 1)}). Timing matters more than anything else in this problem.`,
        try: ["ramp", { set: { models: new Set([ENS, HOW, PER]) } }] });
    }

    // 4. RMSE halves, typical miss does not
    {
      const all = TF.mask(T, f({})), ae = (m) => { const a = []; for (let i = 0; i < T.n; i++) if (all[i] && !Number.isNaN(T.err[m][i])) a.push(Math.abs(T.err[m][i])); return a; };
      const me = median(ae(ENS)), mp = median(ae(PER)), se = TF.score(T, all, ENS), sp = TF.score(T, all, PER);
      out.push({ emo: "🎯", title: "The model fixes the big misses, not the typical one", ev: "strong",
        big: `×${(se.rmse / sp.rmse).toFixed(2)}`, small: `RMSE ratio, ensemble ÷ persistence (${fmt(se.rmse, 2)} ÷ ${fmt(sp.rmse, 2)})`,
        text: `The typical (median) miss only improves from ${fmt(mp, 1)} to ${fmt(me, 1)} km/h (×${(me / mp).toFixed(2)}), MAE from ${fmt(sp.mae, 2)} to ${fmt(se.mae, 2)} (×${(se.mae / sp.mae).toFixed(2)}), but RMSE falls the most (×${(se.rmse / sp.rmse).toFixed(2)}). Persistence’s damage comes from rare, large errors when traffic suddenly changes, and that is where a model helps.`,
        try: ["reset", { set: { models: new Set([ENS, PER]), metric: "rmse" } }] });
    }

    // 5. linear models are close to persistence (validation block)
    {
      const m = D.m, lin = ["linear", "ridge", "lasso"].map((k) => m[k] && m[k].val_mae).filter((x) => x != null), per = m[PER] && m[PER].val_mae, rf = m.random_forest && m.random_forest.val_mae;
      if (lin.length && per && rf) {
        out.push({ emo: "📏", title: "Straight-line models barely beat “speed now”", ev: "strong",
          big: `${fmt(Math.min(...lin), 2)} vs ${fmt(per, 2)}`, small: "best linear model vs persistence, validation MAE (km/h)",
          text: `Linear, ridge and lasso land at ${fmt(Math.min(...lin), 2)}–${fmt(Math.max(...lin), 2)} km/h, only ${fmt(per - Math.min(...lin), 2)} better than persistence (${fmt(per, 2)}). Random forest reaches ${fmt(rf, 2)}. Traffic is a nonlinear pattern (“weekday AND 08:00 means slow”), which trees capture and a weighted sum cannot. Shown on validation, where every model is scored.`,
          try: ["reset", { split: "val", set: { models: new Set(["linear", "ridge", "lasso", PER, "random_forest"]) } }] });
      }
    }

    // 6. only the frozen sensor lets persistence beat the model
    {
      const rows = P.segments.map((s, i) => { const m = TF.mask(T, f({ segs: new Set([i]) })); return { s, i, e: TF.score(T, m, ENS).mae, w: TF.score(T, m, HOW).mae, p: TF.score(T, m, PER).mae }; });
      const persWins = rows.filter((r) => r.p < r.e), fro = rows.find((r) => r.s === "400100");
      out.push({ emo: "🧊", title: "One frozen sensor flatters persistence", ev: "mid",
        big: `${persWins.length} of ${rows.length}`, small: "sensors where persistence beats the ensemble" + (persWins.length ? ": " + persWins.map((r) => r.s).join(", ") : ""),
        text: fro ? `On sensor 400100 persistence scores ${fmt(fro.p, 2)} km/h against ${fmt(fro.e, 2)} for the ensemble and ${fmt(fro.w, 2)} for the table. Its feed repeats one value for hours, so “speed now” is nearly always right. That is a data-quality story, not proof that persistence is good: on the other sensors it is far worse (up to ${fmt(Math.max(...rows.map((r) => r.p)), 1)} km/h).` : "",
        try: fro ? ["reset", { set: { segs: new Set([fro.i]) } }] : null });
    }

    // 7. rain
    {
      const mr = TF.mask(T, f({ rain: "rain" })), md = TF.mask(T, f({ rain: "dry" })), sr = TF.score(T, mr, ENS), sd = TF.score(T, md, ENS);
      const days = new Set(); for (let i = 0; i < T.n; i++) if (mr[i]) days.add(T.dayO[i]);
      out.push({ emo: "🌧", title: "Rain: not enough rainy hours to say", ev: "weak",
        big: `${TF.comma(sr.n)} h`, small: `rainy hours in the test block (${((sr.n / T.n) * 100).toFixed(1)}%), on ${days.size} days`,
        text: `Ensemble MAE is ${fmt(sr.mae, 2)} km/h in rain and ${fmt(sd.mae, 2)} when dry, so rain does not look harder. But the rainy hours come from just ${days.size} days and the same days may differ in other ways. Treat this as a hint, not a finding.`,
        try: ["rain", { set: { models: new Set([ENS, HOW, PER]) } }] });
    }

    // 8. weekends
    {
      const mw = TF.mask(T, f({ dows: hourSet([5, 6]) })), md = TF.mask(T, f({ dows: hourSet([0, 1, 2, 3, 4]) })), a = TF.score(T, mw, ENS), b = TF.score(T, md, ENS);
      out.push({ emo: "🏖", title: "Weekends are easy, weekdays are not", ev: "strong",
        big: `${fmt(a.mae, 2)} vs ${fmt(b.mae, 2)}`, small: "ensemble MAE, weekend vs weekday (km/h)",
        text: `Weekend traffic stays near free flow, so every method does well (the ensemble misses by ${fmt(a.mae, 2)} km/h). On weekdays the error is ${(b.mae / a.mae).toFixed(1)}× larger, because rush-hour jams start and end quickly. The headline MAE is mostly a weekday number.`,
        try: ["weekend", { set: { models: new Set([ENS, HOW, PER]) } }] });
    }

    // 9. sensor-by-sensor winners
    {
      const rows = P.segments.map((s, i) => { const m = TF.mask(T, f({ segs: new Set([i]) })); return { s, i, d: TF.score(T, m, ENS).mae - TF.score(T, m, HOW).mae }; });
      const wins = rows.filter((r) => r.d < 0), best = [...rows].sort((x, y) => x.d - y.d)[0];
      out.push({ emo: "📍", title: "The ensemble beats the table on very few sensors", ev: "mid",
        big: `${wins.length} of ${rows.length}`, small: "sensors where the ensemble has the lower test MAE" + (wins.length ? ": " + wins.map((r) => r.s).join(", ") : ""),
        text: `The biggest win for the ensemble is on sensor ${best.s} (${sg(best.d, 2)} km/h versus the table). On the others the table is ahead by up to ${fmt(Math.max(...rows.map((r) => r.d)), 2)} km/h. One sensor in eight is a hint that location matters, but with eight sensors it could also be luck.`,
        try: ["reset", { set: { segs: new Set([best.i]), models: new Set([ENS, HOW, PER]) } }] });
    }

    // 10. day-by-day scoreboard
    {
      const perDay = new Map();
      for (let i = 0; i < T.n; i++) { const d = T.dayO[i], r = perDay.get(d) || { e: 0, w: 0, n: 0, hol: 0 }; r.e += Math.abs(T.err[ENS][i]); r.w += Math.abs(T.err[HOW][i]); r.n++; r.hol += T.hol[i]; perDay.set(d, r); }
      const days = [...perDay.entries()].map(([d, r]) => ({ d, diff: r.e / r.n - r.w / r.n, hol: r.hol > 0 })), wins = days.filter((x) => x.diff < 0).length, best = [...days].sort((x, y) => x.diff - y.diff)[0];
      // the sensor where the ensemble beat the table most on that day
      let bs = 0, bd = Infinity;
      P.segments.forEach((s, k) => { let a = 0, n = 0; for (let i = 0; i < T.n; i++) if (T.dayO[i] === best.d && T.seg[i] === k) { a += Math.abs(T.err[ENS][i]) - Math.abs(T.err[HOW][i]); n++; } if (n && a / n < bd) { bd = a / n; bs = k; } });
      out.push({ emo: "📅", title: best.hol ? "The table wins most days, but the ensemble’s best day is the holiday" : "The table wins most days", ev: "mid",
        big: `${wins} of ${days.length} days`, small: "days on which the ensemble has the lower MAE",
        text: `The ensemble’s best day against the table is ${TF.dateOf(best.d)} (${sg(best.diff, 2)} km/h)${best.hol ? ": the public holiday. The table expects a weekday slowdown that never comes, while the ensemble has a holiday flag and recent speeds. With only one holiday in the test block this is one example, not a rule" : ""}. Open it in the explorer (sensor ${P.segments[bs]}, where the gap was largest).`,
        try: ["explore", { date: TF.dateOf(best.d), seg: P.segments[bs] }] });
    }
    return out;
  }

  const EVID = { strong: "evidence: strong", mid: "evidence: medium", weak: "evidence: weak" };
  TF.initDiscoveries = function () {
    const box = $("#dgrid"); box.innerHTML = "";
    let list = [];
    try { list = cards(); } catch (e) { console.error(e); }
    if (!list.length) { box.append(el("p", { class: "muted" }, "The discoveries are computed from docs/data/playground.json. Run src/06_export_playground.py first.")); return; }
    list.forEach((c) => {
      const btn = c.try ? el("button", { class: "btn sm primary", type: "button", onclick: () => {
        if (c.try[0] === "explore") TF.openExplorer({ split: "test", seg: c.try[1].seg, date: c.try[1].date, play: false });
        else TF.setPlayground(c.try[0], c.try[1]);
      } }, c.try[0] === "explore" ? "📈 Open that day" : "🧪 Try it in the Lab") : null;
      box.append(el("article", { class: "disc" },
        el("div", { class: "top" }, el("span", { class: "emo" }, c.emo), el("span", { class: "tag " + c.ev }, EVID[c.ev])),
        el("h3", {}, c.title), el("div", { class: "bignum" }, c.big, el("small", {}, c.small)), el("p", {}, c.text), btn));
    });
  };
})();
