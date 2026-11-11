// Procedural low-poly props, instanced scenery, landmarks and collectibles.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { U } from "./util.js";

/* ------------------------------------------------------------ geometry helpers */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function part(geo, color, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  g.clearGroups();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  _m.compose(_p.set(...p), _q.setFromEuler(_e.set(...r)), _s.set(...s));
  g.applyMatrix4(_m);
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}
const merge = (parts) => mergeGeometries(parts);
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);
const cone = (r, h, s = 7) => new THREE.ConeGeometry(r, h, s);
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, d);

export const propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
const shinyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.3, metalness: 0.55 });
const cloudMat = new THREE.MeshStandardMaterial({ color: "#ffffff", flatShading: true, roughness: 1, emissive: "#dfe9f7", emissiveIntensity: 0.45 });
const glowMat = (c) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false });

// Walls with procedural windows that light up at night.
const winMats = new Map();
function windowMat(color, glass = false) {
  const key = color + glass;
  if (winMats.has(key)) return winMats.get(key);
  const m = new THREE.MeshStandardMaterial({ color, roughness: glass ? 0.3 : 0.85, metalness: glass ? 0.25 : 0, flatShading: true });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = U.night;
    sh.uniforms.uGlass = { value: glass ? 1 : 0 };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
      .replace("#include <project_vertex>", `#include <project_vertex>
        vec4 wpp = vec4(transformed, 1.0);
        vec3 wnn = objectNormal;
        #ifdef USE_INSTANCING
          wpp = instanceMatrix * wpp;
          wnn = mat3(instanceMatrix) * wnn;
        #endif
        wpp = modelMatrix * wpp;
        vWPos = wpp.xyz;
        vWNrm = normalize(mat3(modelMatrix) * wnn);`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm; uniform float uNight; uniform float uGlass;
        float wHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`)
      .replace("#include <color_fragment>", `#include <color_fragment>
        float side = 1.0 - step(0.6, abs(vWNrm.y));
        float wu = abs(vWNrm.z) > 0.5 ? vWPos.x : vWPos.z;
        vec2 cell = vec2(floor(wu * 1.2), floor(vWPos.y * 0.85));
        vec2 fw = vec2(fract(wu * 1.2), fract(vWPos.y * 0.85));
        float win = side * step(0.22, fw.x) * step(fw.x, 0.78) * step(0.28, fw.y) * step(fw.y, 0.82) * step(1.0, vWPos.y);
        float lit = step(0.42, wHash(cell + vec2(floor(vWPos.z), 0.0)));
        vec3 glassCol = mix(vec3(0.13, 0.17, 0.23), vec3(0.42, 0.58, 0.72), uGlass);
        diffuseColor.rgb = mix(diffuseColor.rgb, glassCol, win * 0.92);
        float winGlow = win * lit;`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(1.0, 0.76, 0.42) * winGlow * uNight * 1.6;`);
  };
  winMats.set(key, m);
  return m;
}

