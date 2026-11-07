// docs/js/story.js: the "report" sections, made touchable (steps, quiz, method cards, leaderboard, sensor map, cases).
(function () {
  "use strict";
  const TF = window.TF, $ = TF.$, $$ = TF.$$, el = TF.el, svg = TF.svg, fmt = TF.fmt;

  // ---------- numbers bound to <span data-bind="m.model.field|decimals|comma"> ----------
  function bindAll() {
    $$("[data-bind]").forEach((n) => {
      const [path, dec, flag] = n.dataset.bind.split("|");
      const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), TF.D);
      if (v === null || v === undefined || Number.isNaN(v)) return;
      n.textContent = typeof v === "string" ? v : (flag === "comma" ? TF.comma(v) : fmt(v, Number(dec ?? 2)));
    });
    $$("[data-count]").forEach((n) => {
      const [path, dec] = n.dataset.count.split("|");
      const v = path.split(".").reduce((o, k) => (o == null ? o : o[k]), TF.D);
      if (typeof v === "number") TF.countUp(n, v, Number(dec ?? 2));
    });
  }

  // ---------- headline, reading notes and conclusion ----------
  function texts() {
    const m = TF.D.m, p = TF.D.p, s = TF.D.s;
    const sel = m.voting_ensemble, how = m.hour_of_week, per = m.persistence, pd = p.hour_of_week;
    if (!sel || !how || !per) return;
    const diff = sel.test_mae - how.test_mae, valDiff = sel.val_mae - how.val_mae;
    const inc0 = pd && pd.ci_low <= 0 && pd.ci_high >= 0;
    $("#headline").textContent = `On the test block (${s.test_start} to ${s.test_end}) the voting ensemble reached a mean absolute error of ${fmt(sel.test_mae, 3)} km/h for speed two hours ahead, against ${fmt(per.test_mae, 3)} for persistence (skill ${fmt(sel.skill, 3)}) and ${fmt(how.test_mae, 3)} for the hour-of-week table.`;
    $("#headline-honest").textContent = `Honest catch: the table is a strong baseline and the trained model does not clearly beat it. It is ${fmt(Math.abs(diff), 3)} km/h ${diff > 0 ? "worse" : "better"} on test and ${fmt(Math.abs(valDiff), 3)} km/h ${valDiff > 0 ? "worse" : "better"} on validation${pd ? "; the test interval for the difference " + (inc0 ? "includes zero" : "excludes zero") : ""}.`;
    const spans = pd ? `; paired difference ${pd.mean_diff >= 0 ? "+" : ""}${fmt(pd.mean_diff, 3)} km/h, 95% interval ${fmt(pd.ci_low, 3)} to ${fmt(pd.ci_high, 3)}${inc0 ? ", which includes zero" : ""}` : "";
    $("#results-read").textContent = `Reading the result: the ensemble is far better than persistence on test (skill ${fmt(sel.skill, 3)}) but ${diff > 0 ? "not better" : "better"} than the hour-of-week table (${fmt(sel.test_mae, 3)} against ${fmt(how.test_mae, 3)} km/h${spans}).`;
    $("#conclusion-dyn").textContent = `Answer: ${diff > 0 ? "no" : "yes, by a small margin"}. The selected voting ensemble reached a test MAE of ${fmt(sel.test_mae, 3)} km/h` + (sel.ci_low == null ? "" : ` (95% interval ${fmt(sel.ci_low, 3)} to ${fmt(sel.ci_high, 3)})`) + `, against ${fmt(how.test_mae, 3)} km/h for the hour-of-week table and ${fmt(per.test_mae, 3)} for persistence. ` + (diff > 0 ? `It beats persistence by a wide margin (skill ${fmt(sel.skill, 3)}) but is ${fmt(diff, 3)} km/h worse than the table on test, and ${fmt(valDiff, 3)} km/h worse on validation. ` : `It improves on the table by ${fmt(-diff, 3)} km/h. `) + "This describes these eight segments and this period only.";
  }

  // ---------- data summary, split ----------
  function splitAndSummary() {
    const s = TF.D.s;
    $("#data-summary").innerHTML = `<dl class="facts"><dt>Dataset</dt><dd>${s.dataset}</dd><dt>Segments</dt><dd>${s.sensors} (${s.segments.join(", ")})</dd><dt>Period</dt><dd>${s.start} to ${s.end}</dd><dt>Hourly rows</dt><dd>${TF.comma(s.rows)}; missing speed ${(s.missing_rate * 100).toFixed(3)}%</dd><dt>Model rows</dt><dd>${TF.comma(s.n_train)} train / ${TF.comma(s.n_val)} validation / ${TF.comma(s.n_test)} test</dd></dl>`;
    const names = { train: "Train", val: "Validation", test: "Test" };
    $("#split-table tbody").innerHTML = ["train", "val", "test"].map((k) => { const b = s.splits[k]; return `<tr><td>${names[k]}</td><td>${b.start.slice(0, 16)}</td><td>${b.end.slice(0, 16)}</td><td>${TF.comma(b.rows)}</td></tr>`; }).join("");
    $$("#split-bar [data-k]").forEach((d) => {
      const b = s.splits[d.dataset.k];
      TF.tipOn(d, `<b>${names[d.dataset.k]}</b><br>${b.start.slice(0, 10)} → ${b.end.slice(0, 10)}<br>${TF.comma(b.rows)} rows`);
    });
  }

  // ---------- preprocessing stepper ----------
  const STEPS = [
    { t: "Clean the readings", d: "Exact zeros are not real speeds, they mean “no reading”, so they become <em>missing</em>. Speeds are converted from mph to km/h.", ex: "0 mph → missing &nbsp;·&nbsp; 62 mph × 1.609344 = 99.8 km/h" },
    { t: "Make it hourly", d: "The twelve 5-minute readings in an hour are averaged. An hour is kept only if at least 9 of the 12 readings exist.", ex: "12 readings → 1 hourly mean (needs ≥ 9)" },
    { t: "Add the neighbours", d: "For each sensor, the 3 nearest sensors (straight-line haversine distance, not road connectivity) are found, and their speed at hour <em>t</em> is averaged into <code>neighbour_speed_t</code>. Jams spread as queues, so neighbours act as an early warning.", ex: "sensor → 3 nearest → mean speed at t" },
    { t: "Build features and the target", d: "Weather and calendar are merged by hour. 16 features are built, all known at hour <em>t</em>. The target is the speed two hours later, used only as a label.", ex: "features at t  →  target = speed at t + 2" },
  ];
  function stepper() {
    const show = (i) => {
      $$("#steps .step").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
      const s = STEPS[i];
      $("#steppanel").innerHTML = `<h3>${s.t}</h3><p>${s.d}</p><div class="from-to">${s.ex}</div>`;
    };
    $("#steps").addEventListener("click", (e) => { const b = e.target.closest(".step"); if (b) show(+b.dataset.i); });
    show(0);
  }

  // ---------- spot-the-leak quiz ----------
  const LEAKS = [
    { t: "Speed on this sensor one hour ago (t − 1)", leak: false, why: "Past data: fine (this is lag_1h)." },
    { t: "Average speed of the 3 nearest sensors at t + 1", leak: true, why: "That is in the future relative to the forecast time." },
    { t: "Rain observed at hour t", leak: false, why: "Observed at t, so it is known when the forecast is made." },
    { t: "Rolling mean of the speed from t − 1 to t + 1", leak: true, why: "The window reaches one hour into the future. The project’s windows end at t." },
    { t: "Rain actually measured at t + 2", leak: true, why: "It is measured at the moment we are trying to predict." },
    { t: "“Is t + 2 a public holiday?”", leak: false, why: "The calendar is known in advance, so this is allowed (is_holiday)." },
  ];
  // ---------- method cards ----------
  function methods() {
    const g = $("#mgrid"), m = TF.D.m;
    TF.ORDER.forEach((id) => {
      const M = TF.MODELS[id], v = m[id] ? m[id].val_mae : null;
      const more = el("div", { class: "more", hidden: true },
        el("div", {}, el("b", {}, "How: "), M.how), el("div", {}, el("b", {}, "Assumes: "), M.assume), el("div", {}, el("b", {}, "Why included: "), M.why),
        el("button", { class: "btn sm", type: "button", style: "margin-top:10px", onclick: (e) => { e.stopPropagation(); TF.focusModel(id, true); } }, "Open in the Lab"));
      const card = el("div", { class: "mcard", role: "button", tabindex: "0", "aria-expanded": "false", style: `--mc: var(--c-${id})` },
        el("span", { class: "tag" }, M.kind), el("h3", {}, M.label), el("p", {}, M.blurb),
        el("div", { class: "meter" }, el("i", { style: `width:${Math.max(8, M.flex * 20)}%` })),
        el("div", { class: "meta" }, el("span", {}, "flexibility"), el("span", {}, v == null ? "" : "val MAE " + fmt(v, 3))), more);
      const toggle = () => { more.hidden = !more.hidden; card.setAttribute("aria-expanded", String(!more.hidden)); };
      card.addEventListener("click", toggle);
      card.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target === card) { e.preventDefault(); toggle(); } });
      g.append(card);
    });
  }

  // ---------- leaderboard ----------
  let lbSeg;
  function leaderboard() {
    const rows = TF.D.metrics;
    lbSeg = TF.seg($("#lb-split"), drawLB);
    drawLB("val");
    const body = $("#metrics-table tbody");
    body.innerHTML = [...rows].sort((a, b) => TF.ORDER.indexOf(a.model) - TF.ORDER.indexOf(b.model)).map((r) => {
      const scored = r.test_mae != null, na = '<td class="muted">n/a</td>';
      return `<tr style="${r.selected ? "background:var(--card2);font-weight:700" : ""}"><td>${TF.label(r.model)}${r.selected ? " (selected)" : ""}</td><td>${fmt(r.val_mae, 3)}</td>${scored ? `<td>${fmt(r.test_mae, 3)}</td><td>${fmt(r.test_rmse, 3)}</td><td>${fmt(r.skill, 3)}</td>` : na + na + na}${r.ci_low == null ? '<td class="muted">–</td>' : `<td>${fmt(r.ci_low, 3)} – ${fmt(r.ci_high, 3)}</td>`}</tr>`;
    }).join("");
  }
  function drawLB(which) {
    const rows = TF.D.metrics.filter((r) => which === "val" ? r.val_mae != null : r.test_mae != null)
      .map((r) => ({ ...r, v: which === "val" ? r.val_mae : r.test_mae })).sort((a, b) => a.v - b.v);
    const max = Math.max(...rows.map((r) => (r.ci_high != null && which === "test" ? r.ci_high : r.v))) * 1.08, box = $("#lb-bars");
    box.innerHTML = "";
    rows.forEach((r, i) => {
      const track = el("div", { class: "track" }, el("div", { class: "fill", style: "width:0" }));
      if (which === "test" && r.ci_low != null) track.append(el("div", { class: "ci", style: `left:${(r.ci_low / max) * 100}%;width:${((r.ci_high - r.ci_low) / max) * 100}%` }));
      const b = el("div", { class: "bar" + (i === 0 ? " win" : "") + (r.selected ? " sel" : ""), style: `--mc: var(--c-${r.model})` },
        el("button", { class: "name", type: "button", title: "Send to the Lab", onclick: () => TF.focusModel(r.model, true) }, el("i"), TF.label(r.model), i === 0 ? el("span", { class: "best" }, "lowest") : null),
        track, el("span", { class: "v" }, fmt(r.v, 3)));
      box.append(b);
      requestAnimationFrame(() => requestAnimationFrame(() => { track.firstChild.style.width = (r.v / max) * 100 + "%"; }));
    });
    const top = rows[0], bestTrained = rows.find((r) => !["persistence", "hour_of_week"].includes(r.model));
    $("#lb-note").textContent = which === "val"
      ? `Validation (used to choose the model): ${TF.label(top.model)} is lowest overall; the best trained model is ${TF.label(bestTrained.model)} (${fmt(bestTrained.v, 3)}). Persistence and the linear models are far behind the tree models.`
      : `Test: only the selected model and the two baselines are scored. The black whisker is the 95% interval for the ensemble (day-block bootstrap). It overlaps the table’s value, so the two cannot be separated with certainty.`;
  }
  // ---------- sensor map ----------
  function sensorMap() {
    const S = TF.D.sensors, map = $("#sensor-map"); if (!S) { map.replaceWith(el("p", { class: "muted" }, "Sensor locations not available.")); return; }
    const lats = S.all.map((r) => r[1]), lons = S.all.map((r) => r[2]);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats), minLon = Math.min(...lons), maxLon = Math.max(...lons), k = Math.cos((37.4 * Math.PI) / 180);
    const pad = 22, sc = Math.min((640 - 2 * pad) / ((maxLon - minLon) * k), (420 - 2 * pad) / (maxLat - minLat));
    const ox = (640 - (maxLon - minLon) * k * sc) / 2, oy = (420 - (maxLat - minLat) * sc) / 2;
    const X = (lon) => ox + (lon - minLon) * k * sc, Y = (lat) => oy + (maxLat - lat) * sc;
    S.all.forEach(([id, lat, lon]) => { if (!S.used.includes(id)) map.append(svg("circle", { class: "dot-all", cx: X(lon), cy: Y(lat), r: 2.4 })); });
    S.used.forEach((id) => {
      const r = S.all.find((x) => x[0] === id), c = svg("circle", { class: "dot", cx: X(r[2]), cy: Y(r[1]), r: 8, tabindex: 0, role: "button", "aria-label": "Sensor " + id, "data-id": id });
      const pick = () => selectSensor(id);
      c.addEventListener("click", pick); c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } });
      TF.tipOn(c, `<b>Sensor ${id}</b><br>${r[1].toFixed(3)}°N, ${Math.abs(r[2]).toFixed(3)}°W`);
      map.append(c);
    });
  }
  function selectSensor(id) {
    $$("#sensor-map .dot").forEach((d) => d.classList.toggle("on", +d.dataset.id === id));
    const box = $("#sensor-info"), P = TF.D.play;
    if (!P) { box.innerHTML = `<h3>Sensor ${id}</h3><p class="muted">Per-sensor scores need docs/data/playground.json (run src/06_export_playground.py).</p>`; return; }
    const B = P.test, si = P.segments.indexOf(String(id)), mask = TF.mask(B, { ...TF.defaultFilter(B), segs: new Set([si]) });
    const rows = ["voting_ensemble", "hour_of_week", "persistence"].map((m) => ({ m, ...TF.score(B, mask, m) })), max = Math.max(...rows.map((r) => r.mae)) * 1.1;
    const best = [...rows].sort((a, b) => a.mae - b.mae)[0], ens = rows[0], how = rows[1], per = rows[2];
    box.innerHTML = `<h3>Sensor ${id} <span class="tag">${ens.n} test hours</span></h3>`;
    const bars = el("div", { class: "bars" });
    rows.forEach((r) => bars.append(el("div", { class: "bar" + (r.m === best.m ? " win" : ""), style: `--mc: var(--c-${r.m});grid-template-columns:110px 1fr 54px` },
      el("span", { class: "name" }, el("i"), TF.label(r.m).replace(" table", "")), el("div", { class: "track" }, el("div", { class: "fill", style: `width:${(r.mae / max) * 100}%` })), el("span", { class: "v" }, fmt(r.mae, 2)))));
    box.append(bars);
    box.append(el("p", { class: "small" }, `Best here: ${TF.label(best.m)}. ` + (ens.mae < how.mae ? `The ensemble beats the table by ${fmt(how.mae - ens.mae, 2)} km/h on this sensor.` : `The table beats the ensemble by ${fmt(ens.mae - how.mae, 2)} km/h on this sensor.`) + (per.mae < ens.mae ? " Persistence also beats the ensemble here: this is the sensor with the frozen feed, where “speed now” is almost always right." : "")));
    box.append(el("button", { class: "btn sm", type: "button", onclick: () => TF.openExplorer({ split: "test", seg: String(id) }) }, "Open this sensor in the explorer"));
  }

  // ---------- failure cases ----------
  const CASE_TXT = {
    1: ["The largest single error", "Speed was normal, then fell to a very low value for about two hours and recovered. No method sees this coming from past speeds, weather or the calendar. Likely a one-off event such as a crash or lane closure. Persistence is also wrong when the drop ends."],
    2: ["A short early-morning dip", "The next largest miss, on another segment and day. Both the model and the weekly table hedge with a partial slowdown, which costs error before and after the real dip. A short incident is the likely reason."],
    3: ["A public holiday", "On a holiday the morning stays at free-flow speed, but both forecasts expect the weekday slowdown. The model has a holiday flag and is closer than the table, yet persistence is best that day because nothing changes. Only one holiday is in the test period."],
    4: ["A frozen sensor feed", "The sensor repeats one value for 12 hours. Errors look small and persistence looks nearly perfect only because the data is frozen. Scores on this segment are flattering and say little about real traffic."],
    5: ["The wettest day", "Rain was a suspect for hard-to-predict traffic. On this day the model does worse than the table on this segment, with a late-afternoon slowdown larger than forecast. Overall, rainy hours are not clearly worse than dry hours; with few wet days, rain cannot be separated from other things that happen on the same days."],
  };
  function cases() {
    const C = TF.D.cases, bar = $("#casebar"), box = $("#casebox");
    if (!C.length) { box.textContent = "No case data."; return; }
    let show = (i) => {
      $$("#casebar button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.i === i)));
      const c = C[i], [title, why] = CASE_TXT[c.case] || ["Case " + c.case, ""];
      box.innerHTML = "";
      const fig = el("figure", {}), body = el("div", { class: "fig-body" }); fig.append(body); box.append(fig);
      if (!TF.caseChart(body, c.segment, String(c.day).slice(0, 10))) body.append(el("img", { src: "img/" + c.image, alt: `Case ${c.case}: ${title}, segment ${c.segment} on ${c.day}`, loading: "lazy" }));
      box.append(el("div", {},
        el("h3", {}, `Case ${c.case}. ${title}`),
        el("p", { class: "mono small" }, `Segment ${c.segment} · ${c.day}`),
        el("p", {}, el("b", {}, "That day’s MAE: "), `ensemble ${fmt(c.day_mae_model)}, table ${fmt(c.day_mae_how)}, persistence ${fmt(c.day_mae_persistence)} km/h.`),
        el("p", {}, el("b", {}, "Worst forecast: "), `made at ${String(c.worst_origin).slice(11, 16)}, predicted ${fmt(c.worst_pred, 1)}, actual ${fmt(c.worst_actual, 1)} (miss ${fmt(c.worst_abs_err, 1)} km/h).`),
        el("p", { class: "muted" }, why),
        el("button", { class: "btn sm primary", type: "button", onclick: () => TF.openExplorer({ split: "test", seg: String(c.segment), date: String(c.day).slice(0, 10), play: true }) }, "Replay this day in the explorer")));
    };
    let cur = 0; const show0 = show; show = (i) => { cur = i; show0(i); }; document.addEventListener("tf-redraw", () => show(cur));
    C.forEach((c, i) => bar.append(el("button", { class: "chip", type: "button", "aria-pressed": "false", "data-i": i, onclick: () => show(i) }, `${c.case} · ${(CASE_TXT[c.case] || [c.slug])[0]}`)));
    show(0);
  }

  // ---------- page chrome: theme, nav, reveal, lightbox, copy ----------
  function chrome() {
    $("#theme-btn").addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next; try { localStorage.setItem("theme", next); } catch (e) { /* private mode */ }
    });
    const links = $$("#nav-links a"), secs = links.map((a) => document.getElementById(a.getAttribute("href").slice(1))).filter(Boolean);
    const onScroll = () => {
      const dh = document.documentElement.scrollHeight - innerHeight;
      $("#progress").style.width = (dh > 0 ? (scrollY / dh) * 100 : 0) + "%";
      let cur = null; secs.forEach((s) => { if (s.getBoundingClientRect().top < 140) cur = s.id; });
      links.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + cur));
      $("#fab").hidden = !!(cur === "lab");
    };
    addEventListener("scroll", onScroll, { passive: true }); onScroll();
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" });
      $$(".reveal").forEach((n) => io.observe(n));
    } else $$(".reveal").forEach((n) => n.classList.add("in"));
    document.addEventListener("click", (e) => {
      const img = e.target.closest("figure img");
      if (img) { const lb = el("div", { class: "lightbox", onclick: () => lb.remove() }, el("img", { src: img.src, alt: img.alt })); document.body.append(lb); }
      const cp = e.target.closest("[data-copy]");
      if (cp) {
        const text = cp.parentElement.querySelector("code").textContent;
        (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => TF.toast("Copied"), () => TF.toast("Select the text and copy"));
      }
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") $$(".lightbox").forEach((n) => n.remove()); });
  }

  TF.initStory = function () {
    bindAll(); texts(); splitAndSummary(); methods(); leaderboard(); sensorMap(); cases();
  };
  TF.initStatic = function () { stepper(); chrome(); };
  TF.selectSensor = selectSensor;
})();
