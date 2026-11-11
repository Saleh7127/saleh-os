// Open-world orchestration: loading, intro, play loop, third-person camera, vehicles, zones, travel.
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { D, U, clamp, lerp, smooth, damp, dampAngle, wrapAngle, hash } from "./util.js";
import { MAPS, TRAVEL } from "./maps.js";
import { createHeightField, createTerrainMesh, createRoads, createWater } from "./terrain.js";
import { createAtmosphere, createGrass, scatterNature, createSnow } from "./nature.js";
import { createColliders } from "./collide.js";
import { createDistricts, createPlaces, createCollectibles } from "./city.js";
import { createVehicle } from "./vehicles.js";
import { createPlayer, outfitFor } from "./player.js";
import { createInput } from "./input.js";
import { createUI } from "./ui.js";
import { createSpace } from "./intro.js";
import { createFriends, bonkLine } from "./npc.js";
import { createGlobe, PLACES } from "./globe.js";

const $ = (s) => document.querySelector(s);
const root = document.documentElement;
root.classList.add("js");
$("#cv").close();
const lowPower = matchMedia("(max-width: 760px)").matches || (navigator.maxTouchPoints > 1 && innerWidth < 1100);
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $("#scene"), antialias: !lowPower, powerPreference: "high-performance" });
} catch (err) {
  root.classList.add("no-webgl");
  $("#cv").show();
  throw err;
}
renderer.setPixelRatio(Math.min(devicePixelRatio, lowPower ? 1.2 : 1.35));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 6000);

let composer = null, renderPass = null, bloom = null;
if (!lowPower) {
  composer = new EffectComposer(renderer);
  renderPass = new RenderPass(new THREE.Scene(), camera);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.35, 0.55, 0.88);
  composer.addPass(renderPass);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
