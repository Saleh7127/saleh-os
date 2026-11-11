// Drivable vehicles (car, motorbike, CNG auto-rickshaw), arcade physics, and the airliner model.
import * as THREE from "three";
import { clamp, damp } from "./util.js";

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
const paint = (color) => new THREE.MeshPhysicalMaterial({ color, metalness: 0.55, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.06 });
const glass = new THREE.MeshPhysicalMaterial({ color: "#0e1822", metalness: 0.3, roughness: 0.04, clearcoat: 1, envMapIntensity: 2, transparent: true, opacity: 0.55 });
const rubber = std("#141518", { roughness: 0.9 });
const chrome = std("#d9dde2", { metalness: 1, roughness: 0.18 });
const lamp = (c) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 2.2, roughness: 0.3 });

function M(geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p); m.rotation.set(...r); m.scale.set(...s);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Extrude a side profile (x forward, y up) to a given width; result faces +z.
function profile(pts, width, bevel = 0.07) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 8 });
  g.translate(0, 0, -(width - bevel * 2) / 2);
  g.rotateY(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}
function wheel(r, w, rimColor = "#c9ced4") {
  const g = new THREE.Group();
  g.add(M(new THREE.CylinderGeometry(r, r, w, 24), rubber, [0, 0, 0], [0, 0, Math.PI / 2]));
  g.add(M(new THREE.CylinderGeometry(r * 0.62, r * 0.62, w + 0.02, 12), std(rimColor, { metalness: 0.9, roughness: 0.25 }), [0, 0, 0], [0, 0, Math.PI / 2]));
  for (let k = 0; k < 5; k++) g.add(M(new THREE.BoxGeometry(w + 0.04, r * 1.1, 0.05), std("#8d949c", { metalness: 0.9, roughness: 0.3 }), [0, 0, 0], [(k / 5) * Math.PI, 0, 0]));
  return g;
}
// Thin spoked motorcycle wheel: torus tyre, rim, hub and wire spokes; spins about x.
function spokedWheel(r) {
  const g = new THREE.Group();
  g.add(M(new THREE.TorusGeometry(r - 0.055, 0.055, 10, 32), rubber, [0, 0, 0], [0, Math.PI / 2, 0]));
  g.add(M(new THREE.TorusGeometry(r - 0.11, 0.014, 6, 32), chrome, [0, 0, 0], [0, Math.PI / 2, 0]));
  g.add(M(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 12), chrome, [0, 0, 0], [0, 0, Math.PI / 2]));
  const spoke = new THREE.CylinderGeometry(0.005, 0.005, r - 0.12, 4);
  spoke.translate(0, (r - 0.12) / 2, 0);
  for (let k = 0; k < 16; k++) g.add(M(spoke, chrome, [k % 2 ? 0.03 : -0.03, 0, 0], [(k / 16) * Math.PI * 2, 0, 0]));
  return g;
}
// Cylinder spanning two points.
function tube(a, b, r, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = M(new THREE.CylinderGeometry(r, r, d.length(), 10), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}
const marker = (parent, p) => { const o = new THREE.Object3D(); o.position.set(...p); parent.add(o); return o; };

function carModel(color = "#b3202a") {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const p = paint(color);
  body.add(M(profile([[-2.25, 0.32], [2.2, 0.32], [2.32, 0.55], [2.2, 0.82], [1.15, 0.96], [-1.75, 1.0], [-2.28, 0.92], [-2.34, 0.55]], 1.78), p));
  body.add(M(profile([[1.12, 0.95], [0.38, 1.42], [-0.95, 1.45], [-1.72, 1.0]], 1.58, 0.05), glass));
  body.add(M(profile([[0.42, 1.4], [-0.92, 1.43], [-0.98, 1.5], [0.36, 1.48]], 1.62, 0.04), p));
  for (const x of [-0.8, 0.8]) body.add(M(new THREE.BoxGeometry(0.06, 0.48, 1.0), p, [x * 0.97, 1.18, -0.28], [0, 0, x > 0 ? -0.08 : 0.08]));
  body.add(M(new THREE.BoxGeometry(1.5, 0.12, 0.14), chrome, [0, 0.5, 2.3]));
  for (const x of [-0.62, 0.62]) {
    body.add(M(new THREE.BoxGeometry(0.42, 0.14, 0.08), lamp("#fff3d6"), [x, 0.72, 2.27]));
    body.add(M(new THREE.BoxGeometry(0.42, 0.14, 0.08), lamp("#ff2a2a"), [x, 0.78, -2.3]));
  }
  const wheels = [], steer = [];
  for (const [x, z, front] of [[-0.84, 1.38, 1], [0.84, 1.38, 1], [-0.84, -1.42, 0], [0.84, -1.42, 0]]) {
    const piv = new THREE.Group(); piv.position.set(x, 0.36, z);
    const w = wheel(0.36, 0.26); piv.add(w); root.add(piv);
    wheels.push(w); if (front) steer.push(piv);
  }
  // driver seat, dashboard and steering wheel on the right (−x), as in Bangladesh
  const sx = -0.4, dark = std("#1d2024", { roughness: 0.8 });
  body.add(M(new THREE.BoxGeometry(0.55, 0.12, 0.55), dark, [sx, 0.46, -0.15]));
  body.add(M(new THREE.BoxGeometry(0.55, 0.62, 0.1), dark, [sx, 0.8, -0.45], [-0.12, 0, 0]));
  body.add(M(new THREE.BoxGeometry(1.5, 0.2, 0.4), dark, [0, 0.9, 0.95]));
  const sw = new THREE.Group(); sw.position.set(sx, 0.98, 0.58); sw.rotation.x = -1.0; body.add(sw);
  sw.add(M(new THREE.TorusGeometry(0.17, 0.022, 8, 24), dark));
  const rig = { seat: marker(body, [sx, 0.58, -0.1]), grips: [marker(sw, [0.16, 0, 0]), marker(sw, [-0.16, 0, 0])], pegs: [marker(body, [sx + 0.13, 0.38, 0.72]), marker(body, [sx - 0.13, 0.38, 0.72])], lean: -0.08, kneePole: [0, 1, 1] };
  return { root, body, wheels, steer, r: 0.36, rig };
}

// Standard commuter motorcycle (+z forward). Fork is raked; steering turns about the fork axis.
function bikeModel(color = "#1c5fd6") {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const p = paint(color), frame = std("#1b1d21", { metalness: 0.5, roughness: 0.45 }), black = std("#121315", { roughness: 0.85 });
  const R = 0.33, WB = 0.68;
  // frame
  body.add(tube([0, 0.98, 0.5], [0, 0.42, 0.08], 0.032, frame));
  body.add(tube([0, 0.98, 0.5], [0, 0.86, -0.3], 0.03, frame));
  body.add(tube([0, 0.86, -0.3], [0, 0.42, 0.08], 0.028, frame));
  for (const x of [-0.1, 0.1]) body.add(tube([x, 0.5, -0.05], [x * 0.6, R, -WB], 0.026, frame));
  for (const x of [-0.12, 0.12]) body.add(tube([x, 0.86, -0.32], [x, R + 0.05, -WB + 0.08], 0.02, chrome));
  // engine block, cylinder fins, crankcase
  body.add(M(new THREE.BoxGeometry(0.24, 0.26, 0.34), std("#55595f", { metalness: 0.7, roughness: 0.4 }), [0, 0.42, 0.02]));
  for (let k = 0; k < 5; k++) body.add(M(new THREE.BoxGeometry(0.22, 0.02, 0.2), std("#8b9097", { metalness: 0.8, roughness: 0.3 }), [0, 0.58 + k * 0.035, 0.16], [0.35, 0, 0]));
  body.add(M(new THREE.CylinderGeometry(0.11, 0.11, 0.26, 16), std("#6b7076", { metalness: 0.8, roughness: 0.35 }), [0, 0.38, -0.12], [0, 0, Math.PI / 2]));
  // exhaust
  body.add(tube([0.06, 0.55, 0.22], [0.14, 0.3, 0.12], 0.025, chrome));
  body.add(tube([0.14, 0.3, 0.12], [0.17, 0.32, -0.35], 0.025, chrome));
  body.add(M(new THREE.CylinderGeometry(0.055, 0.045, 0.42, 14), chrome, [0.18, 0.36, -0.55], [Math.PI / 2 + 0.12, 0, 0]));
  // tank, side panel, seat, tail
  const tank = M(new THREE.SphereGeometry(0.2, 20, 14), p, [0, 0.98, 0.22], [-0.12, 0, 0], [0.75, 0.6, 1.25]);
  body.add(tank);
  body.add(M(new THREE.BoxGeometry(0.2, 0.16, 0.26), p, [0, 0.72, -0.2]));
  const seat = M(new THREE.CapsuleGeometry(0.11, 0.48, 6, 12), black, [0, 0.93, -0.32], [Math.PI / 2 - 0.04, 0, 0], [1.25, 1, 0.55]);
  body.add(seat);
  body.add(M(new THREE.BoxGeometry(0.18, 0.08, 0.26), p, [0, 0.91, -0.68], [0.18, 0, 0]));
  body.add(M(new THREE.BoxGeometry(0.12, 0.05, 0.04), lamp("#ff2a2a"), [0, 0.93, -0.82]));
  body.add(M(new THREE.BoxGeometry(0.2, 0.025, 0.42), black, [0, R + 0.36, -WB + 0.06], [0.25, 0, 0]));
  // foot pegs
  for (const x of [-0.17, 0.17]) body.add(M(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), black, [x, 0.42, -0.08], [0, 0, Math.PI / 2]));
  const rw = spokedWheel(R); rw.position.set(0, R, -WB); root.add(rw);

  // fork pivots at the steering head; its −y axis runs down to the front axle
  const head = new THREE.Vector3(0, 1.0, 0.5), axle = new THREE.Vector3(0, R, WB), d = axle.clone().sub(head);
  const fork = new THREE.Group(); fork.position.copy(head); fork.rotation.x = -Math.atan2(d.z, -d.y); root.add(fork);
  const steerG = new THREE.Group(); fork.add(steerG);
  const L = d.length();
  for (const x of [-0.08, 0.08]) steerG.add(M(new THREE.CylinderGeometry(0.022, 0.022, L, 8), chrome, [x, -L / 2, 0]));
  steerG.add(M(new THREE.BoxGeometry(0.22, 0.05, 0.08), frame, [0, 0.02, 0]));
  steerG.add(M(new THREE.CylinderGeometry(0.014, 0.014, 0.66, 8), chrome, [0, 0.12, -0.06], [0, 0, Math.PI / 2]));
  for (const x of [-0.29, 0.29]) {
    steerG.add(M(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8), black, [x, 0.12, -0.06], [0, 0, Math.PI / 2]));
    steerG.add(tube([x * 0.8, 0.12, -0.06], [x * 0.95, 0.32, -0.02], 0.007, chrome));
    steerG.add(M(new THREE.SphereGeometry(0.035, 10, 8), chrome, [x * 0.95, 0.34, -0.02], [0, 0, 0], [1.4, 1, 0.4]));
  }
  steerG.add(M(new THREE.CylinderGeometry(0.085, 0.07, 0.09, 16), std("#cfd3d8", { metalness: 0.8, roughness: 0.3 }), [0, -0.1, 0.12], [Math.PI / 2, 0, 0]));
  steerG.add(M(new THREE.CircleGeometry(0.075, 16), lamp("#fff3d6"), [0, -0.1, 0.168]));
  steerG.add(M(new THREE.BoxGeometry(0.13, 0.02, 0.5), p, [0, -L + R + 0.08, 0.04], [0, 0, 0]));
  const fw = spokedWheel(R); fw.position.set(0, -L, 0); fw.rotation.order = "YXZ";
  steerG.add(fw);
  // keep the front wheel vertical even though the fork is raked
  const fwUp = new THREE.Group(); fwUp.position.copy(fw.position); fwUp.rotation.x = -fork.rotation.x; steerG.add(fwUp); fwUp.add(fw); fw.position.set(0, 0, 0);
  const rig = { seat: marker(body, [0, 1.0, -0.26]), grips: [marker(steerG, [0.29, 0.12, -0.06]), marker(steerG, [-0.29, 0.12, -0.06])], pegs: [marker(body, [0.19, 0.44, -0.08]), marker(body, [-0.19, 0.44, -0.08])], lean: 0.32, kneePole: [0, 0.6, 1] };
  return { root, body, wheels: [fw, rw], steer: [steerG], r: R, bike: true, rig };
}

