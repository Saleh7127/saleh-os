// 2D collision world (XZ plane): oriented boxes and circles in a spatial hash.
export function createColliders(cell = 16) {
  const grid = new Map(), all = [];
  const key = (i, j) => i * 100003 + j;

  function insert(c, r) {
    const i0 = Math.floor((c.x - r) / cell), i1 = Math.floor((c.x + r) / cell);
    const j0 = Math.floor((c.z - r) / cell), j1 = Math.floor((c.z + r) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const k = key(i, j);
      if (!grid.has(k)) grid.set(k, []);
      grid.get(k).push(c);
    }
    all.push(c);
  }
  const addBox = (x, z, hw, hd, rot = 0, h = 50) => insert({ t: 0, x, z, hw, hd, c: Math.cos(rot), s: Math.sin(rot), h }, Math.hypot(hw, hd));
  const addCircle = (x, z, r, h = 50) => insert({ t: 1, x, z, r, h }, r);

  const seen = new Set();
  function near(x, z, r) {
    seen.clear();
    const out = [];
    const i0 = Math.floor((x - r) / cell), i1 = Math.floor((x + r) / cell), j0 = Math.floor((z - r) / cell), j1 = Math.floor((z + r) / cell);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const list = grid.get(key(i, j));
      if (list) for (const c of list) if (!seen.has(c)) { seen.add(c); out.push(c); }
    }
    return out;
  }

  // Push a circle (pos.x, pos.z, radius) out of colliders. Returns the collision normal or null.
  function resolve(pos, radius, y = 0) {
    let hit = null;
    for (const c of near(pos.x, pos.z, radius + 2)) {
      if (y > c.h) continue;
      if (c.t === 1) {
        const dx = pos.x - c.x, dz = pos.z - c.z, d = Math.hypot(dx, dz), m = c.r + radius;
        if (d < m && d > 1e-6) { pos.x = c.x + (dx / d) * m; pos.z = c.z + (dz / d) * m; hit = { x: dx / d, z: dz / d }; }
        continue;
      }
      const dx = pos.x - c.x, dz = pos.z - c.z;
      const lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
      const qx = Math.max(-c.hw, Math.min(c.hw, lx)), qz = Math.max(-c.hd, Math.min(c.hd, lz));
      let nx = lx - qx, nz = lz - qz, d = Math.hypot(nx, nz);
      if (d >= radius) continue;
      if (d < 1e-6) {
        const px = c.hw - Math.abs(lx), pz = c.hd - Math.abs(lz);
        if (px < pz) { nx = Math.sign(lx) || 1; nz = 0; d = -px; } else { nx = 0; nz = Math.sign(lz) || 1; d = -pz; }
      } else { nx /= d; nz /= d; }
      const push = radius - d;
      const wx = nx * c.c + nz * c.s, wz = -nx * c.s + nz * c.c;
      pos.x += wx * push; pos.z += wz * push;
      hit = { x: wx, z: wz };
    }
    return hit;
  }

  function inside(x, z) {
    for (const c of near(x, z, 1)) {
      if (c.t === 1) { if (Math.hypot(x - c.x, z - c.z) < c.r) return c; continue; }
      const dx = x - c.x, dz = z - c.z, lx = dx * c.c - dz * c.s, lz = dx * c.s + dz * c.c;
      if (Math.abs(lx) < c.hw && Math.abs(lz) < c.hd) return c;
    }
    return null;
  }
  return { addBox, addCircle, resolve, inside, all };
}
