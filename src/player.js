// Third-person player: Mixamo mocap blending (idle/walk/run), distance-synced gait, ages, outfits, riding pose.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clamp, lerp, smooth, damp, dampAngle } from "./util.js";

export const scaleForAge = (age) => (age < 9 ? 0.62 : age < 13 ? 0.74 : age < 16 ? 0.86 : age < 18 ? 0.95 : 1);

export function outfitFor(zone, mapId) {
  const age = zone ? zone.age : 26;
  if (mapId === "fi") return { body: "#b8323e", joints: "#1d1f2b", beanie: true, bag: true, antenna: zone && zone.id === "tampere" };
  if (mapId === "it") return { body: "#e7a061", joints: "#3b3530", bag: true };
  if (age < 12) return { body: "#f3f4f6", joints: "#24406e", bag: true };
  if (age < 16) return { body: "#f3f4f6", joints: "#1d3557", bag: true };
  if (age < 19) return { body: "#2a9d8f", joints: "#203a43" };
  if (age < 24) return { body: "#5b5bd6", joints: "#22223b", bag: true };
  return { body: "#9fc8d8", joints: "#2b2d42", bag: true };
}

const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpV = new THREE.Vector3();
function rotateBoneWorld(bone, axisWorld, angle) {
  bone.parent.getWorldQuaternion(tmpQ).invert();
  tmpV.copy(axisWorld).applyQuaternion(tmpQ).normalize();
  bone.quaternion.premultiply(tmpQ2.setFromAxisAngle(tmpV, angle));
  bone.updateMatrixWorld(true);
}
// Rotate `bone` (in world space) so that `child` points at `target`.
const _P = new THREE.Vector3(), _C = new THREE.Vector3(), _cur = new THREE.Vector3(), _want = new THREE.Vector3(), _wq = new THREE.Quaternion(), _pq = new THREE.Quaternion(), _dq = new THREE.Quaternion();
function aim(bone, child, target) {
  bone.getWorldPosition(_P); child.getWorldPosition(_C);
  _cur.subVectors(_C, _P).normalize(); _want.subVectors(target, _P).normalize();
  _dq.setFromUnitVectors(_cur, _want);
  bone.getWorldQuaternion(_wq).premultiply(_dq);
  bone.parent.getWorldQuaternion(_pq).invert();
  bone.quaternion.copy(_pq.multiply(_wq));
  bone.updateMatrixWorld(true);
}
// Analytic two-bone IK: place the middle joint on the pole side, then aim both segments.
const _A = new THREE.Vector3(), _B = new THREE.Vector3(), _E = new THREE.Vector3(), _dir = new THREE.Vector3(), _bend = new THREE.Vector3(), _J = new THREE.Vector3();
function ik2(upper, lower, end, target, pole) {
  upper.getWorldPosition(_A); lower.getWorldPosition(_B); end.getWorldPosition(_E);
  const l1 = _A.distanceTo(_B), l2 = _B.distanceTo(_E);
  const d = clamp(_A.distanceTo(target), Math.abs(l1 - l2) + 1e-3, (l1 + l2) * 0.999);
  _dir.subVectors(target, _A).normalize();
  const ca = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1), sa = Math.sqrt(1 - ca * ca);
  _bend.copy(pole).addScaledVector(_dir, -pole.dot(_dir)).normalize();
  _J.copy(_A).addScaledVector(_dir, l1 * ca).addScaledVector(_bend, l1 * sa);
  aim(upper, lower, _J);
  _E.copy(_A).addScaledVector(_dir, d);
  aim(lower, end, _E);
}

