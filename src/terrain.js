// Height field, ground colours, roads and water for a map definition.
import * as THREE from "three";
import { clamp, lerp, smooth, fbm, hash2, distToPolyline, U } from "./util.js";

function lakeDist(l, x, z) {
  const c = Math.cos(l.rot), s = Math.sin(l.rot), dx = x - l.c[0], dz = z - l.c[1];
  const u = (dx * c + dz * s) / l.rx, v = (-dx * s + dz * c) / l.rz;
  return (Math.hypot(u, v) - 1) * Math.min(l.rx, l.rz);
}

export function createHeightField(map) {
  const half = map.size / 2, W = map.water;
  const zones = map.zones, urbanKinds = new Set(["city", "town", "airport", "nordic", "italian"]);
  // Airport grounds (runway + apron, in the airport's local frame) are levelled flat.
  const airports = map.places.filter((p) => p.build === "airport").map((p) => ({ x: p.pos[0], z: p.pos[1], c: Math.cos(p.rot), s: Math.sin(p.rot) }));
  const flatLevel = Math.max(map.base * 0.6 + 0.6, W.level + 1.2);

  // 0 = dry land, 1 = open water (with soft banks)
  function waterAt(x, z) {
    let w = 0;
    for (const r of W.rivers) w = Math.max(w, smooth(r.width / 2 + 10, r.width / 2 - 4, distToPolyline(x, z, r.pts)));
    for (const l of W.lakes) w = Math.max(w, smooth(10, -4, lakeDist(l, x, z)));
    return w;
  }
  function roadAt(x, z) {
    let best = { d: Infinity, w: 0 };
    for (const r of map.roads) { const d = distToPolyline(x, z, r.pts); if (d - r.w / 2 < best.d - best.w / 2) best = { d, w: r.w, kind: r.kind }; }
    if (map.grid) {
      const g = map.grid;
      if (x > g.x0 - 5 && x < g.x1 + 5 && z > g.z0 - 5 && z < g.z1 + 5) {
        const gx = Math.abs(((x - g.x0) % g.step + g.step) % g.step), gz = Math.abs(((z - g.z0) % g.step + g.step) % g.step);
        const d = Math.min(Math.min(gx, g.step - gx), Math.min(gz, g.step - gz));
        if (d - g.w / 2 < best.d - best.w / 2) best = { d, w: g.w, kind: "street" };
      }
    }
    return best;
  }
  function zoneAt(x, z) {
    let best = null, bd = Infinity;
    for (const zn of zones) { const d = Math.hypot(x - zn.c[0], z - zn.c[1]) / zn.r; if (d < 1 && zn.r < bd) { bd = zn.r; best = zn; } }
    return best;
  }
  function rawHeight(x, z) {
    let h = map.base + (fbm(x * 0.0055 + map.seed, z * 0.0055) - 0.45) * map.hills * 2;
    const low = h;
    h += (fbm(x * 0.03, z * 0.03) - 0.5) * map.hills * 0.18;
    for (const m of map.mountains || []) {
      const d = Math.hypot(x - m.c[0], z - m.c[1]);
      h += m.h * Math.pow(smooth(m.r, 0, d), 1.6) * (0.65 + 0.7 * fbm(x * 0.012 + 3, z * 0.012));
    }
    for (const zn of zones) {
      const f = smooth(zn.r * 1.15, zn.r * 0.55, Math.hypot(x - zn.c[0], z - zn.c[1]));
      h = lerp(h, Math.max(map.base * 0.6 + 0.6, W.level + 1.2), f * 0.9);
    }
    const edge = smooth(half - 60, half - 8, Math.max(Math.abs(x), Math.abs(z)));
    h += edge * (40 + fbm(x * 0.02, z * 0.02) * 40);
    const w = waterAt(x, z);
    if (w > 0) h = lerp(h, W.level - (W.ice ? 1.2 : 4.5), w);
    const rd = roadAt(x, z);
    const rf = smooth(rd.w / 2 + 7, rd.w / 2 + 0.5, rd.d);
    if (rf > 0) h = lerp(h, Math.max(lerp(low, h, 0.25), W.level + 1.0), rf);
    for (const a of airports) {
      const dx = x - a.x, dz = z - a.z, lx = dx * a.c - dz * a.s, lz = dx * a.s + dz * a.c;
      const d = Math.hypot(Math.max(Math.abs(lx) - 122, 0), Math.max(lz - 34, -74 - lz, 0));
      h = lerp(h, flatLevel, smooth(140, 15, d) * (1 - w));
    }
    return { h, w, rd, low };
  }

  const N = map.size > 1400 ? 300 : 260, step = map.size / (N - 1);
  const H = new Float32Array(N * N), WM = new Float32Array(N * N), RM = new Float32Array(N * N);
  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const x = -half + i * step, z = -half + j * step, r = rawHeight(x, z);
      H[j * N + i] = r.h; WM[j * N + i] = r.w; RM[j * N + i] = smooth(r.rd.w / 2 + 1.5, r.rd.w / 2 - 0.5, r.rd.d);
    }

  function sample(arr, x, z) {
    const fx = clamp((x + half) / step, 0, N - 1.001), fz = clamp((z + half) / step, 0, N - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const a = arr[j * N + i], b = arr[j * N + i + 1], c = arr[(j + 1) * N + i], d = arr[(j + 1) * N + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }
  const heightAt = (x, z) => sample(H, x, z);
  const waterMask = (x, z) => sample(WM, x, z);
  const roadMask = (x, z) => sample(RM, x, z);
  const normalAt = (x, z, out = new THREE.Vector3()) => {
    const e = 1.2;
    return out.set(heightAt(x - e, z) - heightAt(x + e, z), 2 * e, heightAt(x, z - e) - heightAt(x, z + e)).normalize();
  };
  return { map, N, step, half, H, WM, RM, heightAt, waterMask, roadMask, normalAt, zoneAt, roadAt, waterAt, urbanKinds };
}

/* ------------------------------------------------------------ terrain mesh */
export function createTerrainMesh(hf) {
  const { map, N, step, half, H, WM, RM } = hf, g = map.ground;
  const C = Object.fromEntries(Object.entries(g).map(([k, v]) => [k, new THREE.Color(v)]));
  const geo = new THREE.PlaneGeometry(map.size, map.size, N - 1, N - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
  const mask = new Float32Array(N * N);
  for (let k = 0; k < pos.count; k++) {
    const i = k % N, j = Math.floor(k / N), x = -half + i * step, z = -half + j * step;
    const h = H[j * N + i];
    pos.setY(k, h);
    const zn = hf.zoneAt(x, z), n = fbm(x * 0.02, z * 0.02), n2 = fbm(x * 0.08 + 7, z * 0.08);
    c.copy(C.grass).lerp(C.grass2, n).lerp(C.dry, smooth(0.6, 0.85, n2) * 0.5);
    let grass = 1;
    if (zn && zn.kind === "village") {
      const field = (Math.floor(x / 18) + Math.floor(z / 14)) & 1;
      const d = Math.hypot(x - zn.c[0], z - zn.c[1]) / zn.r;
      if (d > 0.25) { c.lerp(field ? C.paddyA : C.paddyB, 0.85); grass = field ? 1 : 0.55; }
    }
    if (zn && hf.urbanKinds.has(zn.kind)) {
      const f = smooth(zn.r * 0.95, zn.r * 0.55, Math.hypot(x - zn.c[0], z - zn.c[1]));
      c.lerp(C.urban, f * 0.9);
      grass *= 1 - f;
    }
    const gr = map.grid;
    if (gr && x > gr.x0 - 12 && x < gr.x1 + 12 && z > gr.z0 - 12 && z < gr.z1 + 12) { c.lerp(C.urban, 0.85); grass = 0; }
    const slope = Math.abs(h - H[j * N + Math.min(i + 1, N - 1)]) / step;
    c.lerp(C.dirt, smooth(0.35, 0.8, slope));
    if (h > 55) c.lerp(new THREE.Color("#f2f2f0"), smooth(55, 80, h));
    const w = WM[j * N + i];
    c.lerp(C.sand, smooth(0.02, 0.4, w) * (1 - smooth(0.7, 1, w)) * 0.9);
    grass *= (1 - smooth(0.02, 0.25, w)) * (1 - RM[j * N + i]) * (1 - smooth(0.4, 0.8, slope));
    mask[j * N + i] = clamp(grass, 0, 1);
    const jit = 0.94 + hash2(i, j) * 0.12;
    col[k * 3] = c.r * jit; col[k * 3 + 1] = c.g * jit; col[k * 3 + 2] = c.b * jit;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWp;")
      .replace("#include <worldpos_vertex>", "#include <worldpos_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vWp;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        float tNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1, 0)), f.x), mix(tHash(i + vec2(0, 1)), tHash(i + vec2(1, 1)), f.x), f.y); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float dn = tNoise(vWp.xz * 0.9) * 0.5 + tNoise(vWp.xz * 3.7) * 0.3 + tNoise(vWp.xz * 0.15) * 0.2;
        diffuseColor.rgb *= 0.82 + dn * 0.32;`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;

  // height (R) + grass density (G) for the GPU grass
  const data = new Uint16Array(N * N * 4);
  for (let k = 0; k < N * N; k++) {
    data[k * 4] = THREE.DataUtils.toHalfFloat(H[k]);
    data[k * 4 + 1] = THREE.DataUtils.toHalfFloat(mask[k]);
    data[k * 4 + 3] = THREE.DataUtils.toHalfFloat(1);
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  hf.grassMask = (x, z) => {
    const fx = clamp(Math.round((x + half) / step), 0, N - 1), fz = clamp(Math.round((z + half) / step), 0, N - 1);
    return mask[fz * N + fx];
  };
  return { mesh, heightTex: tex, colors: col };
}

/* ------------------------------------------------------------ roads */
function roadMaterial(kind) {
  const m = new THREE.MeshStandardMaterial({ color: kind === "dirt" ? "#8d7552" : "#3b3d42", roughness: kind === "dirt" ? 1 : 0.88, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  if (kind === "dirt") return m;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nattribute vec2 rd; varying vec2 vRd;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvRd = rd;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", `#include <common>
        varying vec2 vRd;
        float rHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float across = abs(vRd.x - 0.5);
        float edge = smoothstep(0.43, 0.445, across) * (1.0 - smoothstep(0.465, 0.48, across));
        float centre = (1.0 - smoothstep(0.008, 0.014, across)) * step(0.5, fract(vRd.y / 6.0));
        diffuseColor.rgb *= 0.88 + rHash(floor(vRd * vec2(40.0, 2.0))) * 0.12;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.84, 0.78), max(edge, centre) * 0.85);`);
  };
  return m;
}

function ribbon(pts, w, hf, lift = 0.06) {
  const P = [], step = 3;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) P.push([ax + (bx - ax) * (k / n), az + (bz - az) * (k / n)]);
  }
  P.push(pts[pts.length - 1]);
  const pos = [], rd = [], idx = [];
  let dist = 0;
  P.forEach((p, i) => {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    if (i > 0) dist += Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]);
    for (const s of [-1, 1]) {
      const x = p[0] - dz * s * w / 2, z = p[1] + dx * s * w / 2;
      pos.push(x, hf.heightAt(x, z) + lift, z);
      rd.push(s < 0 ? 0 : 1, dist);
    }
    if (i > 0) { const k = i * 2; idx.push(k - 2, k, k - 1, k - 1, k, k + 1); }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("rd", new THREE.Float32BufferAttribute(rd, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createRoads(hf) {
  const group = new THREE.Group(), map = hf.map, mats = {};
  const mat = (k) => (mats[k] ||= roadMaterial(k));
  for (const r of map.roads) {
    const m = new THREE.Mesh(ribbon(r.pts, r.w, hf), mat(r.kind));
    m.receiveShadow = true;
    group.add(m);
  }
  if (map.grid) {
    const g = map.grid;
    for (let x = g.x0; x <= g.x1 + 0.1; x += g.step) group.add(Object.assign(new THREE.Mesh(ribbon([[x, g.z0], [x, g.z1]], g.w, hf), mat("street")), { receiveShadow: true }));
    for (let z = g.z0; z <= g.z1 + 0.1; z += g.step) group.add(Object.assign(new THREE.Mesh(ribbon([[g.x0, z], [g.x1, z]], g.w, hf, 0.07), mat("street")), { receiveShadow: true }));
  }
  return group;
}

/* ------------------------------------------------------------ water */
export function createWater(hf, env) {
  const W = hf.map.water;
  if (!W.rivers.length && !W.lakes.length) return null;
  const tex = new THREE.TextureLoader().load("assets/textures/waternormals.jpg");
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(hf.map.size / 24, hf.map.size / 24);
  const mat = W.ice
    ? new THREE.MeshStandardMaterial({ color: "#b9cde0", roughness: 0.18, metalness: 0.05, normalMap: tex, normalScale: new THREE.Vector2(0.15, 0.15), envMapIntensity: 1.2 })
    : new THREE.MeshStandardMaterial({ color: W.color, roughness: 0.06, metalness: 0.0, normalMap: tex, normalScale: new THREE.Vector2(0.55, 0.55), transparent: true, opacity: 0.93, envMapIntensity: 1.6 });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(hf.map.size, hf.map.size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = W.level - (W.ice ? 0.15 : 0.25);
  m.receiveShadow = true;
  m.userData.tick = (t) => { if (!W.ice) tex.offset.set(t * 0.004, t * 0.006); };
  return m;
}
