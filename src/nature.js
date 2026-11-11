// Sky + lighting, GPU grass with wind and player interaction, swaying trees, aurora, snow.
import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import { U, rng, fbm } from "./util.js";
import { LIB, part, merge, cyl, ico, propMat } from "./kit.js";

/* ------------------------------------------------------------ sky & light */
export function createAtmosphere(scene, renderer, map, lowPower) {
  const env = map.env;
  const far = Math.max(env.fogFar * 1.5, 1100);
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - env.elevation), THREE.MathUtils.degToRad(env.azimuth));
  // Lightweight gradient dome for display; the physical sky is only used once for lighting.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(far * 0.9, 32, 16), new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color(env.skyTop) }, uHor: { value: new THREE.Color(env.skyHor) }, uSun: { value: sunDir.clone() }, uSunCol: { value: new THREE.Color(env.night ? "#c9d8ff" : "#fff1d0") }, uNight: { value: env.night ? 1 : 0 } },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uTop, uHor, uSun, uSunCol; uniform float uNight; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec3 c = mix(uHor, uTop, pow(smoothstep(-0.02, 0.6, d.y), 0.6));
        c = mix(c, uHor * 0.8, smoothstep(0.0, -0.2, d.y));
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 600.0) * 4.0 + pow(s, 12.0) * 0.25 + pow(s, 3.0) * 0.08) * (1.0 - uNight * 0.7);
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  // image-based lighting from the same sky
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(100);
  Object.assign(envSky.material.uniforms.turbidity, { value: env.turbidity });
  envSky.material.uniforms.rayleigh.value = env.rayleigh;
  envSky.material.uniforms.sunPosition.value.copy(sunDir);
  envScene.add(envSky);
  if (env.night) envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: "#1b2a4a", side: THREE.BackSide, transparent: true, opacity: 0.6 })));
  scene.environment = pmrem.fromScene(envScene, 0.04).texture;
  scene.environmentIntensity = env.night ? 0.55 : 0.9;
  pmrem.dispose();

  scene.fog = new THREE.Fog(env.fog, env.fogNear, env.fogFar);
  const night = !!env.night;
  const hemi = new THREE.HemisphereLight(night ? "#5a74b0" : "#dfeaff", night ? "#2a3550" : "#6b6040", night ? 0.55 : 0.6);
  const sun = new THREE.DirectionalLight(night ? "#a9c1ff" : "#fff1dc", night ? 1.0 : 3.2);
  const lightDir = night ? new THREE.Vector3(-0.4, 0.75, 0.5).normalize() : sunDir.clone().setY(Math.max(sunDir.y, 0.18)).normalize();
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowPower ? 1024 : 1536, lowPower ? 1024 : 1536);
  Object.assign(sun.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, near: 1, far: 260 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.05;
  scene.add(hemi, sun, sun.target);

  let stars = null, aurora = null;
  if (night) {
    const n = 2500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) * 0.9 + 0.05; v.normalize().multiplyScalar(1800); p.set([v.x, v.y, v.z], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    stars = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 1.4, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    scene.add(stars);
  }
  if (env.aurora) { aurora = createAurora(); scene.add(aurora); }

  function update(focus) {
    sun.position.copy(focus).addScaledVector(lightDir, 140);
    sun.target.position.copy(focus);
    sky.position.copy(focus);
    if (stars) stars.position.copy(focus);
    if (aurora) aurora.position.set(focus.x, 120, focus.z - 520);
  }
  return { update, sun, sky, exposure: env.exposure, far };
}

function createAurora() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.time },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    vertexShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main() {
        vUv = uv; vec3 p = position;
        p.z += sin(p.x * 0.006 + uTime * 0.12) * 90.0 + sin(p.x * 0.017 - uTime * 0.2) * 25.0;
        p.y += sin(p.x * 0.004 + uTime * 0.1) * 20.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      void main() {
        float f = smoothstep(0.0, 0.15, vUv.y) * (1.0 - smoothstep(0.3, 1.0, vUv.y));
        float bands = 0.5 + 0.5 * sin(vUv.x * 90.0 + uTime * 0.5 + sin(vUv.x * 13.0 + uTime * 0.25) * 3.0);
        float edge = smoothstep(0.0, 0.15, vUv.x) * (1.0 - smoothstep(0.85, 1.0, vUv.x));
        vec3 c = mix(vec3(0.1, 1.0, 0.55), vec3(0.65, 0.3, 1.0), smoothstep(0.25, 0.95, vUv.y));
        gl_FragColor = vec4(c * f * bands * edge * 0.9, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2200, 260, 220, 1), mat);
  m.rotation.x = -0.25;
  m.frustumCulled = false;
  return m;
}

