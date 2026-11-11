// Space prologue: fetus in an amniotic bubble, Earth, GNSS satellites acquiring lock, re-entry.
import * as THREE from "three";
import { lerp, smooth, fbm, D, U } from "./util.js";

const TEX = "assets/textures/";
const E = new THREE.Vector3(6, -14, -36), R = 12;

function proceduralEarth() {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 256;
  const g = c.getContext("2d"), img = g.createImageData(512, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 512; x++) {
      const n = fbm(x * 0.018, y * 0.025), k = (y * 512 + x) * 4, land = n > 0.55;
      const lat = Math.abs(y - 128) / 128;
      img.data[k] = land ? (lat > 0.85 ? 235 : 70 + n * 60) : 20;
      img.data[k + 1] = land ? (lat > 0.85 ? 240 : 120 + n * 40) : 70 + n * 30;
      img.data[k + 2] = land ? (lat > 0.85 ? 245 : 60) : 140 + n * 40;
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowSprite(inner, outer) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(1, outer);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
}

export function createSpace() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020309");
  const bgDeep = new THREE.Color("#020309"), bgAir = new THREE.Color("#79b8ee");

  scene.add(new THREE.AmbientLight("#33406a", 0.35));
  const sun = new THREE.DirectionalLight("#fff6e8", 3.2);
  sun.position.set(-30, 12, 18);
  scene.add(sun);

  // stars + a faint galactic band
  const N = 5200, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tint = new THREE.Color();
  for (let i = 0; i < N; i++) {
    let v;
    if (i < 1800) {
      const a = Math.random() * Math.PI * 2, spread = (Math.random() - 0.5) * 0.25;
      v = new THREE.Vector3(Math.cos(a), spread, Math.sin(a)).applyAxisAngle(new THREE.Vector3(1, 0, 0.3).normalize(), 1.1);
    } else v = new THREE.Vector3().randomDirection();
    v.normalize().multiplyScalar(320);
    pos.set([v.x, v.y, v.z], i * 3);
    tint.setHSL(0.55 + Math.random() * 0.2, 0.4, 0.6 + Math.random() * 0.4);
    if (Math.random() < 0.15) tint.setHSL(0.1, 0.6, 0.75);
    col.set([tint.r, tint.g, tint.b], i * 3);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  sg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.6, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false }));
  scene.add(stars);
  for (const [p, c, s] of [[[-120, 60, -250], "rgba(150,90,255,0.5)", 260], [[160, -40, -260], "rgba(40,180,220,0.35)", 300], [[40, 140, -280], "rgba(255,120,170,0.25)", 220]]) {
    const n = glowSprite(c, "rgba(0,0,0,0)");
    n.position.set(...p); n.scale.setScalar(s);
    scene.add(n);
  }

  // Earth
  const earth = new THREE.Group();
  earth.position.copy(E);
  scene.add(earth);
  const earthMat = new THREE.MeshStandardMaterial({ map: proceduralEarth(), roughness: 0.85, metalness: 0, emissive: new THREE.Color("#ffc47a"), emissiveIntensity: 0 });
  earthMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
      #if NUM_DIR_LIGHTS > 0
        totalEmissiveRadiance *= smoothstep(0.1, -0.3, dot(normalize(vNormal), directionalLights[0].direction));
      #endif`);
  };
  const globe = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), earthMat);
  earth.add(globe);
  const cloudMat = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 64, 48), cloudMat);
  earth.add(clouds);
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.12, 64, 48), new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color("#5fb2ff") } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.2); gl_FragColor = vec4(uColor * f * 1.6, f);
#include <colorspace_fragment>
}`,
    side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  earth.add(atmo);

  const loader = new THREE.TextureLoader();
  loader.load(TEX + "earth_atmos_2048.jpg", (t) => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; earthMat.map = t; earthMat.needsUpdate = true; });
  loader.load(TEX + "earth_lights_2048.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; earthMat.emissiveMap = t; earthMat.emissiveIntensity = 1.6; earthMat.needsUpdate = true; });
  loader.load(TEX + "earth_clouds_1024.png", (t) => { t.colorSpace = THREE.SRGBColorSpace; cloudMat.map = t; cloudMat.alphaMap = t; cloudMat.opacity = 0.85; cloudMat.needsUpdate = true; });

  // Bangladesh on the sphere (three.js equirectangular UV convention)
  const home = D.home;
  const phi = ((home.lon + 180) / 360) * Math.PI * 2, theta = ((90 - home.lat) / 180) * Math.PI;
  const homeLocal = new THREE.Vector3(-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta));
  const B0 = new THREE.Vector3(0, 0, 0);
  const toStart = B0.clone().sub(E).normalize();
  const faceRot = Math.atan2(toStart.x, toStart.z) - Math.atan2(homeLocal.x, homeLocal.z);
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 32), new THREE.MeshBasicMaterial({ color: "#ff5c7a", transparent: true, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }));
  marker.position.copy(homeLocal).multiplyScalar(R * 1.01);
  marker.lookAt(homeLocal.clone().multiplyScalar(R * 2));
  globe.add(marker);

  // Bubble + fetus
  const bubble = new THREE.Group();
  scene.add(bubble);
  const shellU = { uHeat: { value: 0 }, uTime: U.time };
  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 64, 48), new THREE.ShaderMaterial({
    uniforms: shellU,
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vP; void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = position; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uHeat, uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
      void main(){
        float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.4);
        float swirl = 0.5 + 0.5 * sin(vP.y * 9.0 + uTime * 1.2 + sin(vP.x * 7.0 - uTime) * 1.5);
        vec3 iri = 0.5 + 0.5 * cos(6.2831 * (f * 1.4 + swirl * 0.15 + vec3(0.0, 0.33, 0.67) + uTime * 0.03));
        vec3 rim = mix(mix(vec3(1.0, 0.62, 0.74), iri, 0.35), vec3(1.0, 0.55, 0.15), uHeat);
        vec3 c = rim * (f * 1.4 + 0.012 + swirl * 0.02) + vec3(1.0, 0.9, 0.95) * pow(f, 7.0);
        gl_FragColor = vec4(c, clamp(f * 0.85 + 0.02, 0.0, 1.0));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  bubble.add(shell);
  const innerGlow = glowSprite("rgba(255,170,190,0.55)", "rgba(255,120,150,0)");
  innerGlow.scale.setScalar(2.6);
  bubble.add(innerGlow);
  bubble.add(new THREE.PointLight("#ff9ab0", 3, 4, 1.5));

  const fetus = new THREE.Group();
  bubble.add(fetus);
  const skin = new THREE.MeshPhysicalMaterial({ color: "#f1bba8", roughness: 0.42, sheen: 1, sheenColor: new THREE.Color("#ff8c7a"), sheenRoughness: 0.45, clearcoat: 0.08, clearcoatRoughness: 0.6, emissive: "#6a2620", emissiveIntensity: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: "#8a4a44", roughness: 0.6 });
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // Tube whose radius follows a profile; `squash` widens it sideways.
  function limbTube(pts, prof, segs = 40, squash = 1) {
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, segs, 1, 14, false), p = g.attributes.position, c = new THREE.Vector3(), q = new THREE.Vector3();
    for (let i = 0; i <= segs; i++) {
      const t = i / segs, rad = prof(t);
      curve.getPointAt(t, c);
      for (let j = 0; j <= 14; j++) {
        const k = i * 15 + j;
        q.fromBufferAttribute(p, k).sub(c).multiplyScalar(rad);
        q.z *= squash;
        p.setXYZ(k, c.x + q.x, c.y + q.y, c.z + q.z);
      }
    }
    g.computeVertexNormals();
    return g;
  }
  const mk = (geo, mat = skin, parent = fetus) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
  const bump = (a, b, c, d, t) => (t < b ? THREE.MathUtils.lerp(a, c, Math.sin((t / b) * Math.PI / 2)) : THREE.MathUtils.lerp(c, d, (t - b) / (1 - b)));
  // curled spine: neck → rounded back → rump
  mk(limbTube([V(0.1, 0.1, 0), V(-0.1, 0.02, 0), V(-0.17, -0.15, 0), V(-0.1, -0.31, 0), V(0.05, -0.36, 0)], (t) => bump(0.085, 0.5, 0.168, 0.085, t), 48, 1.12));
  mk(new THREE.SphereGeometry(0.085, 16, 12)).position.set(0.05, -0.36, 0);
  const head = new THREE.Group();
  head.position.set(0.17, 0.27, 0);
  fetus.add(head);
  const skull = mk(new THREE.SphereGeometry(0.2, 32, 24), skin, head);
  skull.scale.set(1, 0.94, 0.9);
  for (const zs of [1, -1]) {
    const lid = mk(new THREE.TorusGeometry(0.028, 0.0055, 6, 14, Math.PI), dark, head);
    lid.position.set(0.17, 0.0, zs * 0.075); lid.rotation.set(0, Math.PI / 2, Math.PI);
  }
  mk(new THREE.SphereGeometry(0.026, 12, 8), skin, head).position.set(0.2, -0.06, 0);
  const ear = mk(new THREE.SphereGeometry(0.04, 12, 8), skin, head);
  ear.position.set(-0.03, -0.02, 0.17); ear.scale.set(0.8, 1.1, 0.4);
  // arms (near arm brings the thumb to the mouth)
  const arms = [1, -1].map((zs) => {
    const g = new THREE.Group(); g.position.set(0.06, 0.07, zs * 0.12); fetus.add(g);
    mk(limbTube([V(0, 0, 0), V(0.1, -0.08, zs * 0.03), V(0.2, 0.0, zs * 0.0), V(0.24, zs > 0 ? 0.1 : 0.05, -zs * 0.06)], (t) => 0.042 - t * 0.012, 20), skin, g);
    const hand = mk(new THREE.SphereGeometry(0.038, 12, 10), skin, g);
    hand.position.set(0.25, zs > 0 ? 0.11 : 0.06, -zs * 0.07); hand.scale.set(1, 0.8, 1.1);
    return g;
  });
  // legs folded with knees to the chest
  const legs = [1, -1].map((zs) => {
    const g = new THREE.Group(); g.position.set(-0.03, -0.27, zs * 0.1); fetus.add(g);
    mk(limbTube([V(0, 0, 0), V(0.14, 0.06, zs * 0.02), V(0.24, 0.1, zs * 0.03)], (t) => 0.07 - t * 0.02, 16), skin, g);
    mk(limbTube([V(0.24, 0.1, zs * 0.03), V(0.2, -0.04, zs * 0.03), V(0.14, -0.12, zs * 0.02)], (t) => 0.05 - t * 0.012, 16), skin, g);
    const foot = mk(new THREE.CapsuleGeometry(0.03, 0.06, 4, 8), skin, g);
    foot.position.set(0.17, -0.14, zs * 0.02); foot.rotation.z = Math.PI / 2;
    return g;
  });
  const cordCurve = new THREE.CatmullRomCurve3([[0.12, -0.14, 0.02], [0.02, -0.4, 0.16], [-0.34, -0.5, 0.05], [-0.62, -0.62, -0.18]].map((p) => new THREE.Vector3(...p)));
  const cord = new THREE.Mesh(new THREE.TubeGeometry(cordCurve, 40, 0.026, 8), new THREE.MeshPhysicalMaterial({ color: "#e7909c", roughness: 0.3, clearcoat: 0.8, emissive: "#5a1a28", emissiveIntensity: 0.35 }));
  fetus.add(cord);
  // floating motes in the amniotic fluid
  const motePos = new Float32Array(140 * 3);
  for (let i = 0; i < 140; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * 0.88); motePos.set([v.x, v.y, v.z], i * 3); }
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute("position", new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ color: "#ffd6e0", size: 0.012, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  bubble.add(motes);

  // GNSS satellites
  const satMat = {
    gold: new THREE.MeshStandardMaterial({ color: "#d9a948", metalness: 0.85, roughness: 0.3 }),
    panel: new THREE.MeshStandardMaterial({ color: "#26407f", metalness: 0.4, roughness: 0.35, emissive: "#0b1a44", emissiveIntensity: 0.6 }),
    white: new THREE.MeshStandardMaterial({ color: "#e9ecef", roughness: 0.5 }),
  };
  const ringTex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const g = c.getContext("2d"); g.strokeStyle = "rgba(120,230,255,1)"; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 56, 0, 7); g.stroke();
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const sats = [];
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.7), satMat.gold));
    for (const z of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.4), satMat.panel);
      p.position.z = z * 1.1; s.add(p);
    }
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.18, 12, 1, true), satMat.white);
    dish.position.x = 0.32; dish.rotation.z = Math.PI / 2; s.add(dish);
    const ping = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    s.add(ping);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const lineMat = new THREE.ShaderMaterial({
      uniforms: { uTime: U.time, uA: { value: 0 } },
      vertexShader: `attribute float lineDistance; varying float vD; void main(){ vD = lineDistance; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uTime, uA; varying float vD; void main(){ if (fract(vD * 0.7 - uTime * 2.0) > 0.5) discard; gl_FragColor = vec4(vec3(0.45, 0.9, 1.0) * uA, uA); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const line = new THREE.Line(lineGeo, lineMat);
    line.frustumCulled = false;
    scene.add(s, line);
    s.scale.setScalar(0.8);
    sats.push({ s, ping, line, lineMat, r: 19 + (i % 3) * 3, inc: 0.3 + i * 0.37, raan: i * 1.05, speed: 0.05 + (i % 4) * 0.012, ph: i * 1.7, lockAt: 0.12 + i * 0.065, locked: false, pingT: 1 });
  }

  // re-entry plasma
  const PN = 260, ppos = new Float32Array(PN * 3), pvel = new Float32Array(PN * 3), plife = new Float32Array(PN);
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
  pg.setAttribute("life", new THREE.BufferAttribute(plife, 1));
  const plasma = new THREE.Points(pg, new THREE.ShaderMaterial({
    vertexShader: `attribute float life; varying float vL; void main(){ vL = life; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = (14.0 * life + 2.0) * (6.0 / -mv.z); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vL; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)) * vL; vec3 c = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.9, 0.55), vL); gl_FragColor = vec4(c * a, a);
#include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  plasma.frustumCulled = false;
  scene.add(plasma);
  let pIdx = 0;

  const tmp = new THREE.Vector3(), target = new THREE.Vector3(), back = new THREE.Vector3(), look = new THREE.Vector3(), eu = new THREE.Euler();
  const camPos = new THREE.Vector3(1.5, 0.5, 6), camLook = new THREE.Vector3(-1.5, 0.1, 0);

  function update(p, t, dt, camera, mouse, reduced) {
    const d = smooth(0.55, 0.9, p);
    const ease = d * d * (3 - 2 * d);
    earth.rotation.y = faceRot - (1 - smooth(0, 0.6, p)) * 1.6 - Math.sin(t * 0.05) * 0.02 * (1 - d);
    clouds.rotation.y = t * 0.01;

    const homeWorld = tmp.copy(homeLocal).applyAxisAngle(new THREE.Vector3(0, 1, 0), earth.rotation.y).multiplyScalar(R * 1.03).add(E);
    target.copy(homeWorld);
    const float = new THREE.Vector3(Math.sin(t * 0.6) * 0.08, Math.sin(t * 0.9) * 0.1, 0).multiplyScalar(1 - d);
    bubble.position.copy(B0).lerp(target, ease * 0.985).add(float);
    const grow = smooth(0, 0.5, p);
    fetus.scale.setScalar(lerp(0.3, 0.92, grow));
    fetus.rotation.set(Math.sin(t * 0.31) * 0.1, -0.6 + Math.sin(t * 0.22) * 0.35, Math.sin(t * 0.27) * 0.08);
    head.scale.setScalar(lerp(1.25, 1, grow));
    head.rotation.z = -0.3 + Math.sin(t * 0.7) * 0.05;
    for (const l of [...arms, ...legs]) l.scale.setScalar(lerp(0.45, 1, grow));
    arms[0].rotation.z = Math.sin(t * 0.9) * 0.08;
    arms[1].rotation.z = Math.sin(t * 0.6 + 1) * 0.12;
    const kickT = (t % 4.3) / 4.3, kick = kickT > 0.82 ? Math.sin(((kickT - 0.82) / 0.18) * Math.PI) : 0;
    legs[0].rotation.z = -kick * 0.55;
    legs[1].rotation.z = -Math.max(0, Math.sin(t * 0.8)) * 0.08;
    const heart = Math.exp(-((t * 2.33) % 1) * 7);
    skin.emissiveIntensity = 0.22 + heart * 0.18;
    fetus.scale.y *= 1 + Math.sin(t * 1.6) * 0.012;
    motes.rotation.set(t * 0.03, t * 0.05, 0);
    cord.rotation.x = Math.sin(t * 0.8) * 0.06;
    const beat = (t * 1.25) % 1;
    shell.scale.setScalar(1 + Math.exp(-beat * 8) * 0.025);
    innerGlow.material.opacity = 0.6 + Math.exp(-beat * 6) * 0.4;
    marker.material.opacity = smooth(0.45, 0.6, p) * (0.6 + 0.4 * Math.sin(t * 5));

    // satellites
    let locked = 0;
    sats.forEach((o) => {
      const a = o.ph + t * o.speed;
      o.s.position.set(Math.cos(a) * o.r, 0, Math.sin(a) * o.r).applyEuler(eu.set(o.inc, o.raan, 0)).add(E);
      o.s.lookAt(E);
      const isLocked = p >= o.lockAt && d < 0.75;
      if (isLocked && !o.locked) o.pingT = 0;
      o.locked = isLocked;
      if (isLocked) locked++;
      o.pingT = Math.min(1, o.pingT + dt * 1.2);
      o.ping.material.opacity = (1 - o.pingT) * 0.9;
      o.ping.scale.setScalar(0.5 + o.pingT * 5);
      const la = isLocked ? smooth(o.lockAt, o.lockAt + 0.04, p) * (1 - smooth(0.6, 0.75, d)) : 0;
      o.lineMat.uniforms.uA.value = la * 0.85;
      o.line.visible = la > 0.01;
      if (o.line.visible) {
        const arr = o.line.geometry.attributes.position.array;
        arr[0] = o.s.position.x; arr[1] = o.s.position.y; arr[2] = o.s.position.z;
        arr[3] = bubble.position.x; arr[4] = bubble.position.y; arr[5] = bubble.position.z;
        o.line.geometry.attributes.position.needsUpdate = true;
        o.line.computeLineDistances();
      }
    });

    // heat + plasma
    const heat = smooth(0.62, 0.72, p) * (1 - smooth(0.86, 0.92, p));
    shellU.uHeat.value = heat;
    back.copy(B0).sub(target).normalize();
    if (heat > 0.02 && !reduced) {
      for (let k = 0; k < 6; k++) {
        const i = pIdx++ % PN;
        tmp.randomDirection().multiplyScalar(0.9).add(bubble.position).addScaledVector(back, -0.6);
        ppos.set([tmp.x, tmp.y, tmp.z], i * 3);
        const v = back.clone().multiplyScalar(6 + Math.random() * 6).add(new THREE.Vector3().randomDirection().multiplyScalar(1.2));
        pvel.set([v.x, v.y, v.z], i * 3);
        plife[i] = heat;
      }
    }
    for (let i = 0; i < PN; i++) {
      if (plife[i] <= 0) continue;
      plife[i] = Math.max(0, plife[i] - dt * 1.6);
      ppos[i * 3] += pvel[i * 3] * dt; ppos[i * 3 + 1] += pvel[i * 3 + 1] * dt; ppos[i * 3 + 2] += pvel[i * 3 + 2] * dt;
    }
    pg.attributes.position.needsUpdate = true;
    pg.attributes.life.needsUpdate = true;

    // camera: slow orbit, then chase the bubble down
    const orbit = lerp(0.25, -0.2, smooth(0, 0.55, p));
    const dist = lerp(6.2, 4.4, smooth(0, 0.55, p));
    const pre = new THREE.Vector3(Math.sin(orbit) * dist, 0.5, Math.cos(orbit) * dist).add(bubble.position);
    const chase = bubble.position.clone().addScaledVector(back, lerp(4.0, 2.6, ease)).add(new THREE.Vector3(0, 0.8, 0));
    const want = pre.lerp(chase, smooth(0.5, 0.65, p));
    if (!reduced) want.add(new THREE.Vector3(mouse.x * 0.5, -mouse.y * 0.3, 0).multiplyScalar(1 - d));
    camPos.lerp(want, 1 - Math.exp(-dt * 5));
    look.copy(bubble.position).add(new THREE.Vector3(-1.5, 0.1, 0).multiplyScalar(1 - smooth(0.5, 0.7, p)));
    look.lerp(target, smooth(0.55, 0.8, p) * 0.35);
    camLook.lerp(look, 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    camera.fov = lerp(42, 52, heat);
    camera.updateProjectionMatrix();
    if (heat > 0 && !reduced) camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(heat * 0.03));
    scene.background.copy(bgDeep).lerp(bgAir, smooth(0.8, 0.92, p));

    const weeks = Math.max(1, Math.round(smooth(0, 0.85, p) * 40));
    return { locked, weeks, d, home };
  }
  return { scene, update };
}