function resize() {
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const ui = createUI();
const input = createInput($("#scene"));
const taken = new Set(), worlds = {};
const setLoading = (t) => ($("#load-text").textContent = t);

async function buildWorld(id) {
  if (worlds[id]) return worlds[id];
  const map = MAPS[id], scene = new THREE.Scene();
  setLoading(`Shaping ${map.name}…`); await nextFrame();
  const hf = createHeightField(map);
  const terrain = createTerrainMesh(hf);
  scene.add(terrain.mesh, createRoads(hf));
  setLoading("Lighting the sky…"); await nextFrame();
  const atmo = createAtmosphere(scene, renderer, map, lowPower);
  const water = createWater(hf);
  if (water) scene.add(water);
  setLoading("Raising buildings…"); await nextFrame();
  const colliders = createColliders();
  const { places, footprints } = createPlaces(scene, hf, colliders);
  createDistricts(scene, hf, colliders, footprints);
  setLoading("Planting trees…"); await nextFrame();
  const tiles = scatterNature(scene, hf, colliders, footprints);
  const grass = createGrass(hf, terrain.heightTex, map.grass, lowPower);
  if (grass) scene.add(grass.mesh);
  const snow = map.env.snow ? createSnow(scene) : null;
  const collect = createCollectibles(scene, hf, places, taken);
  const vehicles = map.vehicles.map((v) => { const o = createVehicle(v.type, v.pos[0], v.pos[1], v.rot, hf); scene.add(o.root); return o; });
  (map.traffic || []).forEach((tr, i) => {
    const pts = map.roads[tr.road]?.pts;
    if (!pts) return;
    const k = Math.min(pts.length - 2, Math.floor(((i * 0.618) % 1) * (pts.length - 1))), [ax, az] = pts[k], [bx, bz] = pts[k + 1];
    const o = createVehicle(tr.type, lerp(ax, bx, 0.5), lerp(az, bz, 0.5), Math.atan2(bx - ax, bz - az), hf);
    o.ai = { pts, wp: k + 1, dir: 1, stuck: 0, cruise: { car: 13, bike: 12, cng: 8 }[tr.type], lane: id === "bd" ? 1 : -1 };
    scene.add(o.root);
    vehicles.push(o);
  });
  const friends = id === "bd" ? createFriends(scene, player.gltf, { places, hf }) : null;
  const w = { id, map, scene, hf, terrain, atmo, water, colliders, places, grass, snow, collect, vehicles, tiles, friends };
  setLoading("Compiling shaders…"); await nextFrame();
  await renderer.compileAsync(scene, camera);
  worlds[id] = w;
  return w;
}

/* ------------------------------------------------------------ state */
let W = null, player = null, driving = null, mode = "start", zoneId = null, chapterN = 0;
let camYaw = 0, camPitch = 0.22, camDist = 4.4, lastLook = -10, shake = 0, introT = 0, bigMap = false, collected = 0, landT = 0, popped = false, bonks = 0;
const camPos = new THREE.Vector3(), camAim = new THREE.Vector3(), focus = new THREE.Vector3(), tmp = new THREE.Vector3();
const space = createSpace();
const mouse = { x: 0, y: 0 };
addEventListener("pointermove", (e) => { mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1; });
const draw = (scene) => { if (composer) { renderPass.scene = scene; composer.render(); } else renderer.render(scene, camera); };

// landing pod + sparkle burst
const pod = new THREE.Mesh(new THREE.SphereGeometry(0.9, 48, 32), new THREE.ShaderMaterial({
  uniforms: { uTime: U.time },
  vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV;
    void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.2); vec3 iri = 0.5 + 0.5 * cos(6.2831 * (f + vec3(0.0, 0.33, 0.67) + uTime * 0.05));
      vec3 c = mix(vec3(1.0, 0.62, 0.74), iri, 0.35) * (f * 1.8 + 0.05); gl_FragColor = vec4(c, f * 0.9 + 0.05);
      #include <colorspace_fragment>
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
}));
const podLight = new THREE.PointLight("#ff9ab0", 6, 8, 1.5);
pod.add(podLight);
const SPN = 300, spPos = new Float32Array(SPN * 3), spVel = new Float32Array(SPN * 3), spLife = new Float32Array(SPN);
const spGeo = new THREE.BufferGeometry();
spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
spGeo.setAttribute("life", new THREE.BufferAttribute(spLife, 1));
const sparks = new THREE.Points(spGeo, new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: `attribute float life; varying float vL; void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = (2.0 + 9.0 * life) * (40.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vL; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)) * vL; if (a < 0.01) discard; gl_FragColor = vec4(mix(vec3(1.0, 0.55, 0.7), vec3(1.0, 0.95, 0.8), vL) * a, a);
    #include <colorspace_fragment>
  }`,
}));
sparks.frustumCulled = false;
function burst(p, n) {
  for (let i = 0; i < n; i++) {
    const d = new THREE.Vector3().randomDirection();
    spPos.set([p.x, p.y, p.z], i * 3);
    spVel.set([d.x * 5, Math.abs(d.y) * 6 + 1, d.z * 5], i * 3);
    spLife[i] = 1;
  }
}
function updateSparks(dt) {
  for (let i = 0; i < SPN; i++) {
    if (spLife[i] <= 0) continue;
    spLife[i] = Math.max(0, spLife[i] - dt * 0.8);
    spVel[i * 3 + 1] -= 6 * dt;
    for (let k = 0; k < 3; k++) spPos[i * 3 + k] += spVel[i * 3 + k] * dt;
  }
  spGeo.attributes.position.needsUpdate = spGeo.attributes.life.needsUpdate = true;
}

