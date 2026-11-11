// Dotted Earth on a 2D canvas: land dots sampled from the day texture, great-circle routes, satellites and a flying plane.
const RAD = Math.PI / 180;
export const PLACES = {
  kachua: [23.35, 90.9], dhaka: [23.81, 90.41], turku: [60.45, 22.27], laquila: [42.35, 13.4], tampere: [61.5, 23.76],
};

const vec = (lat, lon) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
function slerp(a, b, t) {
  const om = Math.acos(Math.min(1, Math.max(-1, dot(a, b))));
  if (om < 1e-4) return a.slice();
  const s = Math.sin(om), ka = Math.sin((1 - t) * om) / s, kb = Math.sin(t * om) / s;
  return [a[0] * ka + b[0] * kb, a[1] * ka + b[1] * kb, a[2] * ka + b[2] * kb];
}
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// rgb triplets are "r,g,b" strings so alpha can vary per draw
export const GLOBE_COLORS = {
  star: "#cfe3ff", atmo: "90,180,255", atmoA: 0.32, body: ["#16305e", "#050b1c"], rim: "rgba(120,200,255,0.35)", dot: "110,215,255",
  orbit: "rgba(150,210,255,0.12)", sat: "#e8f4ff", signal: "81,227,164", route: "255,209,102", mark: "#5fe0ff", ring: "95,224,255",
  markHi: "#ffd166", label: "rgba(4,8,18,0.65)", labelInk: "#eaf2ff", plane: "#ffffff",
};

// Point on the lifted great-circle arc a→b.
function arcPoint(a, b, s) {
  const p = slerp(a, b, s), h = 1 + (0.06 + 0.16 * Math.acos(Math.min(1, dot(a, b))) / Math.PI) * Math.sin(Math.PI * s);
  return [p[0] * h, p[1] * h, p[2] * h];
}

