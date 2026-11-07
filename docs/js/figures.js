// docs/js/figures.js: every figure in the report is drawn here from the exported data (no pictures), so it matches the theme.
(function () {
  "use strict";
  const TF = window.TF, $ = TF.$, el = TF.el, C = TF.charts;
  const ENS = "voting_ensemble", HOW = "hour_of_week", PER = "persistence";
  const col = (m) => `var(--c-${m})`;
  const METHODS = [ENS, HOW, PER];

  function note(host, msg) { host.innerHTML = ""; host.append(el("p", { class: "muted small" }, msg)); }

  function dataFigures(P) {
    const dq = P && P.dq, miss = "This figure needs docs/data/playground.json (run src/06_export_playground.py).";
    const f1 = $("#fig-dowheat"), f2 = $("#fig-box"), f3 = $("#fig-missmonth"), f4 = $("#fig-missday");
    if (!dq) { [f1, f2, f3, f4].forEach((h) => note(h, miss)); return; }
    let b = C.card(f1); C.dowHeat(b, dq.dowHour, { unit: "km/h" });
    b = C.card(f2); C.box(b, { stats: dq.box });
    b = C.card(f3); C.missTable(b, dq.missMonths, P.segments, dq.missBySeg);
    b = C.card(f4); C.dayBars(b, dq.missDays, dq.missByDay);
  }

  function errorFigures(P) {
    const f5 = $("#fig-seg"), f6 = $("#fig-hour"), f7 = $("#fig-three");
    if (!P) { [f5, f6, f7].forEach((h) => note(h, "This figure needs docs/data/playground.json (run src/06_export_playground.py).")); return; }
    const T = P.test, F = (o) => ({ ...TF.defaultFilter(T), ...o });
    const legend = METHODS.map((m) => ({ label: TF.label(m), color: col(m) }));
    const byMask = (mask) => METHODS.map((m) => TF.score(T, mask, m));
    const series = (rows, key = "mae") => METHODS.map((m, k) => ({ key: m, label: TF.label(m), color: col(m), values: rows.map((r) => r[k][key]) }));

    // Fig 5: by segment
    let rows = P.segments.map((_, i) => byMask(TF.mask(T, F({ segs: new Set([i]) }))));
    let b = C.card(f5, null, legend);
    C.bars(b, { cats: innerWidth < 600 ? P.segments.map((s) => s.slice(-4)) : P.segments, series: series(rows), ylabel: "MAE (km/h)", W: 640, H: 300, n: rows.map((r) => r[0].n), aria: "Test MAE by segment" });

    // Fig 6: by hour of day (forecast made at)
    rows = [...Array(24).keys()].map((h) => byMask(TF.mask(T, F({ hours: new Set([h]) }))));
    b = C.card(f6, null, legend);
    C.lines(b, { xs: [...Array(24).keys()], xticks: innerWidth < 600 ? [0, 6, 12, 18] : [0, 3, 6, 9, 12, 15, 18, 21], xfmt: (x) => TF.hh(x), series: METHODS.map((m, k) => ({ label: TF.label(m), color: col(m), width: m === ENS ? 3 : 2, dash: m === PER ? "6 5" : null, values: rows.map((r) => r[k].mae) })), ylabel: "MAE (km/h)", ymin: 0, W: 700, H: 300, aria: "Test MAE by hour of day" });

    // Fig 7: three panels sharing one legend
    f7.innerHTML = ""; f7.append(C.legend(legend));
    const grid = el("div", { class: "triple" }); f7.append(grid);
    const panel = (title, cats, masks) => {
      const host = el("div", { class: "panel3" }, el("h4", { class: "ctitle" }, title)); grid.append(host);
      const r = masks.map((m) => byMask(m)); C.bars(host, { cats, series: series(r), ylabel: "MAE (km/h)", W: 420, H: 280, wrap: 13, n: r.map((x) => x[0].n), aria: title });
    };
    panel("By weekday", TF.DOW, TF.DOW.map((_, d) => TF.mask(T, F({ dows: new Set([d]) }))));
    panel("Rain vs dry hours", ["dry", "rain"], [TF.mask(T, F({ rain: "dry" })), TF.mask(T, F({ rain: "rain" }))]);
    panel("Weekday rush vs off-peak", ["off-peak", "weekday rush (7–9, 16–18)"], [TF.mask(T, F({ period: "off" })), TF.mask(T, F({ period: "rush" }))]);
  }

  // one day, one sensor: actual and three forecasts, drawn against the time being predicted (t + 2 h)
  TF.caseChart = function (host, segId, dayIso) {
    const P = TF.D.play, T = P && P.test; if (!T) return false;
    const si = P.segments.indexOf(String(segId)), day = TF.dayOf(dayIso), rows = [];
    for (let i = 0; i < T.n; i++) if (T.seg[i] === si && T.dayO[i] === day) rows.push(i);
    rows.sort((a, b) => T.h[a] - T.h[b]); if (!rows.length) return false;
    const xs = rows.map((i) => T.h[i] + 2 - day * 24);
    const S = [["Actual", "var(--c-actual)", (i) => T.actual[i], 3.2, null], [TF.label(ENS), col(ENS), (i) => T.pred[ENS][i], 2.6, null], [TF.label(HOW), col(HOW), (i) => T.pred[HOW][i], 2, null], [TF.label(PER), col(PER), (i) => T.now[i], 2, "5 4"]];
    host.innerHTML = ""; host.append(C.legend(S.map((s) => ({ label: s[0], color: s[1], dash: !!s[4] }))));
    const box = el("div", { class: "chartbox" }); host.append(box);
    C.lines(box, { xs, xticks: xs.filter((x) => x % (innerWidth < 600 ? 6 : 3) === 0), xfmt: (x) => TF.hh(((x % 24) + 24) % 24) + (x >= 24 ? " +1d" : ""), series: S.map((s) => ({ label: s[0], color: s[1], width: s[3], dash: s[4], values: rows.map(s[2]) })), ylabel: "km/h", W: 720, H: 320, minSpan: 40, aria: `Sensor ${segId} on ${dayIso}` });
    return true;
  };

  TF.initFigures = function () {
    const P = TF.D.play; dataFigures(P); errorFigures(P);
    if (TF.initFigures.bound) return; TF.initFigures.bound = true;
    let lastW = innerWidth, t = null;
    addEventListener("resize", () => { clearTimeout(t); t = setTimeout(() => { if (Math.abs(innerWidth - lastW) < 40) return; lastW = innerWidth; TF.initFigures(); document.dispatchEvent(new Event("tf-redraw")); }, 250); });
  };
})();