function enterWorld(w, x, z, heading) {
  W = w;
  if (renderPass) renderPass.scene = w.scene;
  renderer.toneMappingExposure = w.atmo.exposure;
  camera.far = w.atmo.far; camera.updateProjectionMatrix();
  w.scene.add(player.root);
  const y = w.hf.heightAt(x, z);
  player.teleport(x, y, z, heading);
  camYaw = heading; camPitch = 0.22;
  camPos.set(x - Math.sin(heading) * 5, y + 3, z - Math.cos(heading) * 5);
  camAim.set(x, y + 1.2, z);
  zoneId = null;
  const zn0 = w.hf.zoneAt(x, z);
  player.setAge(zn0 ? zn0.age : 26, true);
  player.setOutfit(outfitFor(zn0, w.id));
  ui.setMap(w.hf, w.terrain.colors, w.places);
  ui.setLabels(w.places);
  const here = w.map.zones.filter((z) => !z.umbrella).sort((a, b) => a.age - b.age).map((z) => ({ zone: z.id, label: z.name, sub: z.chapter, age: z.age, x: z.c[0], z: z.c[1] }));
  ui.setTravel(w.map.name, here, TRAVEL.filter((o) => o.map !== w.id), warp, (o) => { closeMap(); travel(o); });
}

// Road-following traffic: steer to the next waypoint (offset into a lane), yield to the player, turn around at road ends.
function aiDrive(v, dt) {
  const a = v.ai, n = a.pts.length, p = a.pts[a.wp], q = a.pts[clamp(a.wp - a.dir, 0, n - 1)];
  let dx = p[0] - q[0], dz = p[1] - q[1];
  const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
  const tx = p[0] + dz * 2.2 * a.lane, tz = p[1] - dx * 2.2 * a.lane;
  const ox = tx - v.pos.x, oz = tz - v.pos.z;
  if (Math.hypot(ox, oz) < 7) { a.wp += a.dir; if (a.wp >= n || a.wp < 0) { a.dir *= -1; a.wp += 2 * a.dir; } }
  const diff = wrapAngle(Math.atan2(ox, oz) - v.heading), sh = Math.sin(v.heading), ch = Math.cos(v.heading);
  const px = player.st.pos.x - v.pos.x, pz = player.st.pos.z - v.pos.z, ahead = px * sh + pz * ch, side = Math.abs(px * ch - pz * sh);
  const block = !driving && ahead > 0 && ahead < 10 && side < 2.4;
  const back = a.back > 0;
  const thr = back ? -1 : block ? -1 : Math.abs(diff) > 0.5 ? (v.speed > 5 ? -0.3 : 0.5) : v.speed < a.cruise ? 0.7 : 0;
  const lx = v.pos.x, lz = v.pos.z;
  v.update(dt, { x: clamp((back ? diff : -diff) * 2.2, -1, 1), y: thr, brake: false }, W.colliders);
  const moved = Math.hypot(v.pos.x - lx, v.pos.z - lz) / Math.max(dt, 1e-4);
  if (back) a.back -= dt;
  a.stuck = moved < 0.8 && !block && !back ? a.stuck + dt : 0;
  if (a.stuck > 2) { a.dir *= -1; a.wp = clamp(a.wp + a.dir, 0, n - 1); a.stuck = 0; a.back = 1.6; }
}

// A walkable spot near (x, z): outside buildings, on land, inside the map.
function safeSpot(x, z, r0) {
  const { hf, colliders } = W, lim = hf.half - 100, wl = hf.map.water.level;
  const ok = (px, pz) => !colliders.inside(px, pz) && !colliders.inside(px + 0.8, pz) && !colliders.inside(px - 0.8, pz) && !colliders.inside(px, pz + 0.8) && !colliders.inside(px, pz - 0.8) && (hf.map.water.ice || hf.heightAt(px, pz) > wl + 0.2);
  for (let r = r0; r < 80; r += 3) for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + r, px = clamp(x + Math.sin(a) * r, -lim, lim), pz = clamp(z + Math.cos(a) * r, -lim, lim);
    if (ok(px, pz)) return [px, pz];
    if (r === 0) break;
  }
  return [x, z];
}