/* ------------------------------------------------------------ grass */
export function createGrass(hf, heightTex, cfg, lowPower) {
  if (!cfg) return null;
  const R = lowPower ? 15 : 22, count = lowPower ? 16000 : 55000;
  const blade = new THREE.PlaneGeometry(0.045, 1, 1, 4);
  blade.translate(0, 0.5, 0);
  const bp = blade.attributes.position;
  for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.85)); }
  const geo = new THREE.InstancedBufferGeometry().copy(blade);
  const off = new Float32Array(count * 2), rnd = new Float32Array(count * 3), r = rng(5);
  for (let i = 0; i < count; i++) { off[i * 2] = (r() * 2 - 1) * R; off[i * 2 + 1] = (r() * 2 - 1) * R; rnd.set([r(), r(), r()], i * 3); }
  geo.setAttribute("aOff", new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute("aRnd", new THREE.InstancedBufferAttribute(rnd, 3));
  geo.instanceCount = count;

  const uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
    uCenter: { value: new THREE.Vector2() }, uPlayer: { value: new THREE.Vector3() }, uR: { value: R },
    uHeightTex: { value: heightTex }, uHalf: { value: hf.half }, uSize: { value: hf.map.size }, uN: { value: hf.N },
    uBase: { value: new THREE.Color(cfg.base) }, uTip: { value: new THREE.Color(cfg.tip) }, uH: { value: cfg.height },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4) }, uTime: U.time,
  }]);
  const mat = new THREE.ShaderMaterial({
    uniforms, fog: true, side: THREE.DoubleSide,
    vertexShader: /* glsl */ `
      attribute vec2 aOff; attribute vec3 aRnd;
      uniform vec2 uCenter; uniform vec3 uPlayer; uniform float uR, uHalf, uSize, uN, uH, uTime;
      uniform sampler2D uHeightTex;
      varying float vY; varying float vShade;
      #include <fog_pars_vertex>
      void main() {
        vec2 rel = mod(aOff - uCenter + uR, 2.0 * uR) - uR;
        vec2 wxz = uCenter + rel;
        vec2 uv = (wxz + uHalf) / uSize * ((uN - 1.0) / uN) + 0.5 / uN;
        vec4 hm = texture2D(uHeightTex, uv);
        float keep = step(aRnd.x, hm.g);
        float fade = 1.0 - smoothstep(0.65, 1.0, length(rel) / uR);
        float h = uH * (0.55 + aRnd.y * 0.9) * keep * fade;
        vec3 p = position;
        float a = aRnd.z * 6.2831;
        p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz;
        float y = position.y;
        float gust = sin(uTime * 1.7 + wxz.x * 0.11 + wxz.y * 0.07) * 0.5 + sin(uTime * 3.1 + wxz.x * 0.37) * 0.2;
        vec2 bend = vec2(0.35 + gust * 0.45, 0.12) * y * y;
        vec2 away = wxz - uPlayer.xz;
        float push = (1.0 - smoothstep(0.2, 1.4, length(away))) * step(uPlayer.y - 1.0, hm.r);
        bend += normalize(away + 1e-4) * push * 1.1 * y;
        vec3 wp = vec3(wxz.x + p.x + bend.x * h, hm.r + y * h * (1.0 - push * 0.4), wxz.y + p.z + bend.y * h);
        vY = y; vShade = 0.8 + aRnd.y * 0.35;
        vec4 mvPosition = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase, uTip; varying float vY; varying float vShade;
      #include <fog_pars_fragment>
      void main() {
        vec3 c = mix(uBase, uTip, smoothstep(0.0, 1.0, vY)) * vShade;
        c *= 0.55 + 0.6 * vY;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return {
    mesh,
    update(focus) {
      uniforms.uCenter.value.set(focus.x, focus.z);
      uniforms.uPlayer.value.copy(focus);
    },
  };
}

/* ------------------------------------------------------------ trees & props */
const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92 });
const swayMats = new Map();
function sway(mat, amount) {
  const key = mat.uuid + amount;
  if (swayMats.has(key)) return swayMats.get(key);
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = U.time;
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform float uTime;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = instanceMatrix[3].xyz;
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sw = sin(uTime * 1.3 + ip.x * 0.3 + ip.z * 0.2) + sin(uTime * 2.3 + ip.z * 0.5) * 0.4;
        float k = max(transformed.y - 1.0, 0.0) * ${amount.toFixed(3)};
        transformed.x += sw * k; transformed.z += sw * k * 0.5;`);
  };
  swayMats.set(key, m);
  return m;
}

