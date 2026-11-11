// Districts, landmarks, objective markers and collectibles for a map.
import * as THREE from "three";
import { D, rng, hash, clamp } from "./util.js";
import { LANDMARKS, ICONS, part, merge, box, cyl, cone, mesh, windowMat, glowMat, propMat, shinyMat, haloTexture, roofPanels } from "./kit.js";
import { createPlaneModel } from "./vehicles.js";

const stdMat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

/* ------------------------------------------------------------ extra landmarks */
const EXTRA = {
  station() {
    const g = new THREE.Group(), concrete = stdMat("#d9d4c9");
    g.add(mesh(box(52, 0.6, 22), stdMat("#bdb6aa"), [0, 0.3, 0]));
    const vault = new THREE.SphereGeometry(6.4, 20, 6, 0, Math.PI * 2, 0, 0.62);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
      const x = -21 + i * 8.4, z = -4.2 + j * 8.4;
      const v = mesh(vault, concrete, [x, 3.6, z]);
      v.scale.set(0.66, 0.5, 0.66);
      v.material = concrete;
      g.add(v, mesh(cyl(0.22, 0.3, 6.2, 8), concrete, [x, 3.4, z]));
    }
    g.add(mesh(box(56, 0.25, 2.2), stdMat("#6b5d4f"), [0, 0.15, -14]), mesh(box(56, 0.25, 2.2), stdMat("#6b5d4f"), [0, 0.15, -19]));
    for (const z of [-14.6, -13.4, -19.6, -18.4]) g.add(mesh(box(56, 0.18, 0.12), stdMat("#9aa3ad", { metalness: 0.8, roughness: 0.3 }), [0, 0.35, z]));
    const train = new THREE.Group();
    for (let k = 0; k < 3; k++) train.add(mesh(box(16, 3.2, 3), stdMat(k ? "#2f6b4f" : "#c6402f", { roughness: 0.5 }), [-17 + k * 16.6, 2.0, -14]));
    g.add(train);
    const cols = [];
    for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) cols.push([-21 + i * 8.4, -4.2 + j * 8.4, 0.4]);
    return { g, w: 56, h: 8, circles: cols, boxes: [[0, -16.5, 28, 3.2]], front: 12 };
  },
  hangout() {
    const g = new THREE.Group();
    g.add(mesh(merge([
      part(box(3.2, 2.3, 2.2), "#7b5a3a", [0, 1.15, 0]),
      part(box(3.8, 0.12, 3.2), "#d63a3a", [0, 2.5, 0.5], [0.18, 0, 0]),
      part(box(3.0, 0.9, 0.5), "#a57b4f", [0, 0.9, 1.4]),
      part(cyl(0.18, 0.22, 0.4, 10), "#c9ccd1", [-0.8, 1.55, 1.4]),
      part(box(2.8, 0.12, 0.5), "#3b5b8a", [-3, 0.5, 2.6]), part(box(2.8, 0.12, 0.5), "#3b5b8a", [3, 0.5, 2.6]),
      part(box(0.1, 0.5, 0.1), "#333", [-4.2, 0.25, 2.6]), part(box(0.1, 0.5, 0.1), "#333", [-1.8, 0.25, 2.6]),
      part(box(0.1, 0.5, 0.1), "#333", [1.8, 0.25, 2.6]), part(box(0.1, 0.5, 0.1), "#333", [4.2, 0.25, 2.6]),
      ...[[-1.5, 4.3], [0, 4.6], [1.6, 4.2]].map(([x, z]) => part(box(0.5, 0.45, 0.5), "#e03131", [x, 0.23, z])),
    ]), propMat));
    const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.07, 6, 4), glowMat("#ffd27a"), 14);
    const d = new THREE.Object3D();
    for (let i = 0; i < 14; i++) { d.position.set(-4.5 + i * 0.7, 2.7 - Math.sin((i / 13) * Math.PI) * 0.4, 1.9); d.updateMatrix(); bulbs.setMatrixAt(i, d.matrix); }
    g.add(bulbs);
    return { g, w: 10, h: 3, boxes: [[0, 0, 1.7, 1.2]], front: 5 };
  },
  stadium() {
    const g = new THREE.Group();
    const ring = new THREE.CylinderGeometry(46, 36, 15, 48, 4, true, 0.25, Math.PI * 2 - 0.5);
    g.add(mesh(ring, stdMat("#d0d6dd", { side: THREE.DoubleSide }), [0, 7.5, 0]));
    const seats = new THREE.CylinderGeometry(44, 35.5, 14, 48, 4, true, 0.25, Math.PI * 2 - 0.5);
    g.add(mesh(seats, stdMat("#2f6fb3", { side: THREE.BackSide }), [0, 7.4, 0]));
    const field = new THREE.Mesh(new THREE.CircleGeometry(35, 48), stdMat("#3f8f3a"));
    field.rotation.x = -Math.PI / 2; field.position.y = 0.12; field.receiveShadow = true;
    g.add(field, mesh(box(3, 0.05, 20), stdMat("#c9b98a"), [0, 0.16, 0]));
    for (let k = 0; k < 4; k++) {
      const a = Math.PI / 4 + (k * Math.PI) / 2, x = Math.cos(a) * 50, z = Math.sin(a) * 50;
      g.add(mesh(cyl(0.5, 0.8, 34, 8), stdMat("#9aa3ad", { metalness: 0.6 }), [x, 17, z]));
      const lamp = mesh(box(5, 3, 0.6), glowMat("#fff6d8"), [x * 0.98, 34, z * 0.98]);
      lamp.lookAt(0, 0, 0);
      g.add(lamp);
    }
    const circles = [];
    for (let k = 0; k < 40; k++) { const a = 0.35 + (k / 40) * (Math.PI * 2 - 0.7); circles.push([Math.cos(a) * 41, -Math.sin(a) * 41, 4.2]); }
    for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + (k * Math.PI) / 2; circles.push([Math.cos(a) * 50, Math.sin(a) * 50, 0.9]); }
    return { g, w: 100, h: 34, circles, front: 49 };
  },
  ghat() {
    const g = new THREE.Group();
    g.add(mesh(merge([
      part(box(14, 4, 8), "#e9e4d8", [0, 2, -6]),
      part(box(15, 0.4, 9), "#2f6b4f", [0, 4.2, -6]),
      part(box(4, 0.3, 26), "#7b6a55", [0, 0.6, 9]),
      part(box(14, 1.2, 8), "#3a3f47", [0, 0.1, 25]),
    ]), propMat));
    const launch = new THREE.Group();
    launch.add(mesh(merge([
      part(box(30, 2.2, 7), "#f4f4f4", [0, 1.1, 0]), part(box(30.5, 0.5, 7.1), "#c6402f", [0, 0.25, 0]),
      part(box(24, 2.2, 6.4), "#e9ecef", [-1, 3.3, 0]), part(box(18, 2, 5.8), "#f4f4f4", [-2, 5.4, 0]),
      part(box(4, 1.4, 3.5), "#2f6fb3", [10, 6.5, 0]), part(cyl(0.6, 0.6, 3, 10), "#2b2b2b", [4, 7.8, 0]),
      part(box(3.2, 2.2, 7), "#f4f4f4", [16, 1.6, 0], [0, 0, 0.35]),
    ]), propMat));
    for (let k = 0; k < 9; k++) launch.add(mesh(box(1.4, 1, 0.1), stdMat("#2a3f55"), [-10 + k * 2.6, 3.4, 3.22]));
    launch.position.set(0, -0.4, 40);
    launch.rotation.y = 0.05;
    g.add(launch);
    g.userData.tick = (t) => { launch.position.y = -0.4 + Math.sin(t * 0.9) * 0.12; launch.rotation.z = Math.sin(t * 0.7) * 0.012; };
    return { g, w: 16, h: 9, boxes: [[0, -6, 7.2, 4.2], [0, 40, 16, 3.6]], front: -1, frontOverride: [6, 4] };
  },
  basilica() {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 192;
    const x = c.getContext("2d");
    for (let i = 0; i < 16; i++) for (let j = 0; j < 12; j++) { x.fillStyle = (i + j) % 2 ? "#f2e6dd" : "#d99a92"; x.fillRect(i * 16, j * 16, 16, 16); }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const g = new THREE.Group();
    g.add(mesh(box(26, 18, 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 }), [0, 9, 0]));
    g.add(mesh(merge([part(box(22, 14, 40), "#e9dccb", [0, 7, -21]), ...roofPanels(40.5, 22.5, 15.5, 0.35, "#b5543c", "#a24a35").map((p) => p.rotateY(Math.PI / 2).translate(0, 0, -21))]), propMat));
    for (const [px, r] of [[0, 2.2], [-8.5, 1.5], [8.5, 1.5]]) g.add(mesh(cyl(r, r, 0.3, 24), stdMat("#8a5a4a"), [px, 12.5, 1.1]).rotateX(Math.PI / 2));
    g.add(mesh(box(4, 6, 0.4), stdMat("#5a3b2a"), [0, 3, 1.1]));
    return { g, w: 28, h: 18, boxes: [[0, -18, 13.2, 21]], front: 5 };
  },
  church() {
    const g = new THREE.Group(), brick = stdMat("#8d4a35");
    g.add(mesh(box(12, 14, 30), brick, [0, 7, 0]));
    g.add(mesh(merge(roofPanels(30.5, 12, 15.5, 0.6, "#3c4a44", "#33403a")).rotateY(Math.PI / 2), propMat));
    g.add(mesh(box(8, 36, 8), brick, [0, 18, 17]));
    g.add(mesh(cone(5.2, 22, 8), stdMat("#4f8f7a", { metalness: 0.3 }), [0, 47, 17]));
    g.add(mesh(box(2.5, 5, 0.3), stdMat("#2a2a2a"), [0, 2.5, 21.1]));
    return { g, w: 14, h: 58, boxes: [[0, 2, 6.2, 19.5]], front: 24 };
  },
};