function cngModel() {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const green = paint("#1f8a3f"), dark = std("#1b1f1c"), cage = std("#2a2e2b", { metalness: 0.6, roughness: 0.4 });
  body.add(M(profile([[-1.15, 0.35], [1.2, 0.35], [1.35, 0.7], [1.15, 1.0], [0.6, 1.05], [0.5, 1.6], [-1.15, 1.6]], 1.32), green));
  body.add(M(new THREE.CylinderGeometry(0.72, 0.72, 2.0, 18, 1, false, 0, Math.PI), green, [0, 1.55, -0.25], [Math.PI / 2, 0, Math.PI / 2], [1, 1, 0.42]));
  body.add(M(new THREE.BoxGeometry(1.1, 0.5, 0.05), glass, [0, 1.35, 1.1], [-0.35, 0, 0]));
  body.add(M(new THREE.BoxGeometry(1.0, 0.25, 0.75), std("#3b2f2a", { roughness: 0.9 }), [0, 0.85, -0.55]));
  for (let k = 0; k < 6; k++) for (const x of [-0.67, 0.67]) body.add(M(new THREE.BoxGeometry(0.02, 0.62, 0.02), cage, [x, 1.25, -0.95 + k * 0.28]));
  for (const x of [-0.67, 0.67]) body.add(M(new THREE.BoxGeometry(0.02, 0.02, 1.5), cage, [x, 1.55, -0.25]));
  body.add(M(new THREE.SphereGeometry(0.09, 10, 8), lamp("#fff3d6"), [0, 0.85, 1.36]));
  body.add(M(new THREE.BoxGeometry(0.9, 0.1, 0.06), lamp("#ff2a2a"), [0, 0.6, -1.17]));
  const front = new THREE.Group(); front.position.set(0, 0.3, 0.95);
  const fw = wheel(0.3, 0.14, "#999"); front.add(fw); root.add(front);
  const wheels = [fw];
  for (const x of [-0.6, 0.6]) { const w = wheel(0.3, 0.16, "#999"); w.position.set(x, 0.3, -0.7); root.add(w); wheels.push(w); }
  body.add(M(new THREE.BoxGeometry(0.5, 0.12, 0.4), std("#2b2420", { roughness: 0.9 }), [0, 0.8, 0.28]));
  const bar = new THREE.Group(); bar.position.set(0, 1.08, 0.82); body.add(bar);
  bar.add(M(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 8), chrome, [0, 0, 0], [0, 0, Math.PI / 2]));
  for (const x of [-0.28, 0.28]) bar.add(M(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 8), dark, [x, 0, 0], [0, 0, Math.PI / 2]));
  bar.add(tube([0, 0, 0], [0, -0.7, 0.12], 0.025, cage));
  const rig = { seat: marker(body, [0, 0.95, 0.25]), grips: [marker(bar, [0.28, 0, 0]), marker(bar, [-0.28, 0, 0])], pegs: [marker(body, [0.14, 0.4, 0.78]), marker(body, [-0.14, 0.4, 0.78])], lean: 0.12, kneePole: [0, 1, 1] };
  return { root, body, wheels, steer: [front], r: 0.3, rig };
}

