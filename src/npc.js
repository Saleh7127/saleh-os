// Friends hanging out at Dhanmondi, Mirpur and Kamalapur — bonk them, they fall over and get back up.
import * as THREE from "three";
import { clone } from "three/addons/utils/SkeletonUtils.js";
import { rng, smooth } from "./util.js";

const SPOTS = ["dhanmondi", "mirpur", "kamalapur"];
const OUTFITS = [["#e9c46a", "#264653"], ["#e76f51", "#2b2d42"], ["#8ecae6", "#023047"], ["#90be6d", "#283618"], ["#f4f1de", "#3d405b"], ["#c77dff", "#240046"], ["#ffb703", "#3a2e1f"], ["#adb5bd", "#212529"]];
const LINES = ["Oof!", "Bhai keno?!", "Mama, ki korli!", "Ayy!", "Abar?!", "Okay okay!", "Ouch!", "Cha ta pore gelo!"];

export function createFriends(scene, gltf, world) {
  const r = rng(77), list = [];
  const idleClip = gltf.animations.find((a) => a.name.toLowerCase() === "idle");
  const agreeSrc = gltf.animations.find((a) => a.name === "agree");
  const agree = agreeSrc ? THREE.AnimationUtils.makeClipAdditive(agreeSrc.clone()) : null;
  for (const id of SPOTS) {
    const p = world.places.find((q) => q.id === id && !q.decor);
    if (!p) continue;
    const n = 4;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + 0.5, rad = 3.4 + r() * 0.8;
      const x = p.pos.x + Math.cos(a) * rad, z = p.pos.z + Math.sin(a) * rad;
      const model = clone(gltf.scene), [body] = OUTFITS[Math.floor(r() * OUTFITS.length)];
      model.rotation.y = Math.PI;
      model.traverse((o) => {
        if (!o.isMesh) return;
        if (/visor/i.test(o.name)) { o.visible = false; return; }
        o.material = o.material.clone();
        o.material.color.set("#ffffff").lerp(new THREE.Color(body), 0.45);
        o.castShadow = true;
        o.frustumCulled = false;
      });
      const g = new THREE.Group();
      g.rotation.order = "YXZ";
      g.add(model);
      const s = 0.95 + r() * 0.1;
      g.scale.setScalar(s);
      scene.add(g);
      const mixer = new THREE.AnimationMixer(model);
      const idle = mixer.clipAction(idleClip);
      idle.play();
      idle.time = r() * idleClip.duration;
      idle.timeScale = 0.8 + r() * 0.4;
      let nod = null;
      if (agree) { nod = mixer.clipAction(agree); nod.play(); nod.setEffectiveWeight(0); nod.time = r() * agree.duration; }
      const heading = Math.atan2(p.pos.x - x, p.pos.z - z);
      list.push({ g, mixer, nod, x, z, hx: x, hz: z, heading, base: heading, s, vx: 0, vz: 0, fall: 0, downT: 0, chat: r() * 10, y: world.hf.heightAt(x, z) });
    }
  }

  const v = new THREE.Vector3();
  function knock(f, dx, dz, power) {
    if (f.downT > 0) return false;
    const l = Math.hypot(dx, dz) || 1;
    f.vx = (dx / l) * power; f.vz = (dz / l) * power;
    f.heading = Math.atan2(-dx, -dz);
    f.downT = 3.4;
    return true;
  }

  // hits: [{ x, z, fx, fz, reach, power, cone }] — returns friends that were knocked over
  function update(dt, t, camPos, hits) {
    const knocked = [];
    for (const f of list) {
      const near = Math.hypot(f.x - camPos.x, f.z - camPos.z) < 140;
      f.g.visible = near;
      if (!near) continue;
      for (const h of hits) {
        const dx = f.x - h.x, dz = f.z - h.z, d = Math.hypot(dx, dz);
        if (d > h.reach) continue;
        if (h.cone && (dx * h.fx + dz * h.fz) / (d || 1) < 0.25) continue;
        if (knock(f, dx, dz, h.power)) knocked.push(f);
      }
      if (f.downT > 0) {
        f.downT -= dt;
        f.x += f.vx * dt; f.z += f.vz * dt;
        f.vx *= Math.exp(-dt * 3); f.vz *= Math.exp(-dt * 3);
        f.fall = f.downT > 0.9 ? Math.min(1, f.fall + dt * 3.2) : Math.max(0, f.downT / 0.9);
        if (f.downT <= 0) { f.downT = 0; f.fall = 0; }
      } else {
        f.x += (f.hx - f.x) * Math.min(1, dt * 0.6);
        f.z += (f.hz - f.z) * Math.min(1, dt * 0.6);
        f.heading += (f.base - f.heading) * Math.min(1, dt * 2);
      }
      f.y = world.hf.heightAt(f.x, f.z);
      const ease = f.fall * f.fall * (3 - 2 * f.fall);
      f.g.position.set(f.x, f.y, f.z);
      f.g.rotation.set(-ease * 1.45, f.heading, 0);
      if (f.nod) f.nod.setEffectiveWeight(f.downT > 0 ? 0 : smooth(0.4, 0.9, Math.sin(t * 0.5 + f.chat) * 0.5 + 0.5));
      f.mixer.update(dt);
    }
    return knocked;
  }
  return { list, update, anchor: (f) => v.set(f.x, f.y + 2.1 * f.s, f.z) };
}

export const bonkLine = (n) => LINES[n % LINES.length];