// Approximate footprints of the kit landmarks [hw, hd, zOffset].
const FOOT = { home: [2.4, 1.9, 0], school: [5.9, 2, 0], uni: [7.3, 3.4, 0.6], work: [2.5, 2.4, 0], lab: [5.7, 2.8, 0], arcade: [1.2, 1.0, 0], airport: [7.6, 3.6, 0], remote: [1.5, 1.3, 1], beacon: [0.6, 0.6, 0] };

function buildPlace(p) {
  if (EXTRA[p.build]) return EXTRA[p.build]();
  const b = LANDMARKS[p.build]({ ...p, flag: p.flag });
  const [hw, hd, zo] = FOOT[p.build];
  const extra = p.build === "airport" ? [[5.5, -1.5, 1.3]] : p.build === "remote" ? [[-2.5, -2, 0.4], [3.5, -7, 0.4]] : [];
  return { ...b, boxes: [[0, zo, hw, hd]], circles: extra, front: hd + zo + 3 };
}

/* ------------------------------------------------------------ districts */
const STYLE = {
  city: { floors: [3, 10], w: [7, 12], d: [9, 13], colors: ["#e9dfcf", "#d9c3b0", "#cfd6dc", "#e8d2a6", "#c9b8d6", "#bfcfc0", "#efe7dd", "#d6a98f"], signs: true, roof: "#7d7a74" },
  town: { floors: [2, 5], w: [7, 12], d: [8, 11], colors: ["#efe2c9", "#dfc9b0", "#cfd8d0", "#e8d2a6", "#f2efe8"], signs: true, roof: "#8b8580" },
  nordic: { floors: [3, 6], w: [12, 22], d: [10, 14], colors: ["#d9cbb3", "#b55239", "#e8e4dc", "#8fa3b8", "#c9a27e"], signs: false, roof: "#f2f5fa" },
  italian: { floors: [2, 4], w: [8, 14], d: [8, 12], colors: ["#e0ad78", "#d98c5f", "#f0c987", "#e6d5b8", "#cfa98a"], signs: false, roof: "#b5543c" },
  airport: null, campus: null, village: null,
};