// Fast travel inside the current country: quick fade, drop next to the spot, face it.
async function warp(dest) {
  if (mode !== "play") return;
  closeMap();
  mode = "travel";
  const veil = $("#veil");
  await veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320, easing: "ease-in", fill: "forwards" }).finished;
  if (driving) { driving = null; ui.speedo(null); }
  let tx = dest.x, tz = dest.z, near = !!dest.place;
  if (dest.zone) {
    const zn = W.map.zones.find((q) => q.id === dest.zone);
    const pl = W.places.filter((p) => !p.decor && Math.hypot(p.pos.x - tx, p.pos.z - tz) < zn.r).sort((a, b) => Math.hypot(a.pos.x - tx, a.pos.z - tz) - Math.hypot(b.pos.x - tx, b.pos.z - tz))[0];
    if (pl) { tx = pl.pos.x; tz = pl.pos.z; near = true; }
  }
  const [x, z] = safeSpot(tx, tz, near ? 7 : 0);
  enterWorld(W, x, z, near ? Math.atan2(tx - x, tz - z) : camYaw);
  player.root.scale.setScalar(player.st.scale);
  await veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650, easing: "ease-out", fill: "forwards" }).finished;
  veil.getAnimations().forEach((a) => a.cancel());
  veil.style.opacity = "0";
  mode = "play";
}

const CAPTIONS = [[0.035, ""], [0.3, "In the dark, a tiny receiver powers on."], [0.55, "Acquiring satellites… four locked. Position fixed."], [0.86, "Re-entry. Destination: a village in Kachua, Chandpur."], [1.01, "Touchdown — 1999."]];
function startPlay() {
  root.classList.remove("intro");
  root.classList.add("playing");
  ui.caption("");
  camera.fov = 60; camera.updateProjectionMatrix();
  const s = W.map.spawn;
  enterWorld(W, s.pos[0], s.pos[1], s.rot);
  mode = "landing"; landT = 0; popped = false;
  player.root.visible = false;
  W.scene.add(pod, sparks);
  pod.visible = true;
}

// The pod drops out of the sky with a crane shot, pops, and hands over to the player camera.
function runLanding(dt, t) {
  landT += dt;
  const s = W.map.spawn, [px, pz] = s.pos, gy = W.hf.heightAt(px, pz);
  const e = 1 - Math.pow(1 - smooth(0, 2.8, landT), 3);
  pod.position.set(px, gy + 0.95 + (1 - e) * 45, pz);
  pod.scale.setScalar(popped ? Math.max(0.001, 1 - (landT - 2.8) * 5) : 1 + Math.sin(t * 9) * 0.015);
  podLight.intensity = popped ? 0 : 6;
  const off = (1 - e) * 1.4, a = s.rot + off;
  const d = lerp(22, 5.2, e), h = lerp(34, 2.4, e);
  camera.position.set(px - Math.sin(a) * d, gy + h, pz - Math.cos(a) * d);
  camera.lookAt(pod.position.x, Math.max(gy + 1.1, pod.position.y - 2 * (1 - e)), pod.position.z);
  $("#veil").style.opacity = String(1 - smooth(0, 1.3, landT));
  focus.set(px, gy, pz);
  if (!popped && landT >= 2.8) {
    popped = true;
    burst(pod.position, SPN);
    player.root.visible = true;
    player.st.pop = 0;
    ui.banner("1999 · SIGNAL ACQUIRED", "Hello, Earth", "Born in Kachua, Chandpur — walk, run, ride. Grow up as you explore.");
  }
  player.update({ dt, t, input: { move: { x: 0, y: 0 } }, yaw: s.rot, hf: W.hf, colliders: W.colliders });
  updateSparks(dt);
  W.atmo.update(focus); W.grass?.update(focus);
  for (const p of W.places) if (!p.pos || p.pos.distanceTo(focus) < 260) p.tick(t);
  W.friends?.update(dt, t, camera.position, []);
  if (landT >= 3.5) {
    mode = "play";
    pod.visible = false;
    camPos.copy(camera.position);
    camAim.set(px, gy + 1.2, pz);
    camYaw = s.rot;
    $("#hint").classList.add("on");
    setTimeout(() => $("#hint").classList.remove("on"), 9000);
  }
  draw(W.scene);
}

