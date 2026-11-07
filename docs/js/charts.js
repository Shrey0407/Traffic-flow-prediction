// docs/js/charts.js: small SVG/HTML chart helpers. Colours come from CSS variables, so every chart follows the light/dark theme.
// Legends sit above the plot and x labels are always horizontal (long labels wrap onto two lines).
(function () {
  "use strict";
  const TF = window.TF, svg = TF.svg, el = TF.el, fmt = TF.fmt;
  const C = (TF.charts = {});

  C.width = (host, fallback) => { const w = host.clientWidth; return w > 120 ? Math.round(w) : fallback; };
  C.height = (W, H) => Math.round(Math.min(H, Math.max(220, W * 0.62)));
  function niceStep(max, n) {
    const raw = max / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
  }
  function ticks(lo, hi, n = 5) { const st = niceStep(hi - lo, n), out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + 1e-9; v += st) out.push(+v.toFixed(6)); return out; }
  function wrap(label, max) {
    const words = String(label).split(/(?<=,)\s+|\s+/), lines = []; let cur = "";
    words.forEach((w) => { if ((cur + " " + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); });
    if (cur) lines.push(cur); return lines;
  }
  const textLines = (x, y, lines, cls, anchor) => { const t = svg("text", { x, y, class: cls, "text-anchor": anchor || "middle" }); lines.forEach((l, i) => t.append(svg("tspan", { x, dy: i ? 12 : 0 }, l))); return t; };

  C.legend = (items) => el("div", { class: "clegend" }, items.map((it) => el("span", { style: `--mc:${it.color}` }, el("i", { class: it.dash ? "dash" : "" }), it.label)));
  C.card = (host, title, legendItems) => { host.innerHTML = ""; if (title) host.append(el("h4", { class: "ctitle" }, title)); if (legendItems) host.append(C.legend(legendItems)); const box = el("div", { class: "chartbox" }); host.append(box); return box; };

  // ---------- grouped bars ----------
  C.bars = function (host, o) {
    const W = C.width(host, o.W || 560), H = C.height(W, o.H || 300), L = 46, R = 10, T = 22, nLines = Math.max(...o.cats.map((c) => wrap(c, o.wrap || 14).length)), B = 18 + nLines * 12;
    const max = o.ymax || Math.max(...o.series.flatMap((s) => s.values.filter((v) => !Number.isNaN(v)))) * 1.08, tk = ticks(0, max, 5); if (tk[tk.length - 1] < max - 1e-9) tk.push(+(tk[tk.length - 1] + (tk[1] - tk[0])).toFixed(6)); const top = tk[tk.length - 1];
    const Y = (v) => T + (1 - v / top) * (H - T - B), gw = (W - L - R) / o.cats.length, bw = Math.min(40, (gw * 0.78) / o.series.length);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria || o.title || "bar chart" });
    tk.forEach((v) => { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, String(v))); });
    S.append(svg("text", { class: "axis-lab", x: 0, y: 9 }, o.ylabel || ""));
    const hit = [];
    o.cats.forEach((c, ci) => {
      const cx = L + gw * ci + gw / 2;
      o.series.forEach((s, si) => {
        const v = s.values[ci]; if (Number.isNaN(v) || v == null) return;
        const x = cx - (bw * o.series.length) / 2 + si * bw, r = svg("rect", { x, y: Y(v), width: bw - 1.5, height: Math.max(1, Y(0) - Y(v)), rx: 2, style: `fill:${s.color}` });
        S.append(r);
      });
      S.append(textLines(cx, H - B + 16, wrap(c, o.wrap || 14), "axis-lab"));
      hit.push(svg("rect", { x: L + gw * ci, y: T, width: gw, height: H - T - B, class: "hit" }));
    });
    S.append(svg("line", { class: "axis-line", x1: L, x2: W - R, y1: Y(0), y2: Y(0) }));
    hit.forEach((h, ci) => { S.append(h); TF.tipOn(h, () => `<b>${String(o.cats[ci]).replace(/\n/g, " ")}</b>` + (o.n ? `<br>${TF.comma(o.n[ci])} hours` : "") + o.series.map((s) => `<br><span style="color:${s.color}">&#9632;</span> ${s.label}: <b>${fmt(s.values[ci], 2)}</b>`).join("")); });
    host.append(S);
  };

  // ---------- lines ----------
  C.lines = function (host, o) {
    const W = C.width(host, o.W || 900), H = C.height(W, o.H || 320), L = 46, R = 14, T = 22, B = 32, xs = o.xs;
    let lo = o.ymin, hi = o.ymax;
    if (lo == null || hi == null) { let a = Infinity, b = -Infinity; o.series.forEach((s) => s.values.forEach((v) => { if (!Number.isNaN(v) && v != null) { a = Math.min(a, v); b = Math.max(b, v); } })); lo = lo ?? Math.max(0, Math.floor((a - 4) / 10) * 10); hi = hi ?? Math.ceil((b + 4) / 10) * 10; if (hi - lo < (o.minSpan || 0)) lo = Math.max(0, hi - o.minSpan); }
    const x0 = o.x0 ?? xs[0], x1 = o.x1 ?? xs[xs.length - 1], X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria || o.title || "line chart" });
    ticks(lo, hi, 5).forEach((v) => { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, String(v))); });
    (o.xticks || xs).forEach((x) => S.append(svg("text", { class: "axis-lab", x: X(x), y: H - 10, "text-anchor": "middle" }, o.xfmt ? o.xfmt(x) : String(x))));
    S.append(svg("text", { class: "axis-lab", x: 0, y: 9 }, o.ylabel || ""));
    o.series.forEach((s) => {
      let d = "", pen = false;
      xs.forEach((x, i) => { const v = s.values[i]; if (v == null || Number.isNaN(v)) { pen = false; return; } d += (pen ? "L" : "M") + X(x).toFixed(1) + " " + Y(v).toFixed(1); pen = true; });
      S.append(svg("path", { d, fill: "none", "stroke-linejoin": "round", "stroke-linecap": "round", style: `stroke:${s.color};stroke-width:${s.width || 2};${s.dash ? "stroke-dasharray:" + s.dash + ";" : ""}` }));
      if (s.dots) xs.forEach((x, i) => { const v = s.values[i]; if (v != null && !Number.isNaN(v)) S.append(svg("circle", { cx: X(x), cy: Y(v), r: 3, style: `fill:${s.color}` })); });
    });
    const guide = svg("line", { y1: T, y2: H - B, class: "guide", style: "display:none" }); S.append(guide);
    const hit = svg("rect", { x: L, y: T, width: W - L - R, height: H - T - B, class: "hit" }); S.append(hit);
    hit.addEventListener("pointermove", (e) => {
      const r = S.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W; let bi = 0, bd = Infinity;
      xs.forEach((x, i) => { const d = Math.abs(X(x) - px); if (d < bd) { bd = d; bi = i; } });
      guide.setAttribute("x1", X(xs[bi])); guide.setAttribute("x2", X(xs[bi])); guide.style.display = "";
      TF.showTip(`<b>${o.xfmt ? o.xfmt(xs[bi]) : xs[bi]}</b>` + o.series.map((s) => `<br><span style="color:${s.color}">&#9632;</span> ${s.label}: <b>${fmt(s.values[bi], 1)}</b>`).join(""), e.clientX, e.clientY);
    });
    hit.addEventListener("pointerleave", () => { guide.style.display = "none"; TF.hideTip(); });
    host.append(S);
  };

  // ---------- weekday x hour heat grid ----------
  C.dowHeat = function (host, grid, o) {
    const flat = grid.flat().filter((v) => v != null), lo = Math.min(...flat), hi = Math.max(...flat);
    const g = el("div", { class: "heat" }); g.append(el("div"));
    for (let h = 0; h < 24; h++) g.append(el("div", { class: "hh" }, h % 3 === 0 ? String(h) : ""));
    TF.DOW.forEach((d, di) => {
      g.append(el("div", { class: "hl" }, d));
      for (let h = 0; h < 24; h++) {
        const v = grid[di][h], b = el("div", { class: "hc static" });
        if (v != null) b.style.background = TF.ramp([TF.cssv("--seq2"), TF.cssv("--seq1"), TF.cssv("--seq0")], (v - lo) / (hi - lo || 1));
        TF.tipOn(b, `<b>${d} ${TF.hh(h)}</b><br>${v == null ? "no data" : v.toFixed(1) + " " + (o.unit || "")}`);
        g.append(b);
      }
    });
    host.append(g);
    host.append(el("div", { class: "scale" }, el("span", {}, lo.toFixed(0) + " " + (o.unit || "")), el("i", { style: `background:linear-gradient(90deg,${TF.cssv("--seq2")},${TF.cssv("--seq1")},${TF.cssv("--seq0")})` }), el("span", {}, hi.toFixed(0) + " " + (o.unit || ""))));
  };

  // ---------- box plot ----------
  C.box = function (host, o) {
    const W = o.W || 700, H = o.H || 300, L = 46, R = 10, T = 12, B = 30, n = o.stats.length, lo = 0, hi = o.ymax || 130;
    const Y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B), gw = (W - L - R) / n, bw = Math.min(46, gw * 0.5);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": o.aria || "box plot of speed by sensor" });
    ticks(lo, hi, 5).forEach((v) => { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, String(v))); });
    S.append(svg("text", { class: "axis-lab", x: 0, y: 9 }, "km/h"));
    o.stats.forEach((s, i) => {
      const cx = L + gw * i + gw / 2, col = "var(--c-voting_ensemble)";
      S.append(svg("line", { x1: cx, x2: cx, y1: Y(s.wl), y2: Y(s.wh), style: "stroke:var(--muted);stroke-width:1.5" }));
      [s.wl, s.wh].forEach((v) => S.append(svg("line", { x1: cx - bw / 4, x2: cx + bw / 4, y1: Y(v), y2: Y(v), style: "stroke:var(--muted);stroke-width:1.5" })));
      S.append(svg("rect", { x: cx - bw / 2, y: Y(s.q3), width: bw, height: Math.max(1, Y(s.q1) - Y(s.q3)), rx: 3, style: `fill:${col};fill-opacity:.35;stroke:${col};stroke-width:1.5` }));
      S.append(svg("line", { x1: cx - bw / 2, x2: cx + bw / 2, y1: Y(s.med), y2: Y(s.med), style: "stroke:var(--ink);stroke-width:2.5" }));
      S.append(svg("circle", { cx, cy: Y(s.min), r: 3, style: "fill:var(--muted)" }));
      S.append(svg("text", { class: "axis-lab", x: cx, y: H - 10, "text-anchor": "middle" }, s.seg));
      const hit = svg("rect", { x: L + gw * i, y: T, width: gw, height: H - T - B, class: "hit" }); S.append(hit);
      TF.tipOn(hit, `<b>Sensor ${s.seg}</b><br>median <b>${s.med}</b> km/h<br>middle half ${s.q1} to ${s.q3}<br>whiskers ${s.wl} to ${s.wh}<br>lowest ${s.min}, ${TF.comma(s.nout)} outside whiskers`);
    });
    S.append(svg("line", { class: "axis-line", x1: L, x2: W - R, y1: Y(0), y2: Y(0) }));
    host.append(S);
  };

  // ---------- share-missing table (sensor x month) ----------
  C.missTable = function (host, months, segs, vals) {
    const max = Math.max(...vals.flat(), 1e-9), t = el("table", { class: "numeric" });
    t.append(el("thead", {}, el("tr", {}, el("th", {}, "Sensor"), months.map((m) => el("th", {}, m)))));
    t.append(el("tbody", {}, segs.map((s, i) => el("tr", {}, el("td", {}, s), vals[i].map((v) => {
      const td = el("td", {}, v === 0 ? "0" : (v * 100).toFixed(2) + "%");
      if (v > 0) td.style.background = `color-mix(in srgb, var(--accent) ${Math.round(18 + 50 * (v / max))}%, transparent)`;
      return td;
    })))));
    host.append(el("div", { class: "tablewrap" }, t));
  };

  // ---------- daily share series ----------
  C.dayBars = function (host, days, vals) {
    const W = 700, H = 220, L = 46, R = 10, T = 12, B = 30, max = Math.max(...vals, 0.01) * 1.15, tk = ticks(0, max, 4), top = tk[tk.length - 1];
    const X = (i) => L + (i / (days.length - 1)) * (W - L - R), Y = (v) => T + (1 - v / top) * (H - T - B);
    const S = svg("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Share of segments missing per day" });
    tk.forEach((v) => { S.append(svg("line", { class: "grid-line", x1: L, x2: W - R, y1: Y(v), y2: Y(v) })); S.append(svg("text", { class: "axis-lab", x: L - 8, y: Y(v) + 4, "text-anchor": "end" }, (v * 100).toFixed(v < 0.1 ? 1 : 0) + "%")); });
    days.forEach((d, i) => { if (d.endsWith("-01")) S.append(svg("text", { class: "axis-lab", x: X(i), y: H - 10, "text-anchor": "middle" }, d.slice(0, 7))); });
    vals.forEach((v, i) => { if (v > 0) S.append(svg("rect", { x: X(i) - 1.5, y: Y(v), width: 3, height: Y(0) - Y(v), style: "fill:var(--accent)" })); });
    S.append(svg("line", { class: "axis-line", x1: L, x2: W - R, y1: Y(0), y2: Y(0) }));
    const hit = svg("rect", { x: L, y: T, width: W - L - R, height: H - T - B, class: "hit" }); S.append(hit);
    hit.addEventListener("pointermove", (e) => { const r = S.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W, i = Math.max(0, Math.min(days.length - 1, Math.round(((px - L) / (W - L - R)) * (days.length - 1)))); TF.showTip(`<b>${days[i]}</b><br>${(vals[i] * 100).toFixed(2)}% of segment-hours missing`, e.clientX, e.clientY); });
    hit.addEventListener("pointerleave", TF.hideTip);
    host.append(S);
  };
})();