export function createDistricts(scene, hf, colliders, footprints) {
  const map = hf.map, r = rng(map.seed * 13 + 5), lots = [];
  const ok = (x, z, hw, hd, rot) => {
    for (const [cx, cz] of [[0, 0], [hw, hd], [-hw, hd], [hw, -hd], [-hw, -hd]]) {
      const wx = x + cx * Math.cos(rot) + cz * Math.sin(rot), wz = z - cx * Math.sin(rot) + cz * Math.cos(rot);
      if (hf.waterMask(wx, wz) > 0.01 || hf.roadMask(wx, wz) > 0.05 || colliders.inside(wx, wz)) return false;
    }
    return !footprints.some((f) => Math.abs(x - f.x) < f.hw + hw + 6 && Math.abs(z - f.z) < f.hd + hd + 6);
  };
  const add = (zn, x, z, rot) => {
    const st = STYLE[zn.kind];
    if (!st) return;
    const d = Math.hypot(x - zn.c[0], z - zn.c[1]) / zn.r;
    if (d > 1) return;
    const w = st.w[0] + r() * (st.w[1] - st.w[0]), dep = st.d[0] + r() * (st.d[1] - st.d[0]);
    if (!ok(x, z, w / 2 + 1, dep / 2 + 1, rot)) return;
    const centre = 1 - d;
    const floors = Math.round(st.floors[0] + (st.floors[1] - st.floors[0]) * clamp(r() * 0.7 + centre * 0.6, 0, 1));
    const h = floors * 3.2 + 0.6;
    const y = Math.min(hf.heightAt(x, z), hf.heightAt(x + w / 2, z), hf.heightAt(x - w / 2, z)) - 0.3;
    colliders.addBox(x, z, w / 2, dep / 2, rot, h + y);
    lots.push({ zid: zn.id, x, y, z, w, d: dep, h, rot, c: new THREE.Color(st.colors[Math.floor(r() * st.colors.length)]), st, sign: st.signs && r() < 0.7 });
  };

  const g = map.grid;
  if (g) {
    const pz = { id: "grid", kind: map.id === "it" ? "italian" : "city", c: [(g.x0 + g.x1) / 2, (g.z0 + g.z1) / 2], r: Math.hypot(g.x1 - g.x0, g.z1 - g.z0) / 2 + 20 };
    const per = map.id === "it" ? 3 : 5;
    for (let bx = g.x0; bx < g.x1; bx += g.step) for (let bz = g.z0; bz < g.z1; bz += g.step) {
      const inner = g.step - g.w - 4, cx = bx + g.step / 2, cz = bz + g.step / 2, e = inner / 2 - 6.5;
      for (let s = 0; s < 4; s++) for (let k = 0; k < per; k++) {
        const t = ((k + 0.5) / per) * inner - inner / 2;
        const [x, z, rot] = s === 0 ? [cx + t, cz - e, Math.PI] : s === 1 ? [cx + t, cz + e, 0] : s === 2 ? [cx - e, cz + t, -Math.PI / 2] : [cx + e, cz + t, Math.PI / 2];
        add(pz, x, z, rot);
      }
      add(pz, cx, cz, 0);
    }
  }
  for (const zn of map.zones) {
    if (!STYLE[zn.kind]) continue;
    for (const rd of map.roads) {
      for (let i = 0; i < rd.pts.length - 1; i++) {
        const [ax, az] = rd.pts[i], [bx, bz] = rd.pts[i + 1], len = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / len, uz = (bz - az) / len;
        for (let s = 0; s < len; s += 15) for (const side of [-1, 1]) {
          const off = rd.w / 2 + 9;
          add(zn, ax + ux * s - uz * side * off, az + uz * s + ux * side * off, Math.atan2(uz * side, -ux * side));
        }
      }
    }
    for (let k = 0; k < 60; k++) { const a = r() * 6.283, d = Math.sqrt(r()) * zn.r * 0.9; add(zn, zn.c[0] + Math.cos(a) * d, zn.c[1] + Math.sin(a) * d, Math.round(r() * 4) * (Math.PI / 2)); }
  }
  const groups = {};
  for (const l of lots) (groups[l.zid] ||= []).push(l);
  for (const list of Object.values(groups)) instanceLots(scene, list);
}

