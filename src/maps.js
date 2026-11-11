// World layouts. Units ≈ metres (distances compressed). North is −z.
// build: home | school | uni | work | lab | arcade | airport | remote | beacon | ghat | station | hangout | stadium | basilica | church
export const MAPS = {
  bd: {
    id: "bd", name: "Bangladesh", size: 1600, seed: 11, hills: 7, base: 1.6,
    geo: { lat0: 23.62, lon0: 90.55, k: 0.00055 },
    env: { elevation: 28, azimuth: 205, turbidity: 7, rayleigh: 1.8, exposure: 0.72, fog: "#d9d6c6", fogNear: 140, fogFar: 720, night: 0, skyTop: "#3f86d6", skyHor: "#e6e1cc" },
    ground: { grass: "#5f8f35", grass2: "#7aa543", dry: "#9c9b55", sand: "#cdb98a", urban: "#7f7a70", paddyA: "#8cbf4a", paddyB: "#4f8a2f", dirt: "#a78b5f" },
    grass: { base: "#3f6f22", tip: "#a3c95a", height: 0.4 },
    water: { level: 0, color: "#2c5446", rivers: [
      { pts: [[-820, 620], [-400, 600], [-100, 615], [200, 590], [520, 605], [820, 625]], width: 120 },
      { pts: [[760, -820], [690, -640], [640, -480], [700, -330], [820, -260]], width: 60 },
      { pts: [[-820, -120], [-620, -140], [-460, -200], [-400, -300]], width: 34 },
    ], lakes: [{ c: [-250, -12], rx: 70, rz: 15, rot: 0.25 }, { c: [430, 400], rx: 16, rz: 12, rot: 0 }, { c: [340, 280], rx: 14, rz: 10, rot: 0.6 }] },
    roads: [
      { pts: [[480, 340], [400, 360], [300, 385], [170, 440], [70, 480]], w: 9, kind: "road" },
      { pts: [[70, 480], [55, 330], [35, 160], [25, -40], [30, -200], [70, -320], [170, -420], [260, -470]], w: 13, kind: "highway" },
      { pts: [[260, -470], [400, -540], [520, -575]], w: 11, kind: "highway" },
      { pts: [[25, -40], [-120, -55], [-260, -65], [-330, -70]], w: 11, kind: "road" },
      { pts: [[-60, -180], [-180, -240], [-260, -300], [-380, -400], [-520, -500]], w: 12, kind: "highway" },
      { pts: [[440, 330], [400, 300], [360, 360], [300, 330]], w: 4, kind: "dirt" },
      { pts: [[470, 360], [520, 300], [560, 240]], w: 4, kind: "dirt" },
      { pts: [[70, 480], [40, 525]], w: 7, kind: "road" },
    ],
    grid: { x0: -330, x1: 120, z0: -380, z1: 10, step: 75, w: 9 },
    zones: [
      { id: "kachua", name: "Kachua, Chandpur", chapter: "Childhood", c: [420, 330], r: 130, age: 8, kind: "village" },
      { id: "chandpur", name: "Chandpur", chapter: "Teenage years", c: [60, 470], r: 100, age: 14, kind: "town" },
      { id: "motijheel", name: "Motijheel · Kamalapur, Dhaka", chapter: "College in Dhaka", c: [10, -110], r: 95, age: 17, kind: "city" },
      { id: "dhanmondi", name: "Dhanmondi, Dhaka", chapter: "University years", c: [-240, -40], r: 95, age: 21, kind: "city" },
      { id: "mirpur", name: "Mirpur, Dhaka", chapter: "University years", c: [-200, -340], r: 95, age: 21, kind: "city" },
      { id: "gulshan", name: "Gulshan, Dhaka", chapter: "First jobs", c: [60, -300], r: 85, age: 24, kind: "city" },
      { id: "dhaka", name: "Dhaka", chapter: "The capital", c: [-105, -185], r: 320, age: 20, kind: "city", umbrella: true },
      { id: "ashulia", name: "Ashulia, Dhaka", chapter: "Daffodil International University", c: [-520, -510], r: 115, age: 21, kind: "campus" },
      { id: "bau", name: "Mymensingh", chapter: "Four months at BAU", c: [520, -565], r: 90, age: 19, kind: "campus" },
      { id: "airport_bd", name: "Hazrat Shahjalal Airport", chapter: "Leaving for Europe", c: [260, -470], r: 120, age: 25, kind: "airport" },
    ],
    places: [
      { id: "home", pos: [472, 352], rot: -0.4, build: "home", flag: "bd" },
      { id: "kg", pos: [395, 275], rot: 0.3, build: "school", flag: "bd", color: "#f6e7c1" },
      { id: "tulpai", pos: [350, 400], rot: -0.2, build: "school", flag: "bd", color: "#e9d5b7" },
      { id: "alamin", pos: [98, 430], rot: 0.1, build: "school", flag: "bd", color: "#f1dfc6" },
      { id: "ghat", pos: [40, 512], rot: 0, build: "ghat" },
      { id: "notredame", pos: [70, -95], rot: -Math.PI / 2, build: "uni", flag: "bd", color: "#e8e1d5" },
      { id: "kamalapur", pos: [-110, -120], rot: 0, build: "station" },
      { id: "coaching", pos: [-60, -40], rot: 0, build: "arcade" },
      { id: "dhanmondi", pos: [-250, 30], rot: Math.PI, build: "hangout" },
      { id: "mirpur", pos: [-160, -370], rot: 0.2, build: "stadium" },
      { id: "diu", pos: [-520, -540], rot: 0.15, build: "uni", flag: "bd", color: "#e3ecf7" },
      { id: "bau", pos: [520, -580], rot: 0, build: "uni", flag: "bd", color: "#dfe8d0" },
      { id: "appscode", pos: [20, -300], rot: 0, build: "work", flag: "bd" },
      { id: "enosis", pos: [100, -330], rot: -0.2, build: "work", flag: "bd" },
      { id: "airport_dac", pos: [250, -470], rot: 0, build: "airport", travel: true },
    ],
    vehicles: [
      { type: "bike", pos: [455, 372], rot: 2.6 },
      { type: "car", pos: [488, 330], rot: 1.2 },
      { type: "bike", pos: [380, 312], rot: 0.4 },
      { type: "cng", pos: [80, 455], rot: 1.6 },
      { type: "bike", pos: [110, 445], rot: 2.2 },
      { type: "car", pos: [40, -60], rot: 3.1 },
      { type: "bike", pos: [-200, -300], rot: 1.2 },
      { type: "cng", pos: [-20, -120], rot: 0 },
      { type: "bike", pos: [-235, 0], rot: 2.0 },
      { type: "car", pos: [-150, -140], rot: 0.5 },
      { type: "car", pos: [60, -280], rot: 1.6 },
      { type: "bike", pos: [0, -260], rot: 3.0 },
      { type: "car", pos: [-500, -490], rot: 0.8 },
      { type: "bike", pos: [-470, -520], rot: 2.4 },
      { type: "car", pos: [285, -440], rot: 2.4 },
      { type: "bike", pos: [500, -555], rot: 1.0 },
    ],
    // Vehicles that cruise along roads on their own (road index into roads[]).
    traffic: [
      { type: "car", road: 1 }, { type: "bike", road: 1 }, { type: "cng", road: 0 }, { type: "car", road: 3 },
      { type: "bike", road: 4 }, { type: "car", road: 4 }, { type: "bike", road: 2 }, { type: "cng", road: 1 },
    ],
    spawn: { pos: [464, 364], rot: 2.4 },
  },

  fi: {
    id: "fi", name: "Finland", size: 1300, seed: 23, hills: 16, base: 2.5,
    geo: { lat0: 61.0, lon0: 23.0, k: 0.0012 },
    env: { elevation: -2.5, azimuth: 200, turbidity: 2, rayleigh: 3, exposure: 0.95, fog: "#2a3c66", fogNear: 90, fogFar: 520, night: 1, aurora: true, snow: true, skyTop: "#050c22", skyHor: "#2f4a7c" },
    ground: { grass: "#e9eef6", grass2: "#d8e2ef", dry: "#c9d4e4", sand: "#c7cfd8", urban: "#b7bec9", paddyA: "#e9eef6", paddyB: "#dfe6f0", dirt: "#c1cad6" },
    grass: null,
    water: { level: 0, color: "#0b2238", ice: true, rivers: [{ pts: [[-470, 320], [-360, 230], [-290, 140], [-240, 40]], width: 22 }], lakes: [
      { c: [290, -400], rx: 280, rz: 110, rot: 0.15 }, { c: [250, -10], rx: 250, rz: 75, rot: -0.1 }, { c: [-560, 470], rx: 300, rz: 200, rot: 0 },
      { c: [-60, -300], rx: 90, rz: 50, rot: 0.6 }, { c: [-420, -150], rx: 70, rz: 45, rot: 0.2 },
    ] },
    roads: [
      { pts: [[-300, 210], [-160, 140], [0, 90], [140, -60], [270, -190]], w: 12, kind: "highway" },
      { pts: [[0, 90], [40, 200], [60, 260]], w: 10, kind: "road" },
    ],
    grid: null,
    zones: [
      { id: "turku", name: "Turku", chapter: "Erasmus Mundus begins", c: [-290, 200], r: 140, age: 25, kind: "nordic" },
      { id: "tampere", name: "Tampere", chapter: "Tampere — the GNSS chapter", c: [290, -200], r: 145, age: 27, kind: "nordic" },
      { id: "airport_fi", name: "Tampere-Pirkkala Airport", chapter: "Arrivals", c: [60, 270], r: 100, age: 26, kind: "airport" },
    ],
    places: [
      { id: "abo", pos: [-275, 165], rot: 0.2, build: "uni", flag: "fi", color: "#efe6da" },
      { id: "elisa", pos: [-210, 240], rot: -0.3, build: "work", flag: "fi" },
      { id: "turku_cathedral", pos: [-345, 245], rot: 0.3, build: "church", decor: true },
      { id: "huawei", pos: [220, -200], rot: 0.1, build: "lab", flag: "fi", color: "#e03131" },
      { id: "montel", pos: [300, -265], rot: 0, build: "remote", flag: "se" },
      { id: "ublox", pos: [330, -160], rot: -0.2, build: "lab", flag: "fi", color: "#1c7ed6" },
      { id: "next", pos: [400, -210], rot: 0, build: "beacon" },
      { id: "airport_fi", pos: [70, 290], rot: 0, build: "airport", travel: true },
    ],
    vehicles: [
      { type: "car", pos: [40, 250], rot: 3.3 }, { type: "car", pos: [-250, 200], rot: 1.2 }, { type: "bike", pos: [260, -170], rot: 0.5 },
      { type: "car", pos: [240, -230], rot: 2.2 }, { type: "bike", pos: [-200, 170], rot: 0.3 }, { type: "car", pos: [100, 240], rot: 0.2 },
    ],
    traffic: [{ type: "car", road: 0 }, { type: "car", road: 0 }, { type: "bike", road: 1 }],
    spawn: { pos: [50, 262], rot: 3.4 },
  },

  it: {
    id: "it", name: "Italy", size: 1100, seed: 37, hills: 24, base: 6,
    geo: { lat0: 42.35, lon0: 13.4, k: 0.0009 },
    env: { elevation: 9, azimuth: 250, turbidity: 9, rayleigh: 2.4, exposure: 0.85, fog: "#e9cfa6", fogNear: 160, fogFar: 900, night: 0, skyTop: "#5b8fd0", skyHor: "#f2d3a2" },
    ground: { grass: "#8c8f45", grass2: "#a59a52", dry: "#b8a05e", sand: "#cbb487", urban: "#b9a88c", paddyA: "#8c8f45", paddyB: "#a59a52", dirt: "#a88f68" },
    grass: { base: "#5f6b2a", tip: "#c9b765", height: 0.32 },
    water: { level: -40, color: "#29445a", rivers: [], lakes: [] },
    mountains: [{ c: [0, -470], r: 330, h: 150 }, { c: [-430, -150], r: 220, h: 70 }, { c: [430, -120], r: 230, h: 80 }, { c: [-300, 380], r: 200, h: 45 }],
    roads: [{ pts: [[0, 0], [90, 110], [140, 190], [158, 245]], w: 10, kind: "road" }, { pts: [[0, 0], [-80, 80], [-120, 160]], w: 8, kind: "road" }],
    grid: { x0: -110, x1: 110, z0: -100, z1: 100, step: 55, w: 7 },
    zones: [
      { id: "laquila", name: "L'Aquila", chapter: "Year two in Italy", c: [0, 0], r: 130, age: 26, kind: "italian" },
      { id: "airport_it", name: "L'Aquila Airfield", chapter: "Arrivals", c: [158, 262], r: 90, age: 26, kind: "airport" },
    ],
    places: [
      { id: "laquila", pos: [45, -40], rot: 0.1, build: "uni", flag: "it", color: "#f3e3c9" },
      { id: "collemaggio", pos: [-70, 70], rot: 0.4, build: "basilica" },
      { id: "airport_it", pos: [158, 283], rot: 0, build: "airport", travel: true },
    ],
    vehicles: [{ type: "car", pos: [150, 250], rot: 3.8 }, { type: "bike", pos: [20, 30], rot: 1 }, { type: "car", pos: [-40, 40], rot: 2.2 }, { type: "bike", pos: [190, 250], rot: 0.6 }],
    traffic: [{ type: "car", road: 0 }, { type: "bike", road: 1 }],
    spawn: { pos: [170, 250], rot: 3.8 },
  },
};