export async function createPlayer() {
  const gltf = await new GLTFLoader().loadAsync("assets/models/Soldier.glb");
  const model = gltf.scene, root = new THREE.Group();
  model.rotation.y = Math.PI; // this rig faces −z
  root.add(model);
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
    if (/visor/i.test(o.name)) o.visible = false;
    o.material.envMapIntensity = 0.9;
  });
  let bodyMat = null;
  model.traverse((o) => { if (o.isMesh && o.visible) bodyMat = o.material; });

  const mixer = new THREE.AnimationMixer(model);
  const clip = (n) => gltf.animations.find((a) => a.name.toLowerCase() === n);
  const A = { idle: mixer.clipAction(clip("idle")), walk: mixer.clipAction(clip("walk")), run: mixer.clipAction(clip("run")) };
  for (const a of Object.values(A)) { a.play(); a.setEffectiveWeight(0); }
  A.walk.timeScale = A.run.timeScale = 0;
  A.idle.setEffectiveWeight(1);

  const bone = (n) => model.getObjectByName("mixamorig" + n);
  const B = { hips: bone("Hips"), spine: bone("Spine1"), spine2: bone("Spine2"), head: bone("Head"), lUp: bone("LeftUpLeg"), lLeg: bone("LeftLeg"), lFoot: bone("LeftFoot"), rUp: bone("RightUpLeg"), rLeg: bone("RightLeg"), rFoot: bone("RightFoot"), lArm: bone("LeftArm"), lFore: bone("LeftForeArm"), lHand: bone("LeftHand"), rArm: bone("RightArm"), rFore: bone("RightForeArm"), rHand: bone("RightHand") };

  // accessories, sized in metres regardless of the rig's internal unit scale
  root.updateMatrixWorld(true);
  const attach = (b, obj) => { const s = new THREE.Vector3(); b.getWorldScale(s); obj.scale.multiplyScalar(1 / s.x); b.add(obj); return obj; };
  const acc = {};
  {
    const beanie = new THREE.Group();
    const bm = new THREE.MeshStandardMaterial({ color: "#1d3557", roughness: 0.95 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), bm);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: "#f1f3f5", roughness: 1 }));
    cap.position.set(0, 0.11, -0.01); pom.position.set(0, 0.235, -0.02);
    beanie.add(cap, pom); beanie.traverse((o) => (o.castShadow = true));
    acc.beanie = attach(B.head, beanie);
    const bag = new THREE.Group();
    const bagMesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.16), new THREE.MeshStandardMaterial({ color: "#22252d", roughness: 0.8 }));
    bagMesh.position.set(0, 0.02, -0.17); bagMesh.castShadow = true;
    bag.add(bagMesh);
    const ant = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.36, 6), new THREE.MeshStandardMaterial({ color: "#c9ced4", metalness: 0.8 }));
    rod.position.y = 0.18;
    ant.add(rod);
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshBasicMaterial({ color: "#51e3a4", toneMapped: false }));
    led.position.y = 0.37; ant.add(led);
    ant.position.set(0.1, 0.18, -0.2);
    bag.add(ant);
    acc.bag = attach(B.spine2, bag); acc.antenna = ant; acc.led = led;
  }

  const st = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, vy: 0, grounded: true, phase: 0, scale: 0.62, scaleT: 0.62, lean: 0, idleT: 0, pop: 1, outfitKey: "", punchT: 1 };
  root.rotation.order = "YXZ";

  function setOutfit(o) {
    const key = JSON.stringify(o);
    if (key === st.outfitKey) return;
    st.outfitKey = key;
    bodyMat?.color.set("#ffffff").lerp(new THREE.Color(o.body), 0.35);
    acc.beanie.visible = !!o.beanie;
    acc.bag.visible = !!o.bag;
    acc.antenna.visible = !!o.antenna;
    st.pop = 0;
  }

  function blend(speedN, dt, dist) {
    const idle = 1 - smooth(0.08, 1.1, speedN), run = smooth(2.1, 3.7, speedN) * (1 - idle), walk = Math.max(0, 1 - idle - run);
    const stride = lerp(1.45, 2.95, run / (walk + run + 1e-6)) * st.scale * (1 + 0.25 * smooth(7.5, 11.5, speedN));
    st.phase = (st.phase + dist / stride) % 1;
    A.idle.setEffectiveWeight(idle);
    A.walk.setEffectiveWeight(walk);
    A.run.setEffectiveWeight(run);
    A.walk.time = st.phase * A.walk.getClip().duration;
    A.run.time = st.phase * A.run.getClip().duration;
    mixer.update(dt);
  }

  // Free movement on foot. move: {x,y} in [-1,1] relative to camera; yaw: camera forward angle.
  function update({ dt, t, input, yaw, hf, colliders }) {
    st.scale = damp(st.scale, st.scaleT, 3, dt);
    const s = st.scale;
    const mx = input.move.x, my = input.move.y, mag = Math.min(1, Math.hypot(mx, my));
    const fx = Math.sin(yaw), fz = Math.cos(yaw), rx = -Math.cos(yaw), rz = Math.sin(yaw);
    let dx = fx * my + rx * mx, dz = fz * my + rz * mx;
    const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    const top = (input.walk ? 2.2 : input.sprint ? 11.5 : 7.4) * (0.55 + 0.45 * s);
    const target = mag > 0.05 ? top * mag : 0;
    const accel = st.grounded ? 10 : 2.5;
    st.vel.x = damp(st.vel.x, dx * target, accel, dt);
    st.vel.z = damp(st.vel.z, dz * target, accel, dt);
    const ox = st.pos.x, oz = st.pos.z;
    st.pos.x += st.vel.x * dt; st.pos.z += st.vel.z * dt;
    const W = hf.map.water;
    if (!W.ice && hf.heightAt(st.pos.x, st.pos.z) < W.level - 0.55) { st.pos.x = ox; st.pos.z = oz; st.vel.set(0, 0, 0); }
    colliders.resolve(st.pos, 0.35 * s, st.pos.y + 0.3);
    const moved = Math.hypot(st.pos.x - ox, st.pos.z - oz), hs = moved / Math.max(dt, 1e-4);

    const ground = Math.max(hf.heightAt(st.pos.x, st.pos.z) + (hf.roadMask(st.pos.x, st.pos.z) > 0.5 ? 0.06 : 0), W.ice ? W.level - 0.15 : -99);
    if (st.grounded && input.jump) { st.vy = 5.2 * Math.sqrt(s); st.grounded = false; }
    if (!st.grounded) {
      st.vy -= 17 * dt;
      st.pos.y += st.vy * dt;
      if (st.pos.y <= ground) { st.pos.y = ground; st.grounded = true; st.vy = 0; }
    } else st.pos.y = damp(st.pos.y, ground, 25, dt);

    const prev = st.heading;
    if (hs > 0.2 && mag > 0.05) st.heading = dampAngle(st.heading, Math.atan2(dx, dz), 11, dt);
    const turnRate = (st.heading - prev) / Math.max(dt, 1e-4);
    st.lean = damp(st.lean, clamp(-turnRate * hs * 0.012, -0.22, 0.22), 6, dt);

    blend(st.grounded ? hs / s : Math.min(hs / s, 1.2), dt, moved);
    if (input.punch && st.punchT >= 1) st.punchT = 0;
    if (st.punchT < 1) {
      st.punchT = Math.min(1, st.punchT + dt * 3.2);
      const k = Math.sin(st.punchT * Math.PI);
      root.updateMatrixWorld(true);
      const rgt = new THREE.Vector3(1, 0, 0).applyQuaternion(root.quaternion);
      rotateBoneWorld(B.spine, new THREE.Vector3(0, 1, 0), -0.5 * k);
      rotateBoneWorld(B.rArm, rgt, -1.5 * k);
      rotateBoneWorld(B.rFore, rgt, -0.4 * (1 - k));
    }
    st.pop = Math.min(1, st.pop + dt * 2);
    const sq = 1 + Math.exp(-st.pop * 7) * Math.sin(st.pop * 20) * 0.08;
    root.position.copy(st.pos);
    root.rotation.set(0, st.heading, st.lean);
    root.scale.set(s / Math.sqrt(sq), s * sq, s / Math.sqrt(sq));
    acc.led.visible = Math.sin(t * 6) > -0.2;
    return hs;
  }

  // Seated on a vehicle: hips on the seat, hands on the grips/wheel, feet on the pegs (two-bone IK).
  const right = new THREE.Vector3(), seat = new THREE.Vector3(), hipW = new THREE.Vector3(), tgt = new THREE.Vector3(), pole = new THREE.Vector3(), fwd = new THREE.Vector3(), up = new THREE.Vector3();
  function ride(v, dt, t) {
    st.scale = damp(st.scale, st.scaleT, 3, dt);
    const s = st.scale, rig = v.rig;
    blend(0, dt, 0);
    root.rotation.copy(v.root.rotation);
    root.scale.setScalar(s);
    v.root.updateMatrixWorld(true);
    rig.seat.getWorldPosition(seat);
    root.position.copy(seat);
    root.updateMatrixWorld(true);
    B.hips.getWorldPosition(hipW);
    root.position.add(seat.sub(hipW));
    root.updateMatrixWorld(true);
    right.set(-1, 0, 0).applyQuaternion(root.quaternion);
    fwd.set(0, 0, 1).applyQuaternion(root.quaternion);
    up.set(0, 1, 0).applyQuaternion(root.quaternion);
    rotateBoneWorld(B.spine, right, -(rig.lean + Math.sin(t * 1.7) * 0.01));
    // legs first (knees forward/up), then arms (elbows out/down)
    const legs = [[B.lUp, B.lLeg, B.lFoot, rig.pegs[0], -1], [B.rUp, B.rLeg, B.rFoot, rig.pegs[1], 1]];
    for (const [a, b, c, m, side] of legs) {
      m.getWorldPosition(tgt);
      pole.copy(fwd).multiplyScalar(rig.kneePole[2]).addScaledVector(up, rig.kneePole[1]).addScaledVector(right, side * 0.25);
      ik2(a, b, c, tgt, pole);
    }
    const arms = [[B.lArm, B.lFore, B.lHand, rig.grips[0], -1], [B.rArm, B.rFore, B.rHand, rig.grips[1], 1]];
    for (const [a, b, c, m, side] of arms) {
      m.getWorldPosition(tgt);
      pole.copy(right).multiplyScalar(side).addScaledVector(up, -0.8).addScaledVector(fwd, -0.4);
      ik2(a, b, c, tgt, pole);
    }
    st.pos.copy(v.pos);
    st.heading = v.heading;
  }

  return {
    root, st, gltf, setOutfit, update, ride,
    setAge(age, snap) { st.scaleT = scaleForAge(age); if (snap) st.scale = st.scaleT; },
    teleport(x, y, z, heading) { st.pos.set(x, y, z); st.heading = heading; st.vel.set(0, 0, 0); root.position.copy(st.pos); },
    height: () => 1.75 * st.scale,
  };
}
