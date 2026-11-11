// HUD, minimap, prompts, banners, memory cards, toasts, travel menu.
import * as THREE from "three";
import { D, clamp } from "./util.js";

const $ = (s) => document.querySelector(s);
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function maskWords(target, text) {
  target.textContent = "";
  text.split(" ").forEach((w, i) => {
    const o = el("span", "w"), s = el("span", null, w);
    o.style.setProperty("--i", i); o.appendChild(s); target.append(o, " ");
  });
}
const fmt = (v, p, n) => `${Math.abs(v).toFixed(4)}° ${v >= 0 ? p : n}`;

export function createUI() {
  const cache = {};
  const set = (id, v) => { if (cache[id] !== v) { cache[id] = v; const e = document.getElementById(id); if (e) e.textContent = v; } };

  /* ---------- minimap ---------- */
  const mini = $("#minimap"), mctx = mini.getContext("2d"), big = $("#bigmap"), bctx = big.getContext("2d");
  let base = null, mapHalf = 800, mapRef = null;
  const bases = new Map();
  function setMap(hf, colors, places) {
    mapRef = { hf, places };
    mapHalf = hf.half - 62;
    if (bases.has(hf)) { base = bases.get(hf); return; }
    const { N, H, WM, map } = hf, V = mapHalf, ice = map.water.ice;
    const waterCol = ice ? [214, 228, 241] : [74, 140, 190];
    // land raster with hillshade, one pixel per height sample
    const small = document.createElement("canvas");
    small.width = small.height = N;
    const sg = small.getContext("2d"), img = sg.createImageData(N, N), paper = [239, 233, 218];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = j * N + i, o = k * 4;
      const hx = H[j * N + Math.max(0, i - 1)] - H[j * N + Math.min(N - 1, i + 1)], hz = H[Math.max(0, j - 1) * N + i] - H[Math.min(N - 1, j + 1) * N + i];
      const sh = clamp(1 + (hx + hz) * 0.06, 0.72, 1.22);
      let c = [0, 1, 2].map((q) => Math.pow(colors[k * 3 + q], 1 / 2.2) * 255);
      c = c.map((v, q) => (v * 0.78 + paper[q] * 0.22) * sh);
      if (WM[k] > 0.5) c = waterCol;
      img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    const S = 1024, cv = document.createElement("canvas");
    cv.width = cv.height = S;
    const g = cv.getContext("2d"), f = S / (2 * V), P = (x, z) => [(x + V) * f, (z + V) * f];
    const off = ((hf.half - V) / (2 * hf.half)) * N, span = (V / hf.half) * N;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = "high";
    g.drawImage(small, off, off, span, span, 0, 0, S, S);
    const line = (pts, w, col) => {
      g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); });
      g.lineWidth = w; g.strokeStyle = col; g.lineCap = g.lineJoin = "round"; g.stroke();
    };
    const wc = `rgb(${waterCol.join(",")})`;
    for (const r of map.water.rivers) { line(r.pts, (r.width + 3) * f, "rgba(255,255,255,0.35)"); line(r.pts, r.width * f, wc); }
    for (const l of map.water.lakes) {
      const [a, b] = P(l.c[0], l.c[1]);
      g.beginPath(); g.ellipse(a, b, l.rx * f, l.rz * f, l.rot, 0, 7); g.fillStyle = wc; g.fill();
      g.lineWidth = 1.5; g.strokeStyle = "rgba(255,255,255,0.35)"; g.stroke();
    }
    if (map.grid) {
      const gr = map.grid, [x0, z0] = P(gr.x0, gr.z0), [x1, z1] = P(gr.x1, gr.z1);
      g.fillStyle = "rgba(205,196,180,0.55)"; g.fillRect(x0, z0, x1 - x0, z1 - z0);
      for (let x = gr.x0; x <= gr.x1 + 0.1; x += gr.step) { line([[x, gr.z0], [x, gr.z1]], (gr.w + 2) * f, "rgba(70,60,45,0.45)"); line([[x, gr.z0], [x, gr.z1]], gr.w * f, "#f7f2e6"); }
      for (let z = gr.z0; z <= gr.z1 + 0.1; z += gr.step) { line([[gr.x0, z], [gr.x1, z]], (gr.w + 2) * f, "rgba(70,60,45,0.45)"); line([[gr.x0, z], [gr.x1, z]], gr.w * f, "#f7f2e6"); }
    }
    for (const r of map.roads) line(r.pts, (r.w + 3) * f, "rgba(70,60,45,0.5)");
    for (const r of map.roads) line(r.pts, r.w * f, r.kind === "highway" ? "#ffd98a" : r.kind === "dirt" ? "#d9c49a" : "#f7f2e6");
    const vg = g.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.75);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(10,16,30,0.35)");
    g.fillStyle = vg; g.fillRect(0, 0, S, S);
    base = cv;
    bases.set(hf, cv);
  }
  const toMap = (x, z, S) => [((x + mapHalf) / (mapHalf * 2)) * S, ((z + mapHalf) / (mapHalf * 2)) * S];

  /* ---------- big map picking ---------- */
  let hover = null, onWarp = null;
  function pickAt(e) {
    const r = big.getBoundingClientRect(), S = big.width;
    const mx = ((e.clientX - r.left) / r.width) * S, my = ((e.clientY - r.top) / r.height) * S;
    let best = null, bd = 16;
    for (const p of mapRef?.places || []) {
      if (p.decor) continue;
      const [x, y] = toMap(p.pos.x, p.pos.z, S), d = Math.hypot(x - mx, y - my);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return { x: best.pos.x, z: best.pos.z, label: best.data?.title || "Airport", place: best };
    return { x: (mx / S) * mapHalf * 2 - mapHalf, z: (my / S) * mapHalf * 2 - mapHalf, label: null };
  }
  big.addEventListener("pointermove", (e) => { hover = pickAt(e); });
  big.addEventListener("pointerleave", () => { hover = null; });
  big.addEventListener("click", (e) => { const p = pickAt(e); if (p && onWarp) onWarp(p); });

  // Sidebar: districts of the current country, plus flights abroad.
  function setTravel(country, here, abroad, warp, fly) {
    onWarp = warp;
    $(".mv-country").textContent = country.toUpperCase();
    const fill = (box, items, pick) => {
      box.textContent = "";
      for (const it of items) {
        const b = el("button");
        if (it.zone) b.dataset.zone = it.zone;
        const chip = el("span", it.zone ? "chip" : "chip cc");
        chip.appendChild(el("b", null, it.zone ? String(it.age) : it.map.toUpperCase()));
        chip.appendChild(el("i", null, it.zone ? "AGE" : it.years || ""));
        b.appendChild(chip);
        const tx = el("span", "tx");
        tx.appendChild(el("b", null, it.label));
        tx.appendChild(el("small", null, it.sub));
        b.appendChild(tx);
        b.appendChild(el("span", "go", it.zone ? "GO →" : "FLY ✈"));
        b.addEventListener("click", () => pick(it));
        box.appendChild(b);
      }
    };
    const tabs = document.querySelectorAll(".mv-tabs button");
    tabs.forEach((t) => (t.onclick = () => {
      tabs.forEach((o) => { o.classList.toggle("on", o === t); o.setAttribute("aria-selected", String(o === t)); });
      $(".mv-here").hidden = t.dataset.tab !== "here";
      $(".mv-abroad").hidden = t.dataset.tab !== "abroad";
    }));
    tabs[0].click();
    fill($(".mv-here"), here, warp);
    fill($(".mv-abroad"), abroad, fly);
  }
  function markHere(zoneId) {
    for (const b of document.querySelectorAll(".mv-here button")) {
      const on = b.dataset.zone === zoneId;
      b.classList.toggle("here", on);
      b.querySelector(".go").textContent = on ? "HERE" : "GO →";
    }
  }

  function drawMini(px, pz, heading, camYaw, vehicles, collect) {
    if (!base) return;
    const W = mini.width, R = W / 2, zoom = 2.6;
    mctx.clearRect(0, 0, W, W);
    mctx.save();
    mctx.beginPath(); mctx.arc(R, R, R - 2, 0, 7); mctx.clip();
    mctx.fillStyle = "#0b1220"; mctx.fillRect(0, 0, W, W);
    mctx.translate(R, R);
    mctx.rotate(Math.PI + camYaw);
    const [bx, bz] = toMap(px, pz, base.width), sc = (base.width / (mapHalf * 2)) * zoom;
    const k = 1.5 * ((2 * mapHalf) / base.width) * (W / 170);
    mctx.scale(k, k);
    mctx.drawImage(base, -bx, -bz);
    const dot = (x, z, col, r) => { const [mx, mz] = toMap(x, z, base.width); mctx.fillStyle = col; mctx.beginPath(); mctx.arc(mx - bx, mz - bz, r / k, 0, 7); mctx.fill(); };
    for (const v of vehicles) dot(v.pos.x, v.pos.z, "#e9ecef", 3);
    for (const c of collect) if (!c.taken) dot(c.g.position.x, c.g.position.z, "#ffd166", 3.5);
    for (const p of mapRef.places) if (!p.decor) dot(p.pos.x, p.pos.z, p.travel ? "#ffd166" : p.visited ? "#7c8ba1" : "#5fe0ff", 5);
    mctx.restore();
    mctx.save();
    mctx.translate(R, R);
    mctx.rotate(camYaw - heading);
    mctx.fillStyle = "#fff"; mctx.strokeStyle = "#0b1220"; mctx.lineWidth = 2;
    mctx.beginPath(); mctx.moveTo(0, -9); mctx.lineTo(6.5, 7); mctx.lineTo(0, 3.5); mctx.lineTo(-6.5, 7); mctx.closePath(); mctx.stroke(); mctx.fill();
    mctx.restore();
    mctx.fillStyle = "#fff"; mctx.font = "600 11px 'JetBrains Mono'"; mctx.textAlign = "center";
    const na = Math.PI + camYaw;
    mctx.fillText("N", R + Math.sin(-na) * (R - 12) * -1, R - Math.cos(na) * (R - 12) + 4);
    void sc;
  }

  function drawBig(px, pz, heading, zones, t = 0) {
    if (!base) return;
    const S = big.width;
    bctx.clearRect(0, 0, S, S);
    bctx.save();
    bctx.beginPath(); bctx.roundRect(0, 0, S, S, 14); bctx.clip();
    bctx.drawImage(base, 0, 0, S, S);
    bctx.textAlign = "center"; bctx.textBaseline = "middle";
    for (const z of zones) {
      if (z.umbrella) continue;
      const [x, y] = toMap(z.c[0], z.c[1], S), r = (z.r / (mapHalf * 2)) * S;
      bctx.setLineDash([4, 5]); bctx.lineWidth = 1.2; bctx.strokeStyle = "rgba(255,255,255,0.55)";
      bctx.beginPath(); bctx.arc(x, y, r, 0, 7); bctx.stroke(); bctx.setLineDash([]);
    }
    for (const p of mapRef.places) {
      if (p.decor) continue;
      const [x, y] = toMap(p.pos.x, p.pos.z, S), c = p.travel ? "#ffd166" : "#5fe0ff";
      bctx.fillStyle = "rgba(8,12,22,0.8)"; bctx.beginPath(); bctx.arc(x, y, 6.5, 0, 7); bctx.fill();
      bctx.fillStyle = p.visited ? "#9aa6b8" : c; bctx.beginPath(); bctx.arc(x, y, 4.2, 0, 7); bctx.fill();
    }
    const placed = [], hit = (x, y, w) => placed.some((r) => Math.abs(r[0] - x) < (r[2] + w) / 2 + 4 && Math.abs(r[1] - y) < 24);
    for (const z of zones) {
      if (z.umbrella) continue;
      const [x, y] = toMap(z.c[0], z.c[1], S), name = z.name.split(",")[0].split(" · ").pop();
      bctx.font = "600 12px 'Space Grotesk'";
      const w = bctx.measureText(name).width, bw = w + 34, rr = (z.r / (mapHalf * 2)) * S, above = y - rr - 4;
      let ly = above < 16 ? y + rr + 4 : above, lx = clamp(x, bw / 2 + 4, S - bw / 2 - 4);
      if (hit(lx, ly, bw)) ly = above < 16 ? above : y + rr + 4;
      if (hit(lx, ly, bw)) ly += 26;
      placed.push([lx, ly, bw]);
      bctx.fillStyle = "rgba(8,12,22,0.82)"; bctx.beginPath(); bctx.roundRect(lx - bw / 2, ly - 11, bw, 22, 11); bctx.fill();
      bctx.fillStyle = "#5fe0ff"; bctx.beginPath(); bctx.arc(lx - bw / 2 + 11, ly, 8, 0, 7); bctx.fill();
      bctx.fillStyle = "#04121f"; bctx.font = "700 10px 'JetBrains Mono'"; bctx.fillText(String(z.age), lx - bw / 2 + 11, ly + 0.5);
      bctx.fillStyle = "#fff"; bctx.font = "600 12px 'Space Grotesk'"; bctx.fillText(name, lx + 10, ly + 0.5);
    }
    const [x, y] = toMap(px, pz, S), pulse = (t * 0.8) % 1;
    bctx.strokeStyle = `rgba(255,92,122,${1 - pulse})`; bctx.lineWidth = 2;
    bctx.beginPath(); bctx.arc(x, y, 8 + pulse * 18, 0, 7); bctx.stroke();
    bctx.save(); bctx.translate(x, y); bctx.rotate(-heading + Math.PI);
    bctx.fillStyle = "#ff5c7a"; bctx.strokeStyle = "#fff"; bctx.lineWidth = 2;
    bctx.beginPath(); bctx.moveTo(0, -11); bctx.lineTo(8, 9); bctx.lineTo(0, 4); bctx.lineTo(-8, 9); bctx.closePath(); bctx.stroke(); bctx.fill();
    bctx.restore();
    if (hover) {
      const [hx, hy] = toMap(hover.x, hover.z, S);
      bctx.strokeStyle = "#fff"; bctx.lineWidth = 2;
      bctx.beginPath(); bctx.arc(hx, hy, hover.label ? 10 : 7, 0, 7); bctx.stroke();
      const txt = hover.label ? `Go to ${hover.label}` : "Go here";
      bctx.font = "600 13px 'Space Grotesk'";
      const w = bctx.measureText(txt).width + 18, tx = clamp(hx, w / 2 + 4, S - w / 2 - 4), ty = hy > 40 ? hy - 22 : hy + 26;
      bctx.fillStyle = "#ff5c7a"; bctx.beginPath(); bctx.roundRect(tx - w / 2, ty - 12, w, 24, 12); bctx.fill();
      bctx.fillStyle = "#fff"; bctx.fillText(txt, tx, ty + 0.5);
    }
    bctx.restore();
  }

  /* ---------- HUD ---------- */
  function hud({ lat, lon, zone, mapName, sats, fix }) {
    set("lat", fmt(lat, "N", "S"));
    set("lon", fmt(lon, "E", "W"));
    set("sats", String(sats));
    set("fix", fix);
    set("zone-name", zone ? zone.name : mapName);
    set("zone-chapter", zone ? `${zone.chapter} · age ${zone.age}` : "Open country");
  }

  let promptKey = "";
  function prompt(text, key = "E") {
    const p = $("#prompt");
    const k = text ? key + text : "";
    if (k === promptKey) return;
    promptKey = k;
    p.classList.toggle("on", !!text);
    if (text) { p.querySelector("kbd").textContent = key; p.querySelector("span").textContent = text; }
  }

  let bannerT = 0;
  function banner(top, title, meta) {
    const b = $("#banner");
    clearTimeout(bannerT);
    b.className = "";
    b.querySelector(".b-idx").textContent = top;
    maskWords(b.querySelector(".b-place"), title);
    b.querySelector(".b-meta").textContent = meta;
    requestAnimationFrame(() => requestAnimationFrame(() => b.classList.add("in")));
    bannerT = setTimeout(() => { b.classList.remove("in"); b.classList.add("out"); }, 3600);
  }

  /* ---------- memory card ---------- */
  const card = $("#card");
  function openCard(p) {
    const d = p.data;
    card.innerHTML = "";
    card.appendChild(el("div", "card-meta", d.years || ""));
    const h = el("h2"); maskWords(h, d.title); card.appendChild(h);
    let k = 0;
    const fade = (n) => { n.classList.add("fadeup"); n.style.setProperty("--i", k++); card.appendChild(n); };
    if (d.role) fade(el("div", "role", d.where ? `${d.role} · ${d.where}` : d.role));
    fade(el("p", null, d.text));
    if (d.bullets) { const ul = el("ul"); d.bullets.forEach((b) => ul.appendChild(el("li", null, b))); fade(ul); }
    if (d.skills) { const s = el("div", "skills"); d.skills.forEach((x) => s.appendChild(el("span", null, x))); fade(s); }
    if (d.links) {
      const l = el("div", "links"), c = D.contact;
      for (const [label, href, ghost] of [["Email", "mailto:" + c.email], ["GitHub", c.github, 1], ["LinkedIn", c.linkedin, 1]]) {
        const a = el("a", ghost ? "btn ghost" : "btn", label); a.href = href;
        if (ghost) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
        l.appendChild(a);
      }
      fade(l);
    }
    const close = el("button", "card-close", "Close ✕");
    close.addEventListener("click", closeCard);
    card.appendChild(close);
    card.classList.remove("in");
    card.classList.add("open");
    requestAnimationFrame(() => requestAnimationFrame(() => card.classList.add("in")));
  }
  function closeCard() { card.classList.remove("in", "open"); }
  const cardOpen = () => card.classList.contains("open");

  /* ---------- toasts ---------- */
  function toast(a, n) {
    const t = el("div", "toast");
    t.appendChild(el("div", "gem", "◆"));
    const b = el("div");
    b.appendChild(el("small", null, `ACHIEVEMENT ${n}/${D.achievements.length}`));
    b.appendChild(el("strong", null, a.title));
    b.appendChild(el("span", null, a.text));
    t.appendChild(b);
    $("#toasts").appendChild(t);
    setTimeout(() => t.classList.add("out"), 3200);
    setTimeout(() => t.remove(), 3700);
    const tr = $("#trophies");
    tr.querySelector("b").textContent = n;
    tr.classList.remove("bump"); void tr.offsetWidth; tr.classList.add("bump");
  }

  /* ---------- labels ---------- */
  const labelsEl = $("#labels"), v3 = new THREE.Vector3();
  let labels = [];
  function setLabels(places) {
    labelsEl.textContent = "";
    labels = places.filter((p) => !p.decor).map((p) => {
      const n = el("div", "lbl");
      n.appendChild(el("b", null, p.data.title));
      n.appendChild(el("i"));
      labelsEl.appendChild(n);
      return { p, n };
    });
  }
  function updateLabels(camera, focus) {
    const W = innerWidth, H = innerHeight;
    for (const { p, n } of labels) {
      const d = p.pos.distanceTo(focus);
      if (d > 70) { if (n.style.opacity !== "0") n.style.opacity = 0; continue; }
      v3.copy(p.anchor).project(camera);
      if (v3.z > 1) { n.style.opacity = 0; continue; }
      n.style.transform = `translate(${((v3.x + 1) / 2) * W}px, ${((1 - v3.y) / 2) * H}px) translate(-50%, -100%)`;
      n.style.opacity = String(clamp((70 - d) / 30, 0, 1));
    }
  }

  function speedo(kmh) {
    const s = $("#speedo");
    s.classList.toggle("on", kmh !== null);
    if (kmh !== null) set("kmh", String(Math.round(kmh)));
  }

  function travelMenu(options, onPick) {
    const m = $("#travel"), list = m.querySelector(".opts");
    list.textContent = "";
    for (const o of options) {
      const b = el("button", "btn ghost", o.label);
      b.addEventListener("click", () => { m.classList.remove("on"); onPick(o); });
      list.appendChild(b);
    }
    m.classList.add("on");
    m.querySelector(".cancel").onclick = () => { m.classList.remove("on"); onPick(null); };
  }

  function caption(text) {
    const c = $("#caption");
    if (c.dataset.t === text) return;
    c.dataset.t = text;
    c.classList.remove("in");
    if (!text) { c.textContent = ""; return; }
    maskWords(c, text);
    requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add("in")));
  }

  function pop(text, pos, camera) {
    v3.copy(pos).project(camera);
    if (v3.z > 1) return;
    const n = el("div", "pop", text);
    n.style.left = ((v3.x + 1) / 2) * innerWidth + "px";
    n.style.top = ((1 - v3.y) / 2) * innerHeight + "px";
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 1400);
  }
  function bonks(n) {
    const b = $("#bonks");
    b.hidden = false;
    b.querySelector("b").textContent = n;
    b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }

  return { setMap, drawMini, drawBig, setTravel, markHere, hud, prompt, banner, openCard, closeCard, cardOpen, toast, setLabels, updateLabels, speedo, travelMenu, caption, pop, bonks };
}