export const TRAVEL = [
  { map: "bd", label: "Dhaka, Bangladesh", sub: "Back home · childhood to first jobs", years: "99–24", place: "airport_dac" },
  { map: "fi", label: "Turku & Tampere, Finland", sub: "Master's, Elisa, Huawei, u-blox", years: "24–NOW", place: "airport_fi" },
  { map: "it", label: "L'Aquila, Italy", sub: "Master's year two", years: "25–26", place: "airport_it" },
];

// Compress a layout so places are closer together; building and road sizes stay real-world.
function shrink(m, s) {
  const P = ([x, z]) => [x * s, z * s];
  m.size = Math.round(m.size * s);
  m.geo.k /= s;
  for (const r of m.water.rivers) { r.pts = r.pts.map(P); r.width *= Math.max(s, 0.5); }
  for (const l of m.water.lakes) { l.c = P(l.c); l.rx *= s; l.rz *= s; }
  for (const mt of m.mountains || []) { mt.c = P(mt.c); mt.r *= s; }
  for (const r of m.roads) r.pts = r.pts.map(P);
  if (m.grid) {
    const g = m.grid;
    Object.assign(g, { x0: g.x0 * s, x1: g.x1 * s, z0: g.z0 * s, z1: g.z1 * s, step: Math.round(g.step * Math.max(s, 0.8)) });
  }
  for (const z of m.zones) { z.c = P(z.c); z.r = Math.max(z.r * s, 45); }
  for (const p of m.places) p.pos = P(p.pos);
  for (const v of m.vehicles) v.pos = P(v.pos);
  m.spawn.pos = P(m.spawn.pos);
}
shrink(MAPS.bd, 0.45);
shrink(MAPS.fi, 0.5);
shrink(MAPS.it, 0.6);