/* ------------------------------------------------------------ boot */
const bootT = performance.now(), mark = (l) => location.search.includes("debug") && console.info(`[boot] ${l} ${Math.round(performance.now() - bootT)}ms`);
(async () => {
  try {
    setLoading("Loading character…");
    player = await createPlayer();
    mark("player");
    await Promise.race([window.heroTyped, new Promise((r) => setTimeout(r, 7000))]);
    await buildWorld("bd");
    // Render each scene once behind the start screen so shaders are compiled before play.
    setLoading("Warming up…"); await nextFrame();
    mark("world");
    W = worlds.bd;
    const s = W.map.spawn;
    enterWorld(W, s.pos[0], s.pos[1], s.rot);
    W.scene.add(pod, sparks);
    camera.position.set(s.pos[0], W.hf.heightAt(s.pos[0], s.pos[1]) + 3, s.pos[1] + 5);
    camera.lookAt(s.pos[0], W.hf.heightAt(s.pos[0], s.pos[1]) + 1, s.pos[1]);
    await renderer.compileAsync(W.scene, camera);
    space.update(0.3, 1, 0.016, camera, mouse, true);
    await renderer.compileAsync(space.scene, camera);
    mark("compile");
    draw(W.scene);
    for (const p of [0.3, 0.75]) { space.update(p, 1, 0.016, camera, mouse, true); draw(space.scene); }
    mark("draw");
    await nextFrame();
    $("#start").classList.add("ready");
    setLoading("Ready");
  } catch (err) {
    setLoading("Something went wrong — use the CV button instead.");
    console.error(err);
  }
})();
$("#btn-start").addEventListener("click", () => {
  if (!W && !worlds.bd) return;
  W = worlds.bd;
  $("#start").classList.add("gone");
  if (reduced || $("#skip-intro").checked) { startPlay(); return; }
  mode = "intro"; introT = 0;
  root.classList.add("intro");
});
$("#btn-skip").addEventListener("click", () => { if (mode === "intro") introT = 99; });
$("#btn-cv").addEventListener("click", () => { document.exitPointerLock?.(); if (!$("#cv").open) $("#cv").showModal(); });
$("#cv-close").addEventListener("click", () => $("#cv").close());
$("#btn-help").addEventListener("click", () => $("#help").classList.toggle("on"));
$(".help-close").addEventListener("click", () => $("#help").classList.remove("on"));
$("#help").addEventListener("click", (e) => { if (e.target.id === "help") e.currentTarget.classList.remove("on"); });
$("#btn-map").addEventListener("click", () => toggleMap());
$(".mv-close").addEventListener("click", () => closeMap());
$("#btn-fly").addEventListener("click", () => { if (mode !== "play") return; closeMap(); document.exitPointerLock?.(); ui.travelMenu(TRAVEL.filter((o) => o.map !== W.id), travel); });
$(".skip").addEventListener("click", (e) => { e.preventDefault(); if (!$("#cv").open) $("#cv").showModal(); });
function toggleMap() { bigMap = !bigMap; $("#mapview").classList.toggle("on", bigMap); if (bigMap) { document.exitPointerLock?.(); ui.markHere(zoneId); } }
function closeMap() { if (bigMap) toggleMap(); }

