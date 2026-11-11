// Landing screen: dotted globe with the life route, decoding title, and route chips that light up in turn.
import { createGlobe, GLOBE_COLORS, PLACES as P } from "./globe.js";

const $ = (s) => document.querySelector(s);
document.documentElement.classList.add("js");
const cv = $("#cv");
cv.close();
$(".cv-open").addEventListener("click", () => { if (!cv.open) cv.showModal(); });
$("#cv-close").addEventListener("click", () => cv.close());
const canvas = $("#hero-globe");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const routes = [[P.kachua, P.dhaka], [P.dhaka, P.turku], [P.turku, P.laquila], [P.laquila, P.tampere]];
const globe = createGlobe(canvas, {
  ox: 0.5, oy: 0.5, scale: 0.4, lon: innerWidth < 760 ? 64 : 52, lat: 32, spin: reduced ? 0 : 5, interactive: true, lock: P.kachua, routes,
  marks: [
    { at: P.kachua, label: "Kachua · 1999", hi: true },
    { at: P.dhaka, label: "Dhaka · 2015", left: true },
    { at: P.turku, label: "Turku · 2024", left: true },
    { at: P.laquila, label: "L'Aquila · 2025" },
    { at: P.tampere, label: "Tampere · now" },
  ],
});
globe.start();
addEventListener("pointermove", (e) => globe.setMouse((e.clientX / innerWidth) * 2 - 1));

// Colour themes: page colours live in CSS ([data-theme] on #start); the globe gets matching canvas colours.
const THEMES = {
  galaxy: {
    swatch: "radial-gradient(circle at 30% 30%, #f472d0, #5b3aaa 55%, #0e8bd3)",
    globe: { starTints: ["#ffffff", "#ffd6f5", "#b9c6ff", "#ffe9b0", "#c7f9ff"], atmo: "167,139,250", atmoA: 0.36, body: ["#2b1756", "#07041a"], rim: "rgba(244,114,208,0.45)", dot: "221,190,255", orbit: "rgba(167,139,250,0.16)", sat: "#fde7ff", signal: "94,234,212", route: "249,199,79", mark: "#5eead4", ring: "94,234,212", markHi: "#f472d0", label: "rgba(12,6,30,0.72)", labelInk: "#f7f0ff", galaxy: ["#ffe9c4", "#f472d0", "#a78bfa", "#7dd3fc"] },
  },
  signal: {
    swatch: "linear-gradient(135deg, #000 30%, #39ff88 30%, #39ff88 70%, #ffb000 70%)",
    globe: { star: "#39ff88", atmo: "57,255,136", atmoA: 0.22, body: ["#06240f", "#000000"], rim: "rgba(57,255,136,0.45)", dot: "57,255,136", orbit: "rgba(57,255,136,0.14)", sat: "#b9ffd6", signal: "255,176,0", route: "255,176,0", mark: "#39ff88", ring: "57,255,136", markHi: "#ffb000", label: "rgba(0,10,4,0.75)", labelInk: "#b9ffd6" },
  },
  paper: {
    swatch: "linear-gradient(135deg, #f3efe6 50%, #1d2a44 50%)",
    globe: { star: "#c9bfa9", atmo: "29,42,68", atmoA: 0.08, body: ["#fffdf8", "#e4dccb"], rim: "rgba(29,42,68,0.35)", dot: "29,42,68", orbit: "rgba(29,42,68,0.14)", sat: "#1d2a44", signal: "200,85,61", route: "200,85,61", mark: "#1d2a44", ring: "29,42,68", markHi: "#c8553d", label: "rgba(255,253,248,0.9)", labelInk: "#1d2a44", plane: "#c8553d" },
  },
  dusk: {
    swatch: "linear-gradient(135deg, #ffb35c, #ff6b4a, #1f8a5b)",
    globe: { star: "#ffe3c4", atmo: "255,150,90", atmoA: 0.28, body: ["#3d2117", "#0e0806"], rim: "rgba(255,179,92,0.4)", dot: "255,179,92", orbit: "rgba(255,200,150,0.12)", sat: "#fff1dc", signal: "46,196,120", route: "255,107,74", mark: "#ffb35c", ring: "255,179,92", markHi: "#ff6b4a", label: "rgba(20,10,6,0.72)", labelInk: "#fff1dc" },
  },
  aurora: {
    swatch: "linear-gradient(135deg, #7cf5c8, #8b7bff, #ff7ab6)",
    globe: { star: "#d9ccff", atmo: "124,245,200", atmoA: 0.28, body: ["#132c48", "#04070f"], rim: "rgba(139,123,255,0.5)", dot: "124,245,200", orbit: "rgba(185,170,255,0.14)", sat: "#f2eaff", signal: "139,123,255", route: "255,122,182", mark: "#7cf5c8", ring: "124,245,200", markHi: "#ff7ab6", label: "rgba(6,8,22,0.7)", labelInk: "#f2fff9" },
  },
  night: { swatch: "linear-gradient(135deg, #5fe0ff, #ffd166)", globe: {} },
};
const start = $("#start"), params = new URLSearchParams(location.search);
function applyTheme(name) {
  if (!THEMES[name]) name = "signal";
  start.dataset.theme = name;
  globe.set({ colors: { ...GLOBE_COLORS, ...THEMES[name].globe } });
  document.querySelectorAll(".themes button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.theme === name)));
}
if (params.has("theme") || params.has("themes")) {
  const box = $(".themes");
  box.hidden = false;
  for (const [name, t] of Object.entries(THEMES)) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.theme = name; b.title = name; b.setAttribute("aria-label", `${name} theme`);
    b.style.background = t.swatch;
    b.addEventListener("click", () => {
      applyTheme(name);
      params.set("theme", name);
      history.replaceState(null, "", `${location.pathname}?${params}`);
    });
    box.appendChild(b);
  }
}
applyTheme(params.get("theme") || "signal");