function broadleaf(seed) {
  const r = rng(seed), ps = [part(cyl(0.18, 0.32, 3.4, 8), "#5a4433", [0, 1.7, 0])];
  ps.push(part(cyl(0.08, 0.12, 1.6, 6), "#5a4433", [0.5, 3.2, 0], [0, 0, -0.7]));
  const greens = ["#3f6e2a", "#4d7f33", "#355f25", "#5a8c3a"];
  for (let k = 0; k < 6; k++) {
    const a = r() * Math.PI * 2, d = 0.6 + r() * 1.5, y = 3.7 + r() * 2.0;
    ps.push(part(ico(1.15 + r() * 0.9, 0), greens[k % 4], [Math.cos(a) * d, y, Math.sin(a) * d], [r(), r(), r()], [1, 0.8, 1]));
  }
  return merge(ps);
}
function bamboo() {
  const ps = [];
  for (let k = 0; k < 7; k++) {
    const a = k * 0.9, x = Math.cos(a) * 0.5, z = Math.sin(a) * 0.5, h = 5 + (k % 3);
    ps.push(part(cyl(0.05, 0.07, h, 5), "#7c9a3d", [x, h / 2, z], [Math.sin(a) * 0.08, 0, Math.cos(a) * 0.08]));
    ps.push(part(ico(0.7, 0), "#5f8f34", [x * 1.6, h, z * 1.6], [0, 0, 0], [1, 1.4, 1]));
  }
  return merge(ps);
}
function boulder() { return merge([part(ico(1, 1), "#7d7a74", [0, 0.3, 0], [0.3, 0.7, 0], [1.4, 0.8, 1.1])]); }

const KINDS = {
  broadleaf: { geo: () => broadleaf(3), mat: foliageMat, sway: 0.02, col: 0.45, h: [0.9, 1.5] },
  broadleaf2: { geo: () => broadleaf(9), mat: foliageMat, sway: 0.02, col: 0.45, h: [0.8, 1.3] },
  palm: { geo: () => LIB.palm(), mat: propMat, sway: 0.03, col: 0.25, h: [1.4, 2.2] },
  banana: { geo: () => LIB.banana(), mat: propMat, sway: 0.05, col: 0.2, h: [1.1, 1.5] },
  bamboo: { geo: bamboo, mat: foliageMat, sway: 0.04, col: 0.4, h: [0.9, 1.2] },
  hut: { geo: () => LIB.hut(), mat: propMat, sway: 0, box: [1.7, 1.4], h: [1, 1.2] },
  haystack: { geo: () => LIB.haystack(), mat: propMat, sway: 0, col: 0.8, h: [0.9, 1.2] },
  pineSnow: { geo: () => LIB.pineSnow(), mat: propMat, sway: 0.01, col: 0.35, h: [1.6, 3.2] },
  pine: { geo: () => LIB.pine(), mat: propMat, sway: 0.01, col: 0.35, h: [1.6, 3] },
  birch: { geo: () => LIB.birch(), mat: propMat, sway: 0.03, col: 0.2, h: [1.3, 2] },
  cottage: { geo: () => LIB.cottageSnow(), mat: propMat, sway: 0, box: [1.6, 1.3], h: [1.2, 1.5] },
  cypress: { geo: () => LIB.cypress(), mat: propMat, sway: 0.015, col: 0.3, h: [1.6, 2.4] },
  olive: { geo: () => LIB.olive(), mat: propMat, sway: 0.02, col: 0.35, h: [1.2, 1.8] },
  boulder: { geo: boulder, mat: propMat, sway: 0, col: 1.0, h: [0.7, 2.2] },
  snowRock: { geo: () => LIB.snowRock(), mat: propMat, sway: 0, col: 0.8, h: [1, 2.5] },
};
const SCATTER = {
  bd: { village: [["palm", 0.003], ["banana", 0.003], ["bamboo", 0.001], ["hut", 0.0012], ["haystack", 0.001], ["broadleaf", 0.0012]],
    wild: [["broadleaf", 0.0006], ["broadleaf2", 0.0005], ["palm", 0.0004], ["bamboo", 0.0002]] },
  fi: { village: [["pineSnow", 0.002], ["birch", 0.001], ["cottage", 0.0004]], wild: [["pineSnow", 0.0022], ["birch", 0.0004], ["snowRock", 0.0003], ["cottage", 0.0001]] },
  it: { village: [["cypress", 0.0016], ["olive", 0.0016]], wild: [["olive", 0.0006], ["cypress", 0.0004], ["boulder", 0.0004], ["broadleaf2", 0.0002]] },
};

