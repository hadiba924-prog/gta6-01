// Solmar Bay itself: a sun-soaked coastal grid city built from boxes,
// procedural facades, palms, a beach and the ocean. Also owns collision
// boxes, the road graph traffic drives on, and the coin collectibles.
import * as THREE from 'three';
import { CFG } from './config.js';

const PALETTE = [0xf2e3c6, 0xe08a5a, 0x5aa8a0, 0xd9b380, 0xe0705f, 0xf5f0e6, 0x7fb3d5, 0xc96f4a];
const ROOFS = [0x8a5a3b, 0x5a6b7a, 0x3f5a4a, 0x7a4a3a, 0x6b5a7a];

function facadeTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, 0, 128, 10);
  for (let y = 18; y < 246; y += 26) {
    for (let x = 10; x < 118; x += 26) {
      g.fillStyle = lit && Math.random() < 0.25 ? '#ffd98a' : '#2c3e50';
      g.fillRect(x, y, 18, 16);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildCity(scene, rng) {
  const colliders = [];   // { minX, maxX, minZ, maxZ }
  const buildingMeshes = [];
  const coins = [];
  const animated = { water: null, coinMeshes: [] };

  // ---- lights & sky ----
  scene.background = new THREE.Color(0x8ec9ee);
  scene.fog = new THREE.Fog(0xa8c8e0, 220, 700);
  const sun = new THREE.DirectionalLight(0xfff0c8, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -280; sun.shadow.camera.right = 280;
  sun.shadow.camera.top = 280; sun.shadow.camera.bottom = -280;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 1.1));

  // ---- ground: grass base, city slab, sand, ocean ----
  const groundMat = new THREE.MeshLambertMaterial({ color: 0x7fae62 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(120, -0.05, 0);
  ground.receiveShadow = true;
  scene.add(ground);

  const slab = new THREE.Mesh(
    new THREE.PlaneGeometry(560, 560),
    new THREE.MeshLambertMaterial({ color: 0x9aa0a3 }),
  );
  slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0, 0);
  slab.receiveShadow = true;
  scene.add(slab);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 700),
    new THREE.MeshLambertMaterial({ color: 0xeed9a4 }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(306, 0.02, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const waterMat = new THREE.MeshPhongMaterial({ color: 0x1e7fa8, transparent: true, opacity: 0.85, shininess: 120 });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(560, 700), waterMat);
  water.rotation.x = -Math.PI / 2; water.position.set(620, 0.1, 0);
  scene.add(water);
  animated.water = water;

  // ---- roads (dark strips + center dashes) ----
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const line of CFG.roadLines) {
    for (const horizontal of [true, false]) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(520, CFG.roadWidth), roadMat);
      road.rotation.x = -Math.PI / 2;
      if (!horizontal) road.rotation.z = Math.PI / 2;
      road.position.set(horizontal ? 0 : line, 0.03, horizontal ? line : 0);
      road.receiveShadow = true;
      scene.add(road);
      // center dashes
      for (let d = -240; d <= 240; d += 24) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        if (!horizontal) dash.rotation.z = Math.PI / 2;
        dash.position.set(horizontal ? d : line, 0.05, horizontal ? line : d);
        scene.add(dash);
      }
    }
  }

  // ---- buildings with procedural facades ----
  const facadeMats = PALETTE.slice(0, 5).map((hex) => {
    const css = '#' + hex.toString(16).padStart(6, '0');
    return new THREE.MeshLambertMaterial({ map: facadeTexture(css, true) });
  });
  const roofMats = ROOFS.map((hex) => new THREE.MeshLambertMaterial({ color: hex }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const lines = CFG.roadLines;
  const half = CFG.roadWidth / 2 + 1;
  let buildingCount = 0;
  for (let bx = 0; bx < lines.length - 1; bx++) {
    for (let bz = 0; bz < lines.length - 1; bz++) {
      const x0 = lines[bx] + half, x1 = lines[bx + 1] - half;
      const z0 = lines[bz] + half, z1 = lines[bz + 1] - half;
      if (x0 > 240) continue; // beach side stays open
      const centerDist = Math.hypot((x0 + x1) / 2, (z0 + z1) / 2);
      const downtown = centerDist < 120;
      const n = downtown ? rng.int(2, 3) : rng.int(1, 2);
      for (let i = 0; i < n; i++) {
        const w = rng.range(16, 30), d = rng.range(16, 30);
        const cx = rng.range(x0 + w / 2 + 2, x1 - w / 2 - 2);
        const cz = rng.range(z0 + d / 2 + 2, z1 - d / 2 - 2);
        if (cx - w / 2 < x0 || cz - d / 2 < z0) continue;
        const h = downtown ? rng.range(16, 44) : rng.range(8, 22);
        const side = facadeMats[rng.int(0, facadeMats.length - 1)];
        const roof = roofMats[rng.int(0, roofMats.length - 1)];
        const mesh = new THREE.Mesh(boxGeo, [side, side, roof, side, side, side]);
        mesh.scale.set(w, h, d);
        mesh.position.set(cx, h / 2, cz);
        mesh.castShadow = true; mesh.receiveShadow = true;
        scene.add(mesh);
        buildingMeshes.push(mesh);
        colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
        buildingCount++;
        // rooftop AC box on tall towers
        if (h > 26) {
          const ac = new THREE.Mesh(boxGeo, roof);
          ac.scale.set(4, 2, 4);
          ac.position.set(cx + w / 4, h + 1, cz);
          scene.add(ac);
        }
      }
    }
  }

  // ---- landmark: the Marina Tower (tallest, gold-topped) ----
  const tower = new THREE.Mesh(boxGeo, [facadeMats[1], facadeMats[1], roofMats[0], facadeMats[1], facadeMats[1], facadeMats[1]]);
  tower.scale.set(26, 58, 26);
  tower.position.set(238, 29, -150);
  tower.castShadow = true;
  scene.add(tower);
  buildingMeshes.push(tower);
  colliders.push({ minX: 225, maxX: 251, minZ: -163, maxZ: -137 });

  // ---- palms along the beach and the main avenue ----
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 5.5, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  const crownGeo = new THREE.ConeGeometry(2.6, 4.5, 7);
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
  const palmSpots = [];
  for (let z = -260; z <= 260; z += 26) palmSpots.push([272 + rng.range(-3, 3), z]);
  for (let x = -200; x <= 200; x += 40) palmSpots.push([x, 8]);
  for (const [px, pz] of palmSpots) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(px, 2.75, pz);
    trunk.castShadow = true;
    scene.add(trunk);
    const crown = new THREE.Mesh(crownGeo, crownMat);
    crown.position.set(px, 6.6, pz);
    crown.scale.y = 0.75;
    crown.castShadow = true;
    scene.add(crown);
    colliders.push({ minX: px - 0.4, maxX: px + 0.4, minZ: pz - 0.4, maxZ: pz + 0.4 });
  }

  // ---- street lamps on the main avenues ----
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f33 });
  const bulbGeo = new THREE.SphereGeometry(0.35, 8, 6);
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const line of [-148, 0, 148]) {
    for (let d = -200; d <= 200; d += 50) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(line + 8, 3, d);
      scene.add(pole);
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(line + 8, 6.1, d);
      scene.add(bulb);
    }
  }

  // ---- beach umbrellas + crates near the warehouse corner ----
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xff6b6b });
  const umbMat2 = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
  for (let i = 0; i < 8; i++) {
    const ux = 282 + rng.range(0, 26), uz = -200 + i * 55 + rng.range(-8, 8);
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(ux, 1.2, uz); pole.scale.y = 0.4;
    scene.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.1, 8), i % 2 ? umbMat : umbMat2);
    top.position.set(ux, 2.8, uz);
    scene.add(top);
  }
  const crateMat = new THREE.MeshLambertMaterial({ color: 0xa8763e });
  for (let i = 0; i < 10; i++) {
    const crate = new THREE.Mesh(boxGeo, crateMat);
    const cx = -205 + rng.range(-8, 8), cz = -195 + rng.range(-8, 8);
    crate.scale.set(2.2, 2.2, 2.2);
    crate.position.set(cx, 1.1, cz);
    crate.castShadow = true;
    scene.add(crate);
    colliders.push({ minX: cx - 1.1, maxX: cx + 1.1, minZ: cz - 1.1, maxZ: cz + 1.1 });
  }

  // ---- clouds ----
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
  const cloudGeo = new THREE.SphereGeometry(1, 8, 6);
  for (let i = 0; i < 6; i++) {
    const cloud = new THREE.Group();
    const n = 3 + rng.int(0, 2);
    for (let j = 0; j < n; j++) {
      const puff = new THREE.Mesh(cloudGeo, cloudMat);
      puff.position.set(j * 7 - n * 3, rng.range(-1, 1), rng.range(-3, 3));
      puff.scale.set(rng.range(6, 11), rng.range(2.5, 4), rng.range(4, 6));
      cloud.add(puff);
    }
    cloud.position.set(rng.range(-300, 300), rng.range(90, 130), rng.range(-300, 300));
    scene.add(cloud);
  }

  // ---- gold coins (collectibles) ----
  const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.22, 16);
  const coinMat = new THREE.MeshPhongMaterial({ color: 0xffd23e, emissive: 0x8a6a00, shininess: 90 });
  const coinSpots = [
    [0, 40], [-148, -74], [74, 148], [-74, 222], [222, 0], [-222, 74],
    [148, -222], [-37, -148], [290, 40], [110, -110],
  ];
  for (let i = 0; i < CFG.coins; i++) {
    const [cx, cz] = coinSpots[i];
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.rotation.x = Math.PI / 2;
    coin.position.set(cx, 1.4, cz);
    scene.add(coin);
    coins.push({ mesh: coin, x: cx, z: cz, taken: false });
    animated.coinMeshes.push(coin);
  }

  // ---- named places the missions use ----
  const places = {
    start: { x: -10, z: 60 },
    marinaCafe: { x: 252, z: 96 },
    garage: { x: -180, z: 180 },
    warehouse: { x: -198, z: -192 },
    hideout: { x: 196, z: -196 },
    beach: { x: 292, z: 0 },
    marina: { x: 280, z: -60 },
    yacht: { x: 352, z: -60 },
  };

  return {
    colliders, coins, places, buildingCount, buildingMeshes,
    roadLines: CFG.roadLines,
    update(dt, t) {
      if (animated.water) animated.water.position.y = 0.1 + Math.sin(t * 0.7) * 0.06;
      for (const c of animated.coinMeshes) {
        c.rotation.y += dt * 2.2;
        c.position.y = 1.4 + Math.sin(t * 2 + c.position.x) * 0.15;
      }
    },
  };
}

// Circle-vs-AABB push-out; returns corrected x,z.
export function collideCircle(x, z, radius, colliders) {
  for (const b of colliders) {
    const cx = Math.max(b.minX, Math.min(x, b.maxX));
    const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radius * radius) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * radius;
        z = cz + (dz / d) * radius;
      } else {
        // center inside the box: push out along the smallest penetration axis
        const pl = x - b.minX, pr = b.maxX - x, pt = z - b.minZ, pb = b.maxZ - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.minX - radius;
        else if (m === pr) x = b.maxX + radius;
        else if (m === pt) z = b.minZ - radius;
        else z = b.maxZ + radius;
      }
    }
  }
  return { x, z };
}

export function clampWorld(x, z) {
  return {
    x: Math.max(-CFG.worldBound, Math.min(CFG.worldBound, x)),
    z: Math.max(-CFG.worldBound, Math.min(CFG.worldBound, z)),
  };
}