// Live telemetry in the corner: a slot-machine reel of countries, uptime since Aug 1999, Tampere clock.
const COUNTRIES = ["Bangladesh", "India", "Finland", "Sweden", "Norway", "Latvia", "Germany", "Italy", "San Marino", "Albania"];
const timers = [];
let spinReel = () => {};
{
  $("#st-count").textContent = COUNTRIES.length;
  $(".reel").parentElement.setAttribute("aria-label", COUNTRIES.join(", "));
  const track = $(".reel-track"), N = COUNTRIES.length;
  for (let k = 0; k < 3; k++) for (const c of COUNTRIES) { const s = document.createElement("span"); s.textContent = c; track.appendChild(s); }
  const items = [...track.children];
  let idx = 0;
  const go = (i, ms, ease) => {
    track.style.transition = ms ? `transform ${ms}ms ${ease}` : "none";
    track.style.transform = `translateY(${-i * 1.15}em)`;
    items.forEach((s, j) => s.classList.toggle("hit", j === i));
    idx = i;
  };
  go(0, 0);
  // spin through two full rounds and settle, then click over one country at a time
  spinReel = () => {
    go(2 * N, reduced ? 0 : 2400, "cubic-bezier(0.1, 0.75, 0.15, 1)");
    setTimeout(() => timers.push(setInterval(() => {
      if (idx >= 3 * N - 1) { go(idx - N, 0); track.getBoundingClientRect(); }
      go(idx + 1, 560, "cubic-bezier(0.34, 1.56, 0.64, 1)");
    }, 2200)), 2600);
  };

  const birth = Date.UTC(1999, 7, 15), up = $("#st-uptime");
  timers.push(setInterval(() => { up.innerHTML = `${((Date.now() - birth) / 31556952000).toFixed(7)}<small>yrs</small>`; }, 80));

  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZoneName: "short" }), seen = $("#st-seen");
  const clock = () => {
    const p = Object.fromEntries(fmt.formatToParts(new Date()).map((x) => [x.type, x.value]));
    seen.innerHTML = `${p.hour}:${p.minute}:${p.second}<small>${p.timeZoneName}</small>`;
  };
  clock();
  timers.push(setInterval(clock, 1000));
}