const SPECS = {
  car: { model: carModel, maxF: 34, maxR: 9, accel: 9.5, brake: 22, steerMax: 0.58, wb: 2.8, track: 1.68, grip: 6.5, radius: 1.6, seat: [-0.38, 0.42, -0.1], cam: [7.6, 2.4], label: "car" },
  bike: { model: bikeModel, maxF: 29, maxR: 3, accel: 11, brake: 18, steerMax: 0.5, wb: 1.44, track: 0, grip: 8.5, radius: 0.8, seat: [0, 0.98, -0.32], cam: [5.2, 1.9], label: "motorbike" },
  cng: { model: cngModel, maxF: 17, maxR: 5, accel: 6, brake: 14, steerMax: 0.7, wb: 1.65, track: 1.2, grip: 7, radius: 1.25, seat: [0, 0.82, 0.35], cam: [6.2, 2.3], label: "CNG auto-rickshaw" },
};

const _n = new THREE.Vector3();
export function createVehicle(type, x, z, rot, hf) {
  const spec = SPECS[type], mdl = spec.model(type === "car" ? ["#b3202a", "#1f3b6d", "#e9ecef", "#202326"][Math.floor(Math.abs(x * 7 + z) % 4)] : undefined);
  const v = {
    type, spec, ...mdl, pos: new THREE.Vector3(x, 0, z), heading: rot, speed: 0, steerA: 0, vel: new THREE.Vector2(), lean: 0, roll: 0, pitch: 0, shake: 0,
  };
  v.root.rotation.order = "YXZ";
  function place() {
    const f = [Math.sin(v.heading), Math.cos(v.heading)], r = [-Math.cos(v.heading), Math.sin(v.heading)];
    const h = (dx, dz) => hf.heightAt(v.pos.x + dx, v.pos.z + dz);
    const hf_ = h(f[0] * spec.wb / 2, f[1] * spec.wb / 2), hb = h(-f[0] * spec.wb / 2, -f[1] * spec.wb / 2);
    const t = spec.track || 1, hl = h(-r[0] * t / 2, -r[1] * t / 2), hr = h(r[0] * t / 2, r[1] * t / 2);
    v.pos.y = Math.max((hf_ + hb) / 2, hf.map.water.ice ? hf.map.water.level - 0.15 : -99) + 0.05;
    v.pitch = damp(v.pitch, -Math.atan2(hf_ - hb, spec.wb), 12, 1 / 60);
    v.roll = spec.track ? damp(v.roll, Math.atan2(hl - hr, t), 12, 1 / 60) : 0;
    v.root.position.copy(v.pos);
    v.root.rotation.set(v.pitch, v.heading, v.roll + v.lean);
  }
  place();

  v.update = (dt, inp, colliders) => {
    const s = spec, fwd = inp ? inp.y : 0, turn = inp ? inp.x : 0, hand = inp && inp.brake;
    if (fwd > 0) v.speed += (v.speed < 0 ? s.brake : s.accel * (1 - Math.max(0, v.speed) / s.maxF * 0.6)) * dt;
    else if (fwd < 0) v.speed -= (v.speed > 0.5 ? s.brake : s.accel * 0.6) * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (2.5 + Math.abs(v.speed) * 0.05) * dt);
    if (hand) v.speed = damp(v.speed, 0, 1.6, dt);
    v.speed = clamp(v.speed, -s.maxR, s.maxF);
    v.steerA = damp(v.steerA, -turn * s.steerMax * (1 - 0.6 * Math.min(1, Math.abs(v.speed) / s.maxF)), 7, dt);
    const yawRate = (v.speed / s.wb) * Math.tan(v.steerA);
    v.heading += yawRate * dt;
    const fx = Math.sin(v.heading), fz = Math.cos(v.heading);
    const grip = hand ? s.grip * 0.18 : s.grip;
    v.vel.x = damp(v.vel.x, fx * v.speed, grip, dt);
    v.vel.y = damp(v.vel.y, fz * v.speed, grip, dt);
    const ox = v.pos.x, oz = v.pos.z;
    v.pos.x += v.vel.x * dt; v.pos.z += v.vel.y * dt;
    const W = hf.map.water;
    if (!W.ice && hf.waterMask(v.pos.x + fx * 2, v.pos.z + fz * 2) > 0.5 && hf.heightAt(v.pos.x + fx * 2, v.pos.z + fz * 2) < W.level + 0.3) {
      v.pos.x = ox; v.pos.z = oz; v.speed *= -0.2; v.vel.set(0, 0);
    }
    if (hf.normalAt(v.pos.x, v.pos.z, _n).y < 0.55) { v.pos.x = ox; v.pos.z = oz; v.speed *= -0.25; v.vel.set(0, 0); }
    const hit = colliders.resolve(v.pos, s.radius, v.pos.y + 0.5);
    if (hit) {
      const impact = Math.abs(v.vel.x * hit.x + v.vel.y * hit.z);
      if (impact > 2) { v.speed *= -0.25; v.shake = Math.min(1, impact / 20); }
      else v.speed *= 0.9;
      v.vel.set(fx * v.speed, fz * v.speed);
    }
    v.shake = Math.max(0, v.shake - dt * 2);
    v.lean = mdl.bike ? damp(v.lean, clamp(-yawRate * Math.abs(v.speed) * 0.045, -0.75, 0.75), 6, dt) : damp(v.lean, clamp(yawRate * v.speed * 0.006, -0.06, 0.06), 5, dt);
    for (const w of v.wheels) w.rotation.x += (v.speed * dt) / v.r;
    for (const p of v.steer) p.rotation.y = v.steerA * (mdl.bike ? 0.6 : 1);
    if (v.body) v.body.rotation.x = damp(v.body.rotation.x, clamp(-(fwd * 0.02) + (hand ? 0.03 : 0), -0.04, 0.04), 6, dt);
    place();
    return Math.abs(v.speed);
  };
  v.seatWorld = (out) => out.set(...spec.seat).applyEuler(v.root.rotation).add(v.root.position);
  v.exitPoint = () => {
    const rx = -Math.cos(v.heading), rz = Math.sin(v.heading), d = s => s.radius + 0.9;
    return new THREE.Vector3(v.pos.x + rx * d(spec), 0, v.pos.z + rz * d(spec));
  };
  return v;
}

