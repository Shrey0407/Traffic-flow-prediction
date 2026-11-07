// docs/js/hero.js: "Drive the day": animated road + speedometer driven by the real average speed for each hour.
(function () {
  "use strict";
  const TF = window.TF, $ = TF.$;
  const state = { hour: 8, day: "weekday", speed: 100, profile: null };
  let canvas, ctx, W = 0, H = 0, cars = [], dashOff = 0, last = 0, visible = true, playTimer = null;
  const LANES = 3, COLORS = ["#4cc9f0", "#ffd23f", "#ff6b35", "#c084fc", "#2ee6a6", "#ff7aa2", "#eef2ff"];
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  // mean actual speed by target hour for weekdays / weekends (test block, all 8 sensors)
  function buildProfile() {
    const B = TF.D.play && TF.D.play.test; if (!B) return null;
    const sum = { weekday: new Float64Array(24), weekend: new Float64Array(24) }, cnt = { weekday: new Float64Array(24), weekend: new Float64Array(24) };
    for (let i = 0; i < B.n; i++) {
      if (Number.isNaN(B.actual[i])) continue;
      const k = B.dowT[i] < 5 ? "weekday" : "weekend";
      sum[k][B.hourT[i]] += B.actual[i]; cnt[k][B.hourT[i]]++;
    }
    const p = {};
    for (const k of ["weekday", "weekend"]) p[k] = Array.from(sum[k], (s, h) => (cnt[k][h] ? s / cnt[k][h] : NaN));
    return p;
  }

  function speedColor(v) { return v >= 95 ? "#2ee6a6" : v >= 70 ? "#ffb020" : "#ff4d6d"; }

  function update(animateCars) {
    const p = state.profile, v = p ? p[state.day][state.hour] : NaN;
    state.speed = Number.isNaN(v) ? 100 : v;
    $("#drive-hour-label").textContent = TF.hh(state.hour);
    $("#drive-hour").value = state.hour;
    $("#gauge-val").textContent = Number.isNaN(v) ? "–" : v.toFixed(0);
    const frac = Math.max(0, Math.min(1, state.speed / 120));
    $("#gauge-needle").style.transform = "rotate(" + (-90 + 180 * frac) + "deg)";
    const arc = $("#gauge-arc"); arc.style.strokeDashoffset = String(377 * (1 - frac)); arc.setAttribute("stroke", speedColor(state.speed));
    const note = $("#gauge-note");
    if (!p) note.textContent = "needs docs/data/playground.json";
    else {
      const s = state.speed, what = s >= 95 ? "free-flowing" : s >= 70 ? "slowing down" : "congested";
      note.textContent = (state.day === "weekday" ? "weekday" : "weekend") + " " + TF.hh(state.hour) + ": " + what;
    }
    syncCars();
    if (!animateCars || reduce) draw(0);
  }

  function syncCars() {
    const cong = Math.max(0, Math.min(1, (105 - state.speed) / 70)), want = Math.round(10 + cong * 12);
    while (cars.length < want) cars.push({ lane: Math.floor(Math.random() * LANES), x: Math.random() * W, c: COLORS[Math.floor(Math.random() * COLORS.length)], k: 0.85 + Math.random() * 0.3 });
    while (cars.length > want) cars.splice(Math.floor(Math.random() * cars.length), 1);
  }

  function resize() {
    const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cars.forEach((c) => { c.x = Math.min(c.x, W); });
  }

  function draw(dt) {
    const speedPx = state.speed * 1.9;           // pixels per second
    dashOff = (dashOff + speedPx * dt) % 48;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#0a0f1f"; ctx.fillRect(0, 0, W, H);
    const laneH = H / LANES;
    ctx.strokeStyle = "#ffd23f"; ctx.lineWidth = 3; ctx.setLineDash([26, 22]); ctx.lineDashOffset = -dashOff;
    for (let l = 1; l < LANES; l++) { ctx.beginPath(); ctx.moveTo(0, l * laneH); ctx.lineTo(W, l * laneH); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.fillStyle = "#27325c"; ctx.fillRect(0, 0, W, 3); ctx.fillRect(0, H - 3, W, 3);
    cars.forEach((c) => {
      c.x += speedPx * c.k * dt; if (c.x > W + 40) { c.x = -40; c.lane = Math.floor(Math.random() * LANES); }
      const y = c.lane * laneH + laneH / 2 - 9, x = c.x;
      ctx.fillStyle = c.c; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - 30, y, 34, 18, 6) : ctx.rect(x - 30, y, 34, 18); ctx.fill();
      ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(x - 12, y + 3, 10, 12);          // windscreen
      ctx.fillStyle = state.speed < 70 ? "#ff4d6d" : "#fff8c9"; ctx.fillRect(x + 1, y + 3, 3, 4); ctx.fillRect(x + 1, y + 11, 3, 4);
    });
  }

  function loop(t) {
    if (!last) last = t;
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (visible) draw(dt);
    requestAnimationFrame(loop);
  }

  function stopPlay() { clearInterval(playTimer); playTimer = null; $("#drive-play").textContent = "▶ Play a day"; }
  function startPlay() {
    $("#drive-play").textContent = "⏸ Pause";
    playTimer = setInterval(() => { state.hour = (state.hour + 1) % 24; update(true); }, 800);
  }

  TF.initHero = function () {
    canvas = $("#road"); ctx = canvas.getContext("2d");
    state.profile = buildProfile();
    resize(); new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; }).observe(canvas);
    $("#drive-hour").addEventListener("input", (e) => { stopPlay(); state.hour = +e.target.value; update(true); });
    TF.seg($("#drive-day"), (v) => { state.day = v; update(true); });
    $("#drive-play").addEventListener("click", () => (playTimer ? stopPlay() : startPlay()));
    update(true);
    if (!reduce) requestAnimationFrame(loop);
  };
})();