const CITY = { bd: ["Dhaka", PLACES.dhaka], fi: ["Tampere", PLACES.tampere], it: ["L'Aquila", PLACES.laquila] };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let flyGlobe = null, flying = false, flyStopT = 0;
// Flight between countries: a plane arcs over the dotted globe while the destination is built.
async function travel(dest) {
  if (!dest) return;
  mode = "travel";
  const [fromName, a] = CITY[W.id], [toName, b] = CITY[dest.map];
  const tv = $("#travelfx");
  tv.querySelector(".from").textContent = fromName;
  tv.querySelector(".to").textContent = toName;
  tv.querySelector("small").textContent = "BOARDING";
  flyGlobe ??= createGlobe($("#fly-globe"), { scale: 0.58, oy: 0.66, stars: 240, spin: 0, dots: 20000 });
  flyGlobe.clearFlight();
  clearTimeout(flyStopT);
  flyGlobe.set({ lat: a[0] - 14, lon: a[1], marks: [{ at: a, label: fromName, hi: true }, { at: b, label: toName, hi: true, left: true }] });
  flyGlobe.start();
  tv.classList.add("on");
  if (driving) { driving = null; ui.speedo(null); }
  await wait(350);
  flying = true;
  tv.querySelector("small").textContent = "NOW FLYING";
  const [w] = await Promise.all([buildWorld(dest.map), flyGlobe.fly(a, b, 2600)]);
  const p = w.places.find((q) => q.id === dest.place);
  enterWorld(w, p.pos.x + 4, p.pos.z + 4, Math.PI * 0.75);
  flying = false;
  tv.classList.remove("on");
  flyStopT = setTimeout(() => flyGlobe.stop(), 500);
  mode = "play";
}