const SIGN = ["#e03131", "#2f9e44", "#1c7ed6", "#f08c00", "#ae3ec9", "#f8f9fa"].map((c) => new THREE.Color(c));
const wallGeo = box(1, 1, 1).translate(0, 0.5, 0), signMat = new THREE.MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
const roofMat = stdMat("#ffffff", { roughness: 0.95 }), tankGeo = cyl(0.7, 0.7, 1.4, 10), tankMat = stdMat("#2d3238");
function instanceLots(scene, lots) {
  const dummy = new THREE.Object3D();
  const walls = new THREE.InstancedMesh(wallGeo, windowMat("#ffffff"), lots.length);
  const roofs = new THREE.InstancedMesh(wallGeo, roofMat, lots.length);
  const signs = new THREE.InstancedMesh(box(1, 1, 1), signMat, lots.length);
  const tanks = new THREE.InstancedMesh(tankGeo, tankMat, lots.length);
  let ns = 0, nt = 0;
  lots.forEach((l, i) => {
    dummy.position.set(l.x, l.y, l.z); dummy.rotation.set(0, l.rot, 0); dummy.scale.set(l.w, l.h, l.d); dummy.updateMatrix();
    walls.setMatrixAt(i, dummy.matrix); walls.setColorAt(i, l.c);
    dummy.position.y = l.y + l.h; dummy.scale.set(l.w + 0.4, 0.5, l.d + 0.4); dummy.updateMatrix();
    roofs.setMatrixAt(i, dummy.matrix); roofs.setColorAt(i, new THREE.Color(l.st.roof));
    if (l.sign) {
      const fx = Math.sin(l.rot), fz = Math.cos(l.rot);
      dummy.position.set(l.x + fx * (l.d / 2 + 0.15), l.y + 4.2, l.z + fz * (l.d / 2 + 0.15)); dummy.scale.set(l.w * 0.8, 1.1, 0.15); dummy.updateMatrix();
      signs.setMatrixAt(ns, dummy.matrix); signs.setColorAt(ns++, SIGN[Math.floor(hash(i) * SIGN.length)]);
    }
    if (l.st === STYLE.city && hash(i + 7) > 0.4) {
      dummy.position.set(l.x + (hash(i) - 0.5) * l.w * 0.5, l.y + l.h + 1.2, l.z); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      tanks.setMatrixAt(nt++, dummy.matrix);
    }
  });
  signs.count = ns; tanks.count = nt;
  for (const m of [walls, roofs, tanks]) { m.castShadow = m.receiveShadow = true; m.computeBoundingSphere(); scene.add(m); }
  signs.computeBoundingSphere();
  scene.add(signs);
}