// Twin-engine airliner, nose at +x, origin on the ground under the fuselage.
export function createPlaneModel() {
  const g = new THREE.Group(), white = new THREE.MeshPhysicalMaterial({ color: "#f3f5f7", roughness: 0.35, metalness: 0.15, clearcoat: 0.6 });
  const blue = std("#1c4fb0", { roughness: 0.4 }), grey = std("#b9c0c7", { metalness: 0.6, roughness: 0.35 }), win = std("#16202b", { roughness: 0.2 });
  const Y = 3.2, R = 1.9;
  const prof = [[0, 15.4], [0.55, 15.2], [1.1, 14.6], [1.55, 13.6], [1.82, 12.2], [R, 10.5], [R, -6.5], [1.8, -9], [1.45, -11.5], [0.95, -13.4], [0.45, -14.7], [0.2, -15.2]];
  const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  lathe.rotateZ(-Math.PI / 2);
  g.add(M(lathe, white, [0, Y, 0]));
  for (const s of [1, -1]) {
    g.add(M(new THREE.BoxGeometry(22, 0.22, 0.05), blue, [1.5, Y - 0.35, s * (R + 0.005)]));
    for (let k = 0; k < 22; k++) g.add(M(new THREE.BoxGeometry(0.32, 0.4, 0.06), win, [10 - k * 0.85, Y + 0.45, s * (R - 0.04)]));
    g.add(M(new THREE.BoxGeometry(0.9, 1.6, 0.06), grey, [11.4, Y + 0.1, s * (R - 0.03)]));
  }
  g.add(M(new THREE.BoxGeometry(1.0, 0.45, 2.3), win, [13.3, Y + 0.95, 0], [0, 0, -0.55]));
  // swept wing planform in x/z (span along ±z), thickness downward
  const wingGeo = (root, tip, span, sweep, thick, side) => {
    const sh = new THREE.Shape([new THREE.Vector2(root / 2, 0), new THREE.Vector2(-root / 2, 0), new THREE.Vector2(-sweep - tip, span * side), new THREE.Vector2(-sweep, span * side)]);
    const geo = new THREE.ExtrudeGeometry(sh, { depth: thick, bevelEnabled: true, bevelThickness: thick * 0.4, bevelSize: thick * 0.4, bevelSegments: 2 });
    geo.rotateX(Math.PI / 2);
    return geo;
  };
  for (const s of [1, -1]) {
    g.add(M(wingGeo(6.5, 1.8, 14, 4.2, 0.2, s), white, [1.6, Y - 1.0, s * 0.8], [-0.08 * s, 0, 0]));
    g.add(M(wingGeo(3.2, 1.1, 5.2, 2.4, 0.12, s), white, [-12.4, Y + 0.5, s * 0.3], [-0.05 * s, 0, 0]));
    // engine: pylon, nacelle, intake, exhaust cone
    const ex = 3.4, ez = s * 5.2, ey = Y - 2.25;
    g.add(M(new THREE.BoxGeometry(2.2, 0.8, 0.2), grey, [ex - 0.6, ey + 0.75, ez]));
    g.add(M(new THREE.CylinderGeometry(0.85, 0.7, 3.6, 24), grey, [ex, ey, ez], [0, 0, Math.PI / 2]));
    g.add(M(new THREE.CylinderGeometry(0.72, 0.72, 0.05, 24), win, [ex + 1.81, ey, ez], [0, 0, Math.PI / 2]));
    g.add(M(new THREE.ConeGeometry(0.4, 0.9, 16), grey, [ex - 2.2, ey, ez], [0, 0, Math.PI / 2]));
  }
  // vertical fin with airline livery
  const fin = new THREE.Shape([new THREE.Vector2(-9.8, 0), new THREE.Vector2(-14.2, 0), new THREE.Vector2(-15.4, 6.2), new THREE.Vector2(-13.3, 6.2)]);
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.24, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 2 });
  finGeo.translate(0, 0, -0.12);
  g.add(M(finGeo, blue, [0, Y + 1.0, 0]));
  // landing gear
  for (const [x, z] of [[11, 0], [-0.5, 2.4], [-0.5, -2.4]]) {
    g.add(M(new THREE.CylinderGeometry(0.1, 0.1, Y - R, 8), grey, [x, (Y - R) / 2 + 0.45, z]));
    for (const dz of [-0.28, 0.28]) g.add(M(new THREE.CylinderGeometry(0.45, 0.45, 0.32, 16), rubber, [x, 0.45, z + dz], [Math.PI / 2, 0, 0]));
  }
  return g;
}