function mesh(geo, mat, p = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/* ------------------------------------------------------------ prop library */
function roofPanels(w, depth, y, pitch, color, color2 = color) {
  const half = depth / 2 / Math.cos(pitch) + 0.15, off = depth / 4;
  return [
    part(box(w, 0.09, half), color, [0, y, off], [pitch, 0, 0]),
    part(box(w, 0.09, half), color2, [0, y, -off], [-pitch, 0, 0]),
  ];
}

const LIB = {
  palm() {
    const ps = [];
    let px = 0, py = 0;
    for (let i = 0; i < 5; i++) {
      const nx = Math.pow((i + 1) / 5, 2) * 0.7, ny = (i + 1) * 0.85, dx = nx - px, dy = ny - py;
      ps.push(part(cyl(0.11 - i * 0.012, 0.13 - i * 0.012, Math.hypot(dx, dy) + 0.06, 6), "#8b6b47", [(px + nx) / 2, (py + ny) / 2, 0], [0, 0, -Math.atan2(dx, dy)]));
      px = nx; py = ny;
    }
    for (let k = 0; k < 8; k++) ps.push(part(box(1.9, 0.05, 0.42).translate(0.95, 0, 0), k % 2 ? "#3f8d3a" : "#58a845", [px, py, 0], [0, (k / 8) * Math.PI * 2, -0.45 - (k % 3) * 0.12]));
    ps.push(part(ico(0.13), "#6b4a2b", [px + 0.1, py - 0.15, 0.1]), part(ico(0.12), "#6b4a2b", [px - 0.08, py - 0.18, -0.08]));
    return merge(ps);
  },
  banana() {
    const ps = [part(cyl(0.09, 0.12, 1.6), "#7a8f3e", [0, 0.8, 0])];
    for (let k = 0; k < 6; k++) ps.push(part(box(1.3, 0.03, 0.46).translate(0.65, 0, 0), k % 2 ? "#5aa63c" : "#6cb84a", [0, 1.55, 0], [0, (k / 6) * Math.PI * 2, 0.35 - (k % 2) * 0.5]));
    return merge(ps);
  },
  hut() {
    return merge([
      part(box(3.2, 0.2, 2.6), "#8d6e4c", [0, 0.1, 0]),
      part(box(3, 1.6, 2.4), "#c99d6b", [0, 0.9, 0]),
      part(box(2.9, 0.9, 0.9), "#c99d6b", [0, 1.65, 0], [Math.PI / 4, 0, 0]),
      part(box(0.6, 1.1, 0.05), "#4a3426", [0.4, 0.65, 1.22]),
      part(box(0.5, 0.4, 0.05), "#3a2a1f", [-0.8, 1.1, 1.22]),
      ...roofPanels(3.6, 2.6, 2.05, 0.55, "#8e9aab", "#7d899a"),
    ]);
  },
  haystack: () => merge([part(cone(0.75, 1.7, 8), "#d6ae4b", [0, 0.85, 0]), part(cyl(0.04, 0.04, 0.6), "#6b4a2b", [0, 1.85, 0])]),
  rice: () => merge([0, 1, 2].map((k) => part(cone(0.06, 0.4, 4), k ? "#86b84d" : "#9bc95a", [k * 0.12 - 0.12, 0.2, (k % 2) * 0.1], [0, 0, (k - 1) * 0.25]))),
  rainTree: () => merge([
    part(cyl(0.15, 0.22, 1.9), "#6b5038", [0, 0.95, 0]),
    part(ico(1.3), "#4f8c3a", [0, 2.4, 0], [0, 0, 0], [1.4, 0.7, 1.2]),
    part(ico(0.9), "#5e9c44", [0.8, 2.7, 0.3]),
    part(ico(0.8), "#467f34", [-0.7, 2.5, -0.3]),
  ]),
  mosque: () => merge([
    part(box(4, 2.6, 3.2), "#f2efe8", [0, 1.3, 0]),
    part(new THREE.SphereGeometry(1.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#f7f5ef", [0, 2.6, 0]),
    part(cyl(0.04, 0.04, 0.6), "#3a9a5a", [0, 4.0, 0]),
    part(cyl(0.25, 0.3, 5.4, 8), "#efeae0", [-2.5, 2.7, 0.9]),
    part(cyl(0.42, 0.42, 0.16, 8), "#e2dccf", [-2.5, 4.4, 0.9]),
    part(cone(0.34, 0.9, 8), "#3a9a5a", [-2.5, 5.85, 0.9]),
    ...[-1.2, 0, 1.2].map((x) => part(box(0.6, 1.3, 0.06), "#857a6c", [x, 0.75, 1.62])),
  ]),
  lampPost: () => merge([part(cyl(0.05, 0.07, 3.2, 6), "#4a4f57", [0, 1.6, 0]), part(box(0.7, 0.05, 0.05), "#4a4f57", [0.3, 3.15, 0]), part(box(0.32, 0.08, 0.2), "#2f3338", [0.62, 3.1, 0])]),
  pineSnow: () => pine(true),
  pine: () => pine(false),
  birch() {
    const ps = [part(cyl(0.07, 0.1, 2.4, 6), "#efefe8", [0, 1.2, 0])];
    for (let k = 0; k < 4; k++) ps.push(part(box(0.17, 0.04, 0.17), "#2b2b2b", [0, 0.5 + k * 0.45, 0], [0, k, 0]));
    ps.push(part(ico(0.75), "#9cc65a", [0, 2.5, 0], [0, 0, 0], [1, 1.3, 1]), part(ico(0.5), "#b2d66a", [0.35, 2.95, 0.2]));
    return merge(ps);
  },
  cottageSnow: () => cottage(true),
  cottage: () => cottage(false),
  cypress: () => merge([part(cyl(0.08, 0.1, 0.5), "#5b4334", [0, 0.25, 0]), part(ico(0.5, 1), "#2e4d2c", [0, 1.6, 0], [0, 0, 0], [0.55, 2.7, 0.55])]),
  terracotta() {
    return merge([
      part(box(3, 2.4, 2.6), "#e0ad78", [0, 1.2, 0]),
      part(box(2.9, 1, 1), "#e0ad78", [0, 2.4, 0], [Math.PI / 4, 0, 0]),
      part(box(0.45, 0.7, 0.05), "#4c6a55", [-0.7, 1.5, 1.31]),
      part(box(0.45, 0.7, 0.05), "#4c6a55", [0.7, 1.5, 1.31]),
      part(box(0.6, 1.1, 0.05), "#6a4a35", [0, 0.55, 1.31]),
      ...roofPanels(3.4, 2.8, 2.75, 0.5, "#b5543c", "#a24a35"),
    ]);
  },
  tower: () => merge([
    part(box(1.6, 7, 1.6), "#e7d6b5", [0, 3.5, 0]),
    part(box(0.5, 0.9, 0.05), "#3d342c", [0, 6.1, 0.81]),
    part(box(1.8, 0.2, 1.8), "#d4c19c", [0, 7.0, 0]),
    part(cone(1.3, 1.9, 4), "#b5543c", [0, 8.05, 0], [0, Math.PI / 4, 0]),
  ]),
  olive: () => merge([part(cyl(0.12, 0.18, 1.1, 6), "#6f5a45", [0.1, 0.55, 0], [0, 0, -0.2]), part(ico(0.8), "#8f9d63", [0.2, 1.55, 0], [0, 0, 0], [1.3, 0.8, 1.2]), part(ico(0.5), "#a0ad72", [-0.4, 1.7, 0.2])]),
  rock: () => merge([part(ico(0.6), "#8f8a85", [0, 0.2, 0], [0, 0, 0], [1.3, 0.7, 1])]),
  snowRock: () => merge([part(ico(0.6), "#dfe6ef", [0, 0.15, 0], [0, 0, 0], [1.4, 0.6, 1.1])]),
  cloud: () => merge([
    part(ico(1.2, 1), "#ffffff", [0, 0, 0]),
    part(ico(0.95, 1), "#ffffff", [1.15, 0.15, 0.2]),
    part(ico(0.85, 1), "#f4f8ff", [-1.05, 0.05, -0.2]),
    part(ico(0.75, 1), "#ffffff", [0.25, 0.65, 0]),
  ]),
  tank: () => merge([part(cyl(0.45, 0.45, 0.8, 8), "#3d4249", [0, 0.4, 0])]),
};

function pine(snow) {
  const ps = [part(cyl(0.1, 0.14, 0.8, 6), "#5b4334", [0, 0.4, 0])];
  for (let k = 0; k < 4; k++) {
    const r = 1.05 - k * 0.24, y = 0.95 + k * 0.62;
    ps.push(part(cone(r, 1.3, 7), k % 2 ? (snow ? "#2c5a43" : "#2f6b45") : (snow ? "#336649" : "#3a7a50"), [0, y + 0.3, 0], [0, k, 0]));
    if (snow) ps.push(part(cone(r * 0.62, 0.55, 7), "#f3f7fc", [0, y + 0.72, 0], [0, k, 0]));
  }
  return merge(ps);
}
function cottage(snow) {
  return merge([
    part(box(2.8, 1.7, 2.2), "#a53b2c", [0, 0.85, 0]),
    part(box(2.7, 0.95, 0.95), "#a53b2c", [0, 1.7, 0], [Math.PI / 4, 0, 0]),
    ...[[-1.38, 1.08], [1.38, 1.08], [-1.38, -1.08], [1.38, -1.08]].map(([x, z]) => part(box(0.12, 1.7, 0.12), "#f3f1ea", [x, 0.85, z])),
    part(box(0.5, 1.0, 0.05), "#f3f1ea", [0.6, 0.5, 1.12]),
    part(box(0.45, 0.45, 0.05), snow ? "#ffd27a" : "#cfe0f2", [-0.6, 1.0, 1.12]),
    ...roofPanels(3.2, 2.4, 2.1, 0.65, snow ? "#f4f8fd" : "#3a3f47", snow ? "#e6edf6" : "#30343b"),
  ]);
}

/* ------------------------------------------------------------ flags */
const FLAG_PAINT = {
  bd: (g, w, h) => { g.fillStyle = "#006a4e"; g.fillRect(0, 0, w, h); g.fillStyle = "#f42a41"; g.beginPath(); g.arc(w * 0.45, h / 2, h * 0.3, 0, 7); g.fill(); },
  fi: (g, w, h) => { g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.fillStyle = "#003580"; g.fillRect(w * 0.28, 0, w * 0.18, h); g.fillRect(0, h * 0.38, w, h * 0.24); },
  it: (g, w, h) => { g.fillStyle = "#009246"; g.fillRect(0, 0, w / 3, h); g.fillStyle = "#fff"; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = "#ce2b37"; g.fillRect((2 * w) / 3, 0, w / 3, h); },
  se: (g, w, h) => { g.fillStyle = "#006aa7"; g.fillRect(0, 0, w, h); g.fillStyle = "#fecc00"; g.fillRect(w * 0.3, 0, w * 0.16, h); g.fillRect(0, h * 0.4, w, h * 0.2); },
};
function flag(code, height = 5) {
  const c = document.createElement("canvas");
  c.width = 120; c.height = 75;
  FLAG_PAINT[code](c.getContext("2d"), 120, 75);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  g.add(mesh(cyl(0.05, 0.07, height, 6), new THREE.MeshStandardMaterial({ color: "#c9ccd1", metalness: 0.6, roughness: 0.4 }), [0, height / 2, 0]));
  const geo = new THREE.PlaneGeometry(1.6, 1, 12, 6).translate(0.8, 0, 0);
  const base = geo.attributes.position.array.slice();
  const f = mesh(geo, new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 }), [0.05, height - 0.55, 0]);
  g.add(f);
  g.userData.tick = (t) => {
    const a = geo.attributes.position.array;
    for (let i = 0; i < a.length; i += 3) {
      const u = base[i] / 1.6;
      a[i + 2] = Math.sin(base[i] * 3.2 - t * 5) * 0.14 * u;
      a[i + 1] = base[i + 1] + Math.sin(base[i] * 2 - t * 3) * 0.04 * u;
    }
    geo.attributes.position.needsUpdate = true;
    geo.computeVertexNormals();
  };
  return g;
}

/* ------------------------------------------------------------ landmarks */
function screenTexture(draw) {
  const c = document.createElement("canvas");
  c.width = 256; c.height = 200;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return { tex, redraw: (t) => { draw(c.getContext("2d"), t); tex.needsUpdate = true; } };
}

const LANDMARKS = {
  home(ev) {
    const g = new THREE.Group();
    g.add(mesh(merge([
      part(box(4.6, 0.25, 3.6), "#8d6e4c", [0, 0.12, 0]),
      part(box(4.2, 2.0, 3.2), "#c99d6b", [0, 1.2, 0]),
      part(box(4.0, 1.15, 1.15), "#c99d6b", [0, 2.2, 0], [Math.PI / 4, 0, 0]),
      part(box(0.8, 1.4, 0.06), "#4a3426", [0.6, 0.95, 1.62]),
      part(box(0.6, 0.5, 0.06), "#3a2a1f", [-1.1, 1.4, 1.62]),
      ...roofPanels(4.8, 3.6, 2.7, 0.55, "#8e9aab", "#7f8b9c"),
      // tube well, a fixture of every Bangladeshi village yard
      part(cyl(0.12, 0.14, 1.0, 8), "#2f7d4a", [2.9, 0.5, 1.8]),
      part(box(0.7, 0.06, 0.06), "#2f7d4a", [2.6, 1.0, 1.8], [0, 0, 0.3]),
      part(box(0.5, 0.18, 0.5), "#9a9a9a", [3.05, 0.09, 2.0]),
    ]), propMat));
    return { g, w: 7, h: 3.4 };
  },
  school(ev) {
    const g = new THREE.Group();
    g.add(mesh(box(11, 3.4, 3.2), windowMat(ev.color || "#f2e8cf"), [0, 1.85, 0]));
    g.add(mesh(merge([
      part(box(11.6, 0.3, 3.8), "#9c6b43", [0, 0.15, 0]),
      part(box(11.4, 0.35, 3.5), "#b86b3a", [0, 3.7, 0]),
      part(box(11.2, 0.12, 3.3), "#b86b3a", [0, 2.0, 0]),
      part(box(1.3, 1.9, 0.1), "#5a3b28", [0, 1.25, 1.62]),
      part(box(2.4, 0.15, 1.2), "#a35c34", [0, 2.35, 2.1]),
      part(box(2.6, 0.2, 1.0), "#c9b9a0", [0, 0.1, 2.3]),
    ]), propMat));
    const f = flag(ev.flag, 5.5); f.position.set(-6.8, 0, 2.2); g.add(f);
    return { g, w: 15, h: 4.2 };
  },
  uni(ev) {
    const g = new THREE.Group();
    g.add(mesh(box(14, 6, 4.2), windowMat(ev.color || "#e9ecef"), [0, 3.15, 0]));
    const ped = new THREE.Shape();
    ped.moveTo(-4.9, 0); ped.lineTo(4.9, 0); ped.lineTo(0, 1.7); ped.closePath();
    const parts = [
      part(box(14.6, 0.3, 4.8), "#d8d2c6", [0, 0.15, 0]),
      part(box(14.4, 0.35, 4.5), "#d0c8ba", [0, 6.3, 0]),
      part(box(9.4, 0.5, 1.6), "#f6f3ee", [0, 5.15, 2.75]),
      part(new THREE.ExtrudeGeometry(ped, { depth: 1.4, bevelEnabled: false }).translate(0, 0, -0.7), "#f6f3ee", [0, 5.4, 2.75]),
      ...[0, 1, 2].map((k) => part(box(9.6 - k * 0.6, 0.18, 1.0), "#e3ddd2", [0, 0.09 + k * 0.18, 3.9 - k * 0.3])),
    ];
    for (let k = 0; k < 6; k++) parts.push(part(cyl(0.22, 0.26, 4.6, 10), "#ffffff", [-3.75 + k * 1.5, 2.65, 2.75]));
    g.add(mesh(merge(parts), propMat));
    const f = flag(ev.flag, 3.2); f.position.set(5.6, 6.45, 0); g.add(f);
    return { g, w: 17, h: 9.8 };
  },
  work(ev) {
    const g = new THREE.Group();
    g.add(mesh(box(4.6, 13, 4.4), windowMat("#7fa9c9", true), [0, 6.6, 0]));
    g.add(mesh(merge([
      part(box(4.9, 2.2, 4.7), "#2f3d4c", [0, 1.1, 0]),
      part(box(4.9, 0.6, 4.7), "#2f3b48", [0, 13.4, 0]),
      part(box(2.6, 0.15, 1.6), "#2f3b48", [0, 2.4, 2.9]),
      part(box(1.4, 1.9, 0.08), "#9ad0ff", [0, 0.95, 2.4]),
    ]), propMat));
    const f = flag(ev.flag, 5); f.position.set(3.6, 0, 2.6); g.add(f);
    return { g, w: 8, h: 14 };
  },
  lab(ev) {
    const g = new THREE.Group();
    g.add(mesh(box(11, 4.2, 5), windowMat("#eef1f4"), [0, 2.2, 0]));
    g.add(mesh(merge([
      part(box(11.4, 0.3, 5.4), "#b9c0c8", [0, 0.15, 0]),
      part(box(11.1, 0.5, 5.1), ev.color || "#1c7ed6", [0, 3.9, 0]),
      part(box(2.4, 2.6, 0.12), "#2a3440", [0, 1.4, 2.55]),
      part(box(3.0, 0.15, 1.4), ev.color || "#1c7ed6", [0, 2.85, 3.1]),
      part(cyl(0.08, 0.1, 3.4, 6), "#9aa3ad", [3.6, 5.9, -1]),
      part(cyl(0.45, 0.45, 0.12, 12), "#e9ecef", [3.6, 7.65, -1]),
      part(cyl(0.3, 0.38, 0.6, 8), "#c4cad1", [-2.8, 4.6, 0]),
    ]), propMat));
    const dish = new THREE.Group();
    dish.add(mesh(merge([
      part(new THREE.SphereGeometry(1.1, 16, 6, 0, Math.PI * 2, 0, 0.9), "#f1f3f5", [0, 0, 0], [Math.PI, 0, 0]),
      part(cyl(0.03, 0.03, 1.1, 4), "#9aa3ad", [0, 0.5, 0]),
      part(ico(0.08), "#5c6670", [0, 1.05, 0]),
    ]), propMat));
    dish.position.set(-2.8, 5.4, 0);
    dish.rotation.x = -0.6;
    g.add(dish);
    const led = mesh(new THREE.SphereGeometry(0.12, 8, 6), glowMat("#ff4d4d"), [3.6, 7.85, -1]);
    g.add(led);
    const f = flag(ev.flag, 5); f.position.set(-6.4, 0, 2.6); g.add(f);
    g.userData.tick = (t) => { dish.rotation.y = Math.sin(t * 0.3) * 0.8; led.visible = Math.sin(t * 4) > 0; };
    return { g, w: 14, h: 8.3 };
  },
  arcade(ev) {
    const g = new THREE.Group();
    g.add(mesh(merge([
      part(box(1.6, 3.0, 1.4), "#4b1d8f", [0, 1.5, 0]),
      part(box(1.8, 0.55, 1.5), "#6d2ad6", [0, 3.25, 0]),
      part(box(1.6, 0.25, 0.8), "#2b1050", [0, 1.45, 0.85], [-0.5, 0, 0]),
      part(cyl(0.04, 0.04, 0.3, 5), "#222", [-0.35, 1.7, 0.95]),
      part(ico(0.08), "#ff3b6b", [-0.35, 1.86, 0.95]),
      part(ico(0.07), "#3a86ff", [0.15, 1.62, 1.0]),
      part(ico(0.07), "#ffbe0b", [0.42, 1.62, 1.0]),
    ]), propMat));
    const scr = screenTexture((c, t) => {
      c.fillStyle = "#06020f"; c.fillRect(0, 0, 256, 200);
      c.textAlign = "center"; c.font = "bold 44px 'JetBrains Mono', monospace";
      c.fillStyle = "#ff4d8d"; c.fillText("LIFE 2", 128, 78);
      c.font = "bold 28px 'JetBrains Mono', monospace";
      c.fillStyle = Math.floor(t * 2) % 2 ? "#ffe066" : "#7a6a2a";
      c.fillText("CONTINUE?  " + (9 - (Math.floor(t) % 10)), 128, 140);
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.98), new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false }));
    screen.position.set(0, 2.35, 0.71);
    g.add(screen);
    const marquee = mesh(box(1.6, 0.35, 0.05), glowMat("#ff4fd8"), [0, 3.25, 0.76]);
    g.add(marquee);
    g.scale.setScalar(1.35);
    let last = -1;
    g.userData.tick = (t) => { const k = Math.floor(t * 2); if (k !== last) { last = k; scr.redraw(t); } };
    return { g, w: 5, h: 5.2 };
  },
  airport(ev) {
    const g = new THREE.Group();
    g.add(mesh(box(14, 3.6, 6), windowMat("#a9c6db", true), [0, 1.8, 0]));
    g.add(mesh(merge([
      part(box(15, 0.3, 7), "#d9dde2", [0, 3.75, 0]),
      part(cyl(0.6, 0.8, 9, 10), "#d9dde2", [5.5, 4.5, -1.5]),
      part(cyl(1.35, 1.0, 1.6, 10), "#33475b", [5.5, 9.6, -1.5]),
      part(cone(1.4, 0.7, 10), "#d9dde2", [5.5, 10.75, -1.5]),
    ]), propMat));
    const beacon = mesh(new THREE.SphereGeometry(0.15, 8, 6), glowMat("#ff3b3b"), [5.5, 11.2, -1.5]);
    g.add(beacon);
    g.userData.tick = (t) => { beacon.visible = Math.sin(t * 3) > 0; };
    return { g, w: 16, h: 11.5 };
  },
  remote(ev) {
    const g = new THREE.Group();
    const blades = [];
    for (const [x, z, s] of [[-2.5, -2, 1], [3.5, -7, 0.85]]) {
      const tw = new THREE.Group();
      tw.add(mesh(merge([part(cyl(0.16, 0.32, 10, 8), "#f1f3f5", [0, 5, 0]), part(box(0.9, 0.6, 0.6), "#e9ecef", [0, 10.1, 0])]), propMat));
      const rot = new THREE.Group();
      rot.add(mesh(merge([0, 1, 2].map((k) => part(box(0.22, 4.4, 0.08).translate(0, 2.2, 0), "#f8f9fa", [0, 0, 0], [0, 0, (k * Math.PI * 2) / 3]))), propMat));
      rot.position.set(0, 10.1, 0.38);
      tw.add(rot);
      blades.push(rot);
      tw.position.set(x, 0, z);
      tw.scale.setScalar(s);
      g.add(tw);
    }
    g.add(mesh(cottage(false), propMat, [1, 0, 1]));
    const f = flag(ev.flag, 4); f.position.set(-1.2, 0, 2.8); g.add(f);
    g.userData.tick = (t) => blades.forEach((b, i) => (b.rotation.z = -t * (0.9 + i * 0.2)));
    return { g, w: 10, h: 12 };
  },
  beacon(ev) {
    const g = new THREE.Group();
    g.add(mesh(merge([
      ...[0, 1, 2].map((k) => part(cyl(0.04, 0.04, 2.6, 5), "#5c6670", [Math.cos(k * 2.1) * 0.5, 1.2, Math.sin(k * 2.1) * 0.5], [Math.sin(k * 2.1) * 0.35, 0, -Math.cos(k * 2.1) * 0.35])),
      part(cyl(0.06, 0.06, 1.4, 6), "#5c6670", [0, 2.9, 0]),
      part(cyl(0.7, 0.7, 0.12, 20), "#e9ecef", [0, 3.6, 0]),
      part(cyl(0.55, 0.55, 0.1, 20), "#adb5bd", [0, 3.7, 0]),
      part(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), "#f8f9fa", [0, 3.72, 0]),
    ]), propMat));
    const pin = mesh(new THREE.OctahedronGeometry(0.35, 0), glowMat("#51e3a4"), [0, 5.4, 0]);
    g.add(pin);
    const rings = [0, 1, 2].map(() => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1, 0.03, 6, 48), new THREE.MeshBasicMaterial({ color: "#74e0ff", transparent: true, toneMapped: false, depthWrite: false }));
      r.rotation.x = Math.PI / 2;
      r.position.y = 0.05;
      g.add(r);
      return r;
    });
    g.userData.tick = (t) => {
      pin.rotation.y = t * 1.5;
      pin.position.y = 5.4 + Math.sin(t * 2) * 0.15;
      rings.forEach((r, i) => { const p = (t * 0.45 + i / 3) % 1; r.scale.setScalar(0.6 + p * 7); r.material.opacity = (1 - p) * 0.8; });
    };
    return { g, w: 7, h: 6 };
  },
};