const chips = [...document.querySelectorAll(".route li")];
let step = 0;
const tick = () => {
  chips.forEach((c, i) => c.classList.toggle("on", i === step));
  globe.set({ active: step - 1 });
  step = (step + 1) % chips.length;
};
tick();
const timer = setInterval(tick, 2200);

// Decode the name from random glyphs (on load, and again on hover/tap).
const h1 = $("#start h1"), name = h1.textContent;
let decoding = false;
function decode() {
  if (reduced || decoding) return;
  decoding = true;
  h1.classList.remove("decoding"); void h1.offsetWidth; h1.classList.add("decoding");
  const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+<>/";
  let f = 0;
  const run = () => {
    f++;
    h1.textContent = [...name].map((ch, i) => (ch === " " || f > 8 + i * 4 ? ch : glyphs[Math.floor(Math.random() * glyphs.length)])).join("");
    if (f < 8 + name.length * 4) requestAnimationFrame(run);
    else { h1.textContent = name; decoding = false; }
  };
  run();
}
h1.addEventListener("pointerenter", decode);
h1.addEventListener("click", decode);

// Intro: an incoming transmission types out, the identity decodes, its trace appears, then it asks a question.
const BOOT = [
  [["\u25b8 ", "dim"], ["incoming transmission"], ["  \u00b7  ", "dim"], ["4 sats locked", "ok"]],
  [["\u25b8 ", "dim"], ["origin   "], ["23.35\u00b0N 90.90\u00b0E", "hl"], ["  \u00b7  Kachua, Chandpur  \u00b7  1999", "dim"]],
  [["\u25b8 ", "dim"], ["payload  "], ["1 identity  \u00b7  27 years  \u00b7  3 countries"]],
];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// main.js waits on this before building the world, so the typing never stalls
let typed;
window.heroTyped = new Promise((r) => (typed = r));
async function type(el, text, ms) {
  if (reduced) { el.textContent += text; return; }
  for (const ch of text) { el.textContent += ch; await wait(ch === " " ? ms / 3 : ms); }
}
async function intro() {
  const boot = $(".boot"), q = $(".ask .q"), question = q.textContent, reveals = [...document.querySelectorAll("#start .reveal")];
  q.textContent = "";
  for (const line of BOOT) {
    const row = document.createElement("span");
    boot.appendChild(row);
    row.classList.add("cur");
    for (const [text, cls] of line) {
      const seg = document.createElement("span");
      if (cls) seg.className = cls;
      row.appendChild(seg);
      await type(seg, text, 13);
    }
    row.classList.remove("cur");
    if (!reduced) await wait(150);
  }
  h1.classList.add("in");
  decode();
  await wait(reduced ? 0 : 650);
  $(".route").classList.add("in");
  await wait(reduced ? 0 : 450);
  q.classList.add("cur");
  $(".ask").classList.add("on");
  await type(q, question, 38);
  await wait(reduced ? 0 : 200);
  for (const el of reveals) el.classList.add("in");
  typed();
  await wait(reduced ? 0 : 500);
  for (const el of document.querySelectorAll(".stats > div")) {
    el.classList.add("in");
    if (!reduced) await wait(160);
  }
  spinReel();
}
intro();

// Answer the question from the keyboard: Y / Enter starts, N opens the CV.
addEventListener("keydown", (e) => {
  if (start.classList.contains("gone") || cv.open || e.repeat || e.target.closest?.("input, button")) return;
  const k = e.key.toLowerCase();
  if ((k === "y" || k === "enter") && start.classList.contains("ready")) $("#btn-start").click();
  else if (k === "n") cv.showModal();
});

$("#btn-start").addEventListener("click", () => setTimeout(() => { globe.stop(); clearInterval(timer); timers.forEach(clearInterval); }, 900));