/* ------------------------------------------------------------ loop */
let last = performance.now(), frameN = 0, quality = 3, fpsAcc = 0, fpsN = 0, fpsT = 0;
// Step quality down while the frame rate stays low.
function adaptQuality(dt) {
  fpsAcc += dt; fpsN++;
  if (fpsAcc < 2) return;
  const fps = fpsN / fpsAcc;
  fpsAcc = 0; fpsN = 0; fpsT++;
  if (fps > 38 || quality === 0 || fpsT < 3) return;
  quality--;
  if (quality === 2) { renderer.setPixelRatio(1); resize(); }
  if (quality === 1) { for (const w of Object.values(worlds)) if (w.grass) w.grass.mesh.geometry.instanceCount = Math.floor(w.grass.mesh.geometry.instanceCount * 0.5); }
  if (quality === 0) { composer = null; renderer.setPixelRatio(0.85); resize(); for (const w of Object.values(worlds)) w.atmo.sun.shadow.mapSize.set(1024, 1024), w.atmo.sun.shadow.map?.dispose(), (w.atmo.sun.shadow.map = null); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;
  U.time.value = t;
  frameN++;

  if (mode === "intro") {
    introT += dt;
    const p = Math.min(1, introT / 17);
    space.update(p, t, dt, camera, mouse, reduced);
    ui.caption(CAPTIONS.find(([e]) => p < e)?.[1] ?? "");
    $("#veil").style.opacity = String(smooth(0.86, 0.97, p));
    renderer.toneMappingExposure = 1;
    draw(space.scene);
    if (p >= 1) startPlay();
    return;
  }
  if (mode === "landing") { renderer.toneMappingExposure = W.atmo.exposure; runLanding(dt, t); return; }
  if (!W || !player || mode === "start" || flying) return;
  if (mode === "play") adaptQuality(dt);

  input.poll();
  const look = input.consumeLook();
  if (input.map) toggleMap();
  if (input.help) $("#help").classList.toggle("on");
  if (input.escape) { ui.closeCard(); if (bigMap) toggleMap(); $("#help").classList.remove("on"); }
  const paused = mode !== "play" || ui.cardOpen() || bigMap || $("#travel").classList.contains("on");
  if (Math.abs(look.x) + Math.abs(look.y) > 0 && !paused) {
    camYaw -= look.x * 0.0026;
    camPitch = clamp(camPitch + look.y * 0.0022, -0.25, 1.15);
    lastLook = t;
  }
  camDist = clamp(camDist + look.zoom * 0.5, 2.6, 9);

  const { hf, colliders } = W;
  const idle = { move: { x: 0, y: 0 }, jump: false, sprint: false, walk: false };
  let speed = 0, prompted = false;
  const hits = [];
  if (!driving) {
    speed = player.update({ dt, t, input: paused ? idle : input, yaw: camYaw, hf, colliders });
    focus.copy(player.st.pos);
    const fx = Math.sin(player.st.heading), fz = Math.cos(player.st.heading), ps = player.st.scale;
    if (input.punch && !paused) hits.push({ x: focus.x, z: focus.z, fx, fz, reach: 1.3 + ps * 0.6, power: 5, cone: true });
    if (speed > 9) hits.push({ x: focus.x, z: focus.z, reach: 0.75, power: 4 });
    if (speed > 0.6 && t - lastLook > 1.4 && input.move.y >= 0) camYaw = dampAngle(camYaw, player.st.heading, 1.1, dt);
    if (!paused) {
      const v = W.vehicles.find((q) => q.pos.distanceTo(focus) < q.spec.radius + 1.6);
      const pl = !v && W.places.find((q) => !q.decor && Math.hypot(q.pos.x - focus.x, q.pos.z - focus.z) < 4);
      if (v) {
        ui.prompt(`Ride the ${v.spec.label}`); prompted = true;
        if (input.act) { driving = v; v.ai = null; }
      } else if (pl) {
        ui.prompt(pl.travel ? "Board a flight" : `Open memory · ${pl.data.title}`); prompted = true;
        if (input.act) {
          if (pl.travel) { document.exitPointerLock?.(); ui.travelMenu(TRAVEL.filter((o) => o.map !== W.id), travel); }
          else { pl.visited = true; document.exitPointerLock?.(); ui.openCard(pl); }
        }
      }
    }
    ui.speedo(null);
  } else {
    const vin = paused ? { x: 0, y: 0, brake: true } : { x: input.move.x, y: input.move.y, brake: input.brake };
    speed = driving.update(dt, vin, colliders);
    player.ride(driving, dt, t);
    focus.copy(driving.pos);
    shake = Math.max(shake, driving.shake);
    const dir = driving.speed < -1 ? driving.heading + Math.PI : driving.heading;
    if (t - lastLook > 0.9 && Math.abs(driving.speed) > 1) camYaw = dampAngle(camYaw, dir, 2.6, dt);
    ui.speedo(Math.abs(driving.speed) * 3.6);
    if (Math.abs(driving.speed) > 3) hits.push({ x: driving.pos.x, z: driving.pos.z, reach: driving.spec.radius + 0.4, power: Math.min(14, Math.abs(driving.speed) * 0.5) });
    if (!paused) {
      ui.prompt("Get off", "E"); prompted = true;
      if (input.act && Math.abs(driving.speed) < 6) {
        const ex = driving.exitPoint();
        player.teleport(ex.x, hf.heightAt(ex.x, ex.z), ex.z, driving.heading);
        player.root.scale.setScalar(player.st.scale);
        driving = null;
      }
    }
  }
  if (!prompted) ui.prompt("");

  // zones: ageing + chapter banners
  const zn = hf.zoneAt(focus.x, focus.z);
  if (zn && zn.id !== zoneId) {
    const first = zoneId === null && W.id === "bd" && zn.id === "kachua";
    zoneId = zn.id;
    player.setAge(zn.age, first);
    player.setOutfit(outfitFor(zn, W.id));
    if (!first || chapterN > 0) ui.banner(`CHAPTER ${String(++chapterN).padStart(2, "0")} · AGE ${zn.age}`, zn.name, zn.chapter);
    else chapterN = 1;
  }
  if (!zn && !zoneId) player.setOutfit(outfitFor(null, W.id));

  // collectibles
  for (const c of W.collect) {
    if (c.taken) {
      if (c.anim < 1) { c.anim = Math.min(1, c.anim + dt * 1.6); c.g.scale.setScalar(1 + c.anim); c.g.position.y += dt * 3; c.sp.material.opacity = 1 - c.anim; if (c.anim >= 1) c.g.visible = false; }
      continue;
    }
    c.icon.rotation.y = t * 1.5 + c.i;
    c.g.position.y = c.base + Math.sin(t * 2 + c.i) * 0.2;
    if (c.g.position.distanceTo(tmp.copy(focus).setY(focus.y + 1)) < 2.4) {
      c.taken = true; taken.add(c.i); collected = taken.size;
      ui.toast(c.a, collected);
    }
  }

  // camera rig
  const s = player.st.scale;
  const spec = driving?.spec;
  const dist = spec ? spec.cam[0] + Math.abs(driving.speed) * 0.05 : camDist * (0.6 + 0.4 * s);
  const ty = focus.y + (spec ? spec.cam[1] : 1.45 * s + 0.1);
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  const bx = -Math.sin(camYaw) * cp, bz = -Math.cos(camYaw) * cp;
  const side = spec ? 0 : 0.5 * s;
  const rx = -Math.cos(camYaw), rz = Math.sin(camYaw);
  let d = dist;
  for (let k = 0.6; k <= dist; k += 0.4) {
    const x = focus.x + bx * k + rx * side, z = focus.z + bz * k + rz * side, y = ty + sp * k;
    const c = colliders.inside(x, z);
    if ((c && y < c.h) || y < hf.heightAt(x, z) + 0.3) { d = Math.max(0.8, k - 0.4); break; }
  }
  const want = tmp.set(focus.x + bx * d + rx * side, ty + sp * d, focus.z + bz * d + rz * side);
  want.y = Math.max(want.y, hf.heightAt(want.x, want.z) + 0.5);
  camPos.lerp(want, 1 - Math.exp(-dt * (spec ? 9 : 14)));
  camAim.lerp(new THREE.Vector3(focus.x + rx * side * 0.6, ty, focus.z + rz * side * 0.6), 1 - Math.exp(-dt * 16));
  camera.position.copy(camPos);
  if (shake > 0) { camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(shake * 0.25)); shake = Math.max(0, shake - dt * 2.5); }
  camera.lookAt(camAim);
  const fovT = 58 + (spec ? clamp(Math.abs(driving.speed) / spec.maxF, 0, 1) * 14 : (input.sprint && speed > 4 ? 6 : 0));
  if (Math.abs(camera.fov - fovT) > 0.05) { camera.fov = damp(camera.fov, fovT, 3, dt); camera.updateProjectionMatrix(); }

  // world animation
  if (W.friends) {
    for (const f of W.friends.update(dt, t, camera.position, hits)) {
      bonks++;
      ui.pop(bonkLine(bonks), W.friends.anchor(f), camera);
      shake = Math.max(shake, 0.25);
      ui.bonks(bonks);
    }
  }
  updateSparks(dt);
  if (frameN % 10 === 0) { const lim = Math.min(W.map.env.fogFar * 0.75, 520); for (const tl of W.tiles) tl.visible = tl.userData.tile.distanceTo(camera.position) < lim; }
  W.atmo.update(focus);
  W.grass?.update(focus);
  W.snow?.(focus, dt, t);
  W.water?.userData.tick?.(t);
  for (const p of W.places) if (!p.pos || p.pos.distanceTo(focus) < 260) p.tick(t);
  for (const v of W.vehicles) if (v !== driving) { if (v.ai) aiDrive(v, dt); else v.update(dt, null, colliders); }

  // HUD
  const g = W.map.geo;
  ui.hud({ lat: g.lat0 - focus.z * g.k, lon: g.lon0 + focus.x * g.k * 1.1, zone: zn, mapName: W.map.name, sats: 22 + Math.round(hash(Math.floor(t / 4)) * 9), fix: driving ? "RTK FLOAT" : "3D FIX" });
  ui.updateLabels(camera, focus);
  if (frameN % 2 === 0) ui.drawMini(focus.x, focus.z, driving ? driving.heading : player.st.heading, camYaw, W.vehicles, W.collect);
  if (bigMap) ui.drawBig(focus.x, focus.z, driving ? driving.heading : player.st.heading, W.map.zones, t);

  draw(W.scene);
}
requestAnimationFrame(frame);
if (location.search.includes("debug")) window.__game = { renderer, camera, get world() { return W; }, get player() { return player; }, set composer(c) { composer = c; } };