/* ------------------------------------------------------------ collectibles */
function haloTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, "rgba(255,230,150,0.9)");
  r.addColorStop(0.35, "rgba(255,200,90,0.35)");
  r.addColorStop(1, "rgba(255,200,90,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const ICONS = {
  medal: () => merge([
    part(cyl(0.34, 0.34, 0.08, 20), "#e8b84a", [0, 0, 0], [Math.PI / 2, 0, 0]),
    part(cyl(0.22, 0.22, 0.1, 5), "#f6d36b", [0, 0, 0.01], [Math.PI / 2, 0, 0]),
    part(box(0.14, 0.55, 0.04), "#d63a3a", [-0.12, 0.5, -0.02], [0, 0, 0.35]),
    part(box(0.14, 0.55, 0.04), "#1e7bd6", [0.12, 0.5, -0.02], [0, 0, -0.35]),
  ]),
  cap: () => merge([
    part(box(0.7, 0.05, 0.7), "#1f2329", [0, 0.12, 0], [0, Math.PI / 4, 0]),
    part(cyl(0.24, 0.27, 0.22, 10), "#1f2329", [0, -0.02, 0]),
    part(box(0.03, 0.32, 0.03), "#e8b84a", [0.32, -0.02, 0]),
    part(ico(0.05), "#e8b84a", [0.32, -0.2, 0]),
  ]),
  trophy: () => merge([
    part(new THREE.LatheGeometry([[0, -0.1], [0.3, -0.05], [0.36, 0.25], [0.33, 0.42]].map(([x, y]) => new THREE.Vector2(x, y)), 14), "#e8b84a", [0, 0, 0]),
    part(cyl(0.05, 0.08, 0.25, 8), "#e8b84a", [0, -0.22, 0]),
    part(box(0.4, 0.08, 0.28), "#7b5a22", [0, -0.38, 0]),
    part(new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI), "#e8b84a", [-0.35, 0.18, 0], [0, 0, Math.PI / 2]),
    part(new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI), "#e8b84a", [0.35, 0.18, 0], [0, 0, -Math.PI / 2]),
  ]),
  paper: () => merge([
    part(box(0.5, 0.66, 0.03), "#f8f9fa", [0, 0, 0]),
    ...[0, 1, 2, 3].map((k) => part(box(0.34, 0.03, 0.035), "#9aa3ad", [0, 0.16 - k * 0.1, 0])),
    part(box(0.18, 0.05, 0.036), "#d63a3a", [-0.08, 0.26, 0]),
  ]),
  heart: () => {
    const s = new THREE.Shape();
    s.moveTo(0, -0.3); s.bezierCurveTo(-0.45, 0.0, -0.3, 0.38, 0, 0.18); s.bezierCurveTo(0.3, 0.38, 0.45, 0.0, 0, -0.3);
    return merge([part(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }).translate(0, 0, -0.06), "#ff4d6d")]);
  },
  code: () => merge([
    part(box(0.72, 0.5, 0.08), "#1f2329", [0, 0, 0]),
    part(box(0.16, 0.04, 0.09), "#51e3a4", [-0.2, 0.05, 0.01], [0, 0, 0.6]),
    part(box(0.16, 0.04, 0.09), "#51e3a4", [-0.2, -0.05, 0.01], [0, 0, -0.6]),
    part(box(0.04, 0.26, 0.09), "#51e3a4", [0, 0, 0.01], [0, 0, -0.35]),
    part(box(0.16, 0.04, 0.09), "#51e3a4", [0.2, 0.05, 0.01], [0, 0, -0.6]),
    part(box(0.16, 0.04, 0.09), "#51e3a4", [0.2, -0.05, 0.01], [0, 0, 0.6]),
  ]),
};

export { part, merge, box, cyl, cone, ico, mesh, windowMat, glowMat, roofPanels, shinyMat, cloudMat, LIB, LANDMARKS, ICONS, flag, pine, cottage, haloTexture };