/* ------------------------------------------------------------ places, markers, collectibles */
const beamMat = new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color("#5fe0ff") }, uTime: { value: 0 } },
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uColor; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.0) * 0.55; gl_FragColor = vec4(uColor * a, a); }`,
});

export function createPlaces(scene, hf, colliders) {
  const map = hf.map, places = [], footprints = [];
  for (const p of map.places) {
    const b = buildPlace(p);
    const [px, pz] = p.pos, rot = p.rot || 0, c = Math.cos(rot), s = Math.sin(rot);
    const toWorld = (lx, lz) => [px + lx * c + lz * s, pz - lx * s + lz * c];
    const y = hf.heightAt(px, pz) - 0.05;
    b.g.position.set(px, y, pz);
    b.g.rotation.y = rot;
    scene.add(b.g);
    for (const [lx, lz, hw, hd] of b.boxes || []) { const [wx, wz] = toWorld(lx, lz); colliders.addBox(wx, wz, hw, hd, rot, b.h + y); footprints.push({ x: wx, z: wz, hw: Math.max(hw, hd), hd: Math.max(hw, hd) }); }
    for (const [lx, lz, rr] of b.circles || []) { const [wx, wz] = toWorld(lx, lz); colliders.addCircle(wx, wz, rr); }
    if (!b.boxes?.length) footprints.push({ x: px, z: pz, hw: b.w / 2, hd: b.w / 2 });
    const ticks = [];
    b.g.traverse((o) => o.userData.tick && ticks.push(o.userData.tick));
    const data = D.places[p.id];
    if (!data) { places.push({ id: p.id, decor: true, tick: (t) => ticks.forEach((f) => f(t)) }); continue; }
    const [fx, fz] = b.frontOverride ? toWorld(...b.frontOverride) : toWorld(0, b.front);
    const fy = hf.heightAt(fx, fz);
    const marker = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 60, 20, 1, true).translate(0, 30, 0), beamMat.clone());
    const gem = mesh(new THREE.OctahedronGeometry(0.42, 0), glowMat(p.travel ? "#ffd166" : "#5fe0ff"));
    gem.position.y = 2.4;
    if (p.travel) beam.material.uniforms.uColor.value.set("#ffd166");
    marker.add(beam, gem);
    marker.position.set(fx, fy, fz);
    scene.add(marker);
    places.push({
      id: p.id, data, travel: !!p.travel, pos: new THREE.Vector3(fx, fy, fz), anchor: new THREE.Vector3(fx, fy + 3.4, fz),
      visited: false, marker, gem, beam,
      tick: (t) => { ticks.forEach((f) => f(t)); gem.rotation.y = t * 1.6; gem.position.y = 2.4 + Math.sin(t * 2) * 0.15; },
    });
    if (p.build === "airport") {
      const [rx, rz] = toWorld(0, -48);
      const runway = mesh(box(220, 0.2, 30), stdMat("#2f3236", { roughness: 0.9 }), [rx, hf.heightAt(rx, rz) + 0.08, rz]);
      runway.rotation.y = rot;
      scene.add(runway);
      for (let k = -5; k <= 5; k++) {
        const [mx, mz] = toWorld(k * 20, -48);
        const dash = mesh(box(9, 0.05, 0.8), stdMat("#f1f3f5"), [mx, hf.heightAt(mx, mz) + 0.2, mz]);
        dash.rotation.y = rot;
        scene.add(dash);
      }
      const plane = createPlaneModel();
      const [ax, az] = toWorld(-26, -14);
      plane.position.set(ax, hf.heightAt(ax, az), az);
      plane.rotation.y = rot + Math.PI / 2;
      scene.add(plane);
      colliders.addCircle(ax, az, 4);
    }
  }
  return { places, footprints };
}

export function createCollectibles(scene, hf, places, taken) {
  const halo = haloTexture(), list = [];
  D.achievements.forEach((a, i) => {
    const p = places.find((q) => q.id === a.place && !q.decor);
    if (!p) return;
    const [ox, oz] = a.offset || [0, 0];
    const x = p.pos.x + ox + 3, z = p.pos.z + oz + 3;
    const g = new THREE.Group();
    const icon = new THREE.Mesh(ICONS[a.icon](), shinyMat);
    icon.scale.setScalar(1.6);
    icon.castShadow = true;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.setScalar(3.2);
    g.add(sp, icon);
    g.position.set(x, hf.heightAt(x, z) + 1.5, z);
    g.visible = !taken.has(i);
    scene.add(g);
    list.push({ a, i, g, icon, sp, base: g.position.y, taken: taken.has(i), anim: 0 });
  });
  return list;
}