export function createGlobe(canvas, opt = {}) {
  const ctx = canvas.getContext("2d");
  const cfg = { ox: 0.5, oy: 0.5, scale: 0.42, lon: 55, lat: 28, spin: 4, hoverSpin: 28, routes: [], marks: [], lock: null, active: -1, stars: 160, interactive: false, ...opt };
  cfg.colors = { ...GLOBE_COLORS, ...opt.colors };
  const land = [];
  const stars = Array.from({ length: cfg.stars }, () => [Math.random(), Math.random(), Math.random() * 1.2 + 0.3, Math.random() * 6, Math.random()]);
  // distant two-armed spiral galaxy: [x, y, size, colour index], unit radius
  const spiral = Array.from({ length: 2600 }, (_, i) => {
    const r = Math.pow(Math.random(), 0.85), arm = (i % 2) * Math.PI, a = arm + r * 6.2 + (Math.random() - 0.5) * 0.45 * (1.2 - r * 0.6);
    const j = (Math.random() - 0.5) * 0.05;
    const ci = r < 0.14 ? 0 : r < 0.5 ? (Math.random() < 0.6 ? 1 : 2) : (Math.random() < 0.55 ? 2 : 3);
    return [Math.cos(a) * r + j, Math.sin(a) * r + j, Math.random() * 1.1 + 0.35, ci];
  });
  const sats = Array.from({ length: 5 }, (_, i) => {
    const nrm = norm([Math.sin(i * 2.1) * 0.6, 1, Math.cos(i * 1.7) * 0.6]), u = norm(cross(nrm, [1, 0, 0])), v = cross(nrm, u);
    return { u, v, r: 1.32 + (i % 2) * 0.12, speed: 0.12 + i * 0.025, ph: i * 1.3 };
  });
  let W = 0, H = 0, dpr = 1, raf = 0, running = false, mouse = 0, flight = null, t0 = performance.now();
  // spin state (degrees): yaw/pitch offsets, angular velocity, hover and drag
  let yaw = 0, pitch = 0, vel = cfg.spin, hover = false, drag = null, last = performance.now(), disc = [0, 0, 0];
  if (cfg.interactive) {
    const inDisc = (e) => {
      const r = canvas.getBoundingClientRect(), x = (e.clientX - r.left) * dpr, y = (e.clientY - r.top) * dpr;
      return Math.hypot(x - disc[0], y - disc[1]) < disc[2] * 1.05;
    };
    canvas.addEventListener("pointermove", (e) => {
      hover = inDisc(e);
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y, dt = Math.max(1, e.timeStamp - drag.t) / 1000;
        yaw -= dx * 0.4; pitch = Math.max(-35, Math.min(35, pitch + dy * 0.3));
        vel = (-dx * 0.4) / dt;
        drag = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      }
      canvas.style.cursor = drag ? "grabbing" : hover ? "grab" : "";
    });
    canvas.addEventListener("pointerdown", (e) => {
      if (!inDisc(e)) return;
      drag = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    });
    const end = () => { drag = null; };
    canvas.addEventListener("pointerup", end);
    canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", () => { hover = false; });
  }

  const img = new Image();
  img.src = opt.texture || "assets/textures/earth_atmos_2048.jpg";
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = 512; c.height = 256;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, 512, 256);
    const d = g.getImageData(0, 0, 512, 256).data, N = opt.dots || 16000, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = ga * i, x = Math.cos(th) * r, z = Math.sin(th) * r;
      const lat = Math.asin(y), lon = Math.atan2(z, x);
      const u = Math.floor((lon / (2 * Math.PI) + 0.5) * 511), v = Math.floor((0.5 - lat / Math.PI) * 255), k = (v * 512 + u) * 4;
      const R = d[k], G = d[k + 1], B = d[k + 2];
      if (B > R + 12 && B >= G - 4 && R + G + B < 330) continue;
      land.push([x, y, z]);
    }
  };

  function resize() {
    dpr = Math.min(2, devicePixelRatio || 1);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w !== W || h !== H) { W = canvas.width = w; H = canvas.height = h; }
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    resize();
    if (!W || !H) return;
    const t = (now - t0) / 1000, dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // view direction: idle drift, or follow the plane during a flight
    let f, plane = null;
    if (flight) {
      const p = Math.min(1, (now - flight.start) / flight.ms), s = ease(p);
      plane = { s, a: flight.a, b: flight.b };
      f = norm(slerp(flight.a, flight.b, Math.min(1, s * 0.92 + 0.04)));
      f = norm([f[0], f[1] - 0.25, f[2]]);
      if (p >= 1 && !flight.done) { flight.done = true; flight.res(); }
    } else {
      if (!drag) {
        vel += ((hover ? cfg.hoverSpin : cfg.spin) - vel) * Math.min(1, dt * (Math.abs(vel) > cfg.hoverSpin ? 1.2 : 2.5));
        yaw += vel * dt;
        pitch *= 1 - Math.min(1, dt * 0.6);
      }
      f = vec(cfg.lat + pitch + Math.sin(t * 0.05) * 3, cfg.lon + yaw + mouse * 8);
    }
    const e = norm(cross(f, [0, 1, 0])), n = cross(e, f);
    const R = Math.min(W, H) * cfg.scale, cx = W * cfg.ox, cy = H * cfg.oy;
    disc = [cx, cy, R];
    const P = (q) => [cx + dot(q, e) * R, cy - dot(q, n) * R, dot(q, f)];
    const visible = (q) => { const d = dot(q, f); return d > 0 || Math.hypot(dot(q, e), dot(q, n)) > 1; };

    const C = cfg.colors;
    ctx.clearRect(0, 0, W, H);
    for (const [sx, sy, sz, ph, tint] of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + ph));
      ctx.fillStyle = C.starTints ? C.starTints[Math.floor(tint * C.starTints.length)] : C.star;
      ctx.fillRect(sx * W, sy * H, sz * dpr, sz * dpr);
    }
    if (C.galaxy) {
      const gx = W * 0.16, gy = H * 0.13, gr = Math.min(W, H) * 0.15, rot = t * 0.03, cr = Math.cos(rot), sr = Math.sin(rot);
      const core = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr * 0.35);
      core.addColorStop(0, "rgba(255,240,220,0.7)"); core.addColorStop(0.3, "rgba(255,200,230,0.25)"); core.addColorStop(1, "rgba(255,200,230,0)");
      ctx.globalAlpha = 1; ctx.fillStyle = core;
      ctx.beginPath(); ctx.ellipse(gx, gy, gr * 0.35, gr * 0.16, -0.35, 0, 7); ctx.fill();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.38;
      for (const [px, py, ps, ci] of spiral) {
        const x = px * cr - py * sr, y = px * sr + py * cr, tx = x * 0.94 - y * 0.34, ty = (x * 0.34 + y * 0.94) * 0.4;
        ctx.fillStyle = C.galaxy[ci];
        ctx.fillRect(gx + tx * gr, gy + ty * gr, ps * dpr, ps * dpr);
      }
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.globalAlpha = 1;
    // atmosphere and body
    let g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.35);
    g.addColorStop(0, `rgba(${C.atmo},${C.atmoA})`); g.addColorStop(1, `rgba(${C.atmo},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, 7); ctx.fill();
    g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, C.body[0]); g.addColorStop(1, C.body[1]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.strokeStyle = C.rim; ctx.lineWidth = 1 * dpr; ctx.stroke();

    // land dots in a few alpha buckets
    const buckets = [[], [], [], []];
    for (const q of land) {
      const d = dot(q, f);
      if (d <= 0.02) continue;
      buckets[Math.min(3, Math.floor(d * 4))].push(cx + dot(q, e) * R, cy - dot(q, n) * R);
    }
    const ds = Math.max(1.4, R / 230) * (dpr > 1 ? 1 : 1);
    buckets.forEach((b, i) => {
      ctx.fillStyle = `rgba(${C.dot},${0.18 + i * 0.22})`;
      for (let k = 0; k < b.length; k += 2) ctx.fillRect(b[k] - ds / 2, b[k + 1] - ds / 2, ds, ds);
    });

    // satellite orbits, satellites and signal lines to the lock point
    const lockP = cfg.lock ? vec(...cfg.lock) : null;
    for (const s of sats) {
      ctx.beginPath();
      for (let k = 0; k <= 72; k++) {
        const a = (k / 72) * Math.PI * 2, q = [0, 1, 2].map((i) => (s.u[i] * Math.cos(a) + s.v[i] * Math.sin(a)) * s.r);
        const [x, y] = P(q);
        if (!visible(q)) { ctx.moveTo(x, y); continue; }
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.strokeStyle = C.orbit; ctx.lineWidth = dpr; ctx.stroke();
      const a = t * s.speed * 2 + s.ph, q = [0, 1, 2].map((i) => (s.u[i] * Math.cos(a) + s.v[i] * Math.sin(a)) * s.r);
      if (!visible(q)) continue;
      const [x, y] = P(q);
      if (lockP && dot(lockP, f) > 0.1 && dot(norm(q), lockP) > 0.35) {
        const [lx, ly] = P(lockP);
        ctx.setLineDash([3 * dpr, 5 * dpr]); ctx.lineDashOffset = -t * 30;
        ctx.strokeStyle = `rgba(${C.signal},0.55)`; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(lx, ly); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = C.sat;
      ctx.fillRect(x - 3 * dpr, y - 1 * dpr, 6 * dpr, 2 * dpr);
      ctx.fillRect(x - 1 * dpr, y - 2 * dpr, 2 * dpr, 4 * dpr);
    }

    // life routes
    cfg.routes.forEach(([A, B], i) => {
      const a = vec(...A), b = vec(...B), on = i === cfg.active;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= 48; k++) {
        const q = arcPoint(a, b, k / 48);
        if (!visible(q)) { pen = false; continue; }
        const [x, y] = P(q);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      }
      ctx.strokeStyle = `rgba(${C.route},${on ? 0.95 : 0.35})`;
      ctx.lineWidth = (on ? 2.2 : 1.3) * dpr;
      ctx.setLineDash(on ? [] : [4 * dpr, 4 * dpr]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (on) {
        const s = (t * 0.45) % 1, q = arcPoint(a, b, s);
        if (visible(q)) { const [x, y] = P(q); ctx.fillStyle = C.plane; ctx.beginPath(); ctx.arc(x, y, 3 * dpr, 0, 7); ctx.fill(); }
      }
    });

    // place markers
    ctx.font = `600 ${12 * dpr}px "Space Grotesk", sans-serif`;
    ctx.textBaseline = "middle";
    for (const m of cfg.marks) {
      const q = vec(...m.at), d = dot(q, f);
      if (d < 0.08) continue;
      const [x, y] = P(q), pulse = (t * 0.7 + m.at[1] * 0.01) % 1;
      ctx.strokeStyle = `rgba(${C.ring},${(1 - pulse) * 0.8})`; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(x, y, (4 + pulse * 14) * dpr, 0, 7); ctx.stroke();
      ctx.fillStyle = m.hi ? C.markHi : C.mark; ctx.beginPath(); ctx.arc(x, y, 3.5 * dpr, 0, 7); ctx.fill();
      if (m.label) {
        ctx.globalAlpha = Math.min(1, d * 2);
        const lx = x + (m.left ? -10 : 10) * dpr;
        ctx.textAlign = m.left ? "right" : "left";
        ctx.fillStyle = C.label;
        const w = ctx.measureText(m.label).width;
        ctx.fillRect(m.left ? lx - w - 6 * dpr : lx - 6 * dpr, y - 10 * dpr, w + 12 * dpr, 20 * dpr);
        ctx.fillStyle = C.labelInk; ctx.fillText(m.label, lx, y + 0.5);
        ctx.globalAlpha = 1;
      }
    }

    // flying plane with contrail
    if (plane) {
      const { s, a, b } = plane;
      ctx.beginPath();
      let pen = false;
      for (let k = 0; k <= 40; k++) {
        const q = arcPoint(a, b, (k / 40) * s);
        if (!visible(q)) { pen = false; continue; }
        const [x, y] = P(q);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      }
      ctx.strokeStyle = "rgba(255,255,255,0.85)"; ctx.lineWidth = 2 * dpr; ctx.stroke();
      ctx.setLineDash([3 * dpr, 6 * dpr]); ctx.beginPath(); pen = false;
      for (let k = 0; k <= 40; k++) {
        const q = arcPoint(a, b, s + (k / 40) * (1 - s));
        if (!visible(q)) { pen = false; continue; }
        const [x, y] = P(q);
        pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        pen = true;
      }
      ctx.strokeStyle = "rgba(255,209,102,0.6)"; ctx.stroke(); ctx.setLineDash([]);
      for (const end of [a, b]) { const [x, y] = P(end); ctx.fillStyle = "#ffd166"; ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, 7); ctx.fill(); }
      const q = arcPoint(a, b, s), q2 = arcPoint(a, b, Math.min(1, s + 0.01)), [x, y] = P(q), [x2, y2] = P(q2);
      const ang = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, k = 13 * dpr;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.shadowColor = "rgba(255,255,255,0.9)"; ctx.shadowBlur = 14 * dpr;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -k); ctx.lineTo(k * 0.14, -k * 0.55); ctx.lineTo(k * 0.95, k * 0.05); ctx.lineTo(k * 0.95, k * 0.22); ctx.lineTo(k * 0.14, k * 0.02);
      ctx.lineTo(k * 0.12, k * 0.62); ctx.lineTo(k * 0.42, k * 0.82); ctx.lineTo(k * 0.42, k * 0.95); ctx.lineTo(0, k * 0.85);
      ctx.lineTo(-k * 0.42, k * 0.95); ctx.lineTo(-k * 0.42, k * 0.82); ctx.lineTo(-k * 0.12, k * 0.62); ctx.lineTo(-k * 0.14, k * 0.02);
      ctx.lineTo(-k * 0.95, k * 0.22); ctx.lineTo(-k * 0.95, k * 0.05); ctx.lineTo(-k * 0.14, -k * 0.55); ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    set(o) { Object.assign(cfg, o); },
    setMouse(v) { mouse = v; },
    fly(from, to, ms) { return new Promise((res) => { flight = { a: vec(...from), b: vec(...to), start: performance.now(), ms, res }; setTimeout(res, ms + 100); }); },
    clearFlight() { flight = null; },
  };
}