export function scatterNature(scene, hf, colliders, avoid) {
  const map = hf.map, rules = SCATTER[map.id], r = rng(map.seed * 7 + 1), half = hf.half - 40;
  const area = (half * 2) ** 2, dummy = new THREE.Object3D(), buckets = {};
  const blocked = (x, z, pad) => avoid.some((a) => Math.abs(x - a.x) < a.hw + pad && Math.abs(z - a.z) < a.hd + pad);
  const jobs = [...rules.wild.map(([t, d]) => [t, d, null]), ...rules.village.flatMap(([t, d]) =>
    map.zones.filter((zn) => ["village", "nordic", "italian"].includes(zn.kind)).map((zn) => [t, d, zn]))];
  for (const [type, dens, zone] of jobs) {
    const n = Math.round((zone ? Math.PI * zone.r * zone.r : area) * dens);
    for (let k = 0; k < n; k++) {
      let x, z;
      if (zone) { const a = r() * 6.283, d = Math.sqrt(r()) * zone.r; x = zone.c[0] + Math.cos(a) * d; z = zone.c[1] + Math.sin(a) * d; }
      else { x = (r() * 2 - 1) * half; z = (r() * 2 - 1) * half; }
      const zn = hf.zoneAt(x, z);
      if (!zone && zn && Math.hypot(x - zn.c[0], z - zn.c[1]) < zn.r * 0.85) continue;
      if (zone && zn && zn.kind !== "village" && Math.hypot(x - zn.c[0], z - zn.c[1]) < zn.r * 0.6) continue;
      if (hf.waterMask(x, z) > 0.02 || hf.roadMask(x, z) > 0.02) continue;
      const cluster = fbm(x * 0.012 + map.seed, z * 0.012);
      if (!zone && cluster < 0.48) continue;
      const y = hf.heightAt(x, z);
      if (y > 70 || hf.normalAt(x, z).y < 0.8) continue;
      if (blocked(x, z, 4)) continue;
      (buckets[`${type}|${Math.floor(x / 160)}|${Math.floor(z / 160)}`] ||= []).push({ x, y, z, s: 0, ry: r() * 6.28, rr: r() });
    }
  }
  const geos = {}, tiles = [];
  for (const [key, list] of Object.entries(buckets)) {
    const type = key.split("|")[0], K = KINDS[type];
    const im = new THREE.InstancedMesh((geos[type] ||= K.geo()), K.sway ? sway(K.mat, K.sway) : K.mat, list.length);
    list.forEach((o, i) => {
      const s = K.h[0] + o.rr * (K.h[1] - K.h[0]);
      dummy.position.set(o.x, o.y - 0.1, o.z);
      dummy.rotation.set(0, K.box ? Math.round(o.ry / (Math.PI / 2)) * (Math.PI / 2) : o.ry, 0);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (K.box) colliders.addBox(o.x, o.z, K.box[0] * s, K.box[1] * s, dummy.rotation.y, o.y + 4 * s);
      else if (K.col) colliders.addCircle(o.x, o.z, K.col * s, o.y + 6 * s);
    });
    im.castShadow = im.receiveShadow = true;
    im.computeBoundingSphere();
    im.userData.tile = im.boundingSphere.center.clone();
    scene.add(im);
    tiles.push(im);
  }
  return tiles;
}

/* ------------------------------------------------------------ snowfall */
export function createSnow(scene) {
  const n = 3000, p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) p.set([Math.random() * 80 - 40, Math.random() * 30, Math.random() * 80 - 40], i * 3);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: "#ffffff", size: 0.07, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.frustumCulled = false;
  scene.add(pts);
  return (focus, dt, t) => {
    for (let i = 0; i < n; i++) {
      let x = p[i * 3], y = p[i * 3 + 1] - dt * (1 + (i % 7) * 0.15), z = p[i * 3 + 2];
      x += Math.sin(t * 0.7 + i) * dt * 0.4;
      if (y < -2) y += 30;
      x = focus.x - 40 + ((((x - (focus.x - 40)) % 80) + 80) % 80);
      z = focus.z - 40 + ((((z - (focus.z - 40)) % 80) + 80) % 80);
      p[i * 3] = x; p[i * 3 + 1] = y; p[i * 3 + 2] = z;
    }
    pts.position.y = focus.y - 6;
    g.attributes.position.needsUpdate = true;
  };
}
