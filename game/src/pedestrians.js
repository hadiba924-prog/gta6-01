// Pedestrians: ordinary Solmar Bay locals strolling the sidewalks.
// They wander, dodge buildings, and run when shots ring out.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle, clampWorld } from './city.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0xfd79a8];
const SKINS = [0xf1c27d, 0xe0ac69, 0x8d5524, 0xffdbac, 0xc68642];

export function makePersonMesh(shirtColor, skinColor) {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.8, 0.26),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
  );
  legs.position.y = 0.4;
  g.add(legs);
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.65, 0.3),
    new THREE.MeshLambertMaterial({ color: shirtColor }),
  );
  torso.position.y = 1.12;
  torso.castShadow = true;
  g.add(torso);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: skinColor }),
  );
  head.position.y = 1.66;
  head.castShadow = true;
  g.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x2c1e12 }),
  );
  hair.position.y = 1.7;
  g.add(hair);
  return g;
}

export class Pedestrian {
  constructor(mesh, x, z, rng) {
    this.mesh = mesh;
    this.mesh.userData.pedRef = this;
    this.x = x; this.z = z;
    this.heading = rng.range(0, Math.PI * 2);
    this.speed = rng.range(1.2, 2.4);
    this.target = null;
    this.fleeing = 0;
    this.dead = false;
    this.mesh.position.set(x, 0, z);
  }
  pickTarget(rng) {
    const line = rng.pick(CFG.roadLines);
    const along = rng.range(-230, 230);
    const off = rng.chance(0.5) ? 9.5 : -9.5;
    if (rng.chance(0.5)) this.target = { x: along, z: line + off };
    else this.target = { x: line + off, z: along };
  }
  update(dt, rng, colliders, threats) {
    if (this.dead) return;
    // flee from a threat (gunfire, a speeding car)
    let fx = 0, fz = 0;
    for (const t of threats) {
      const dx = this.x - t.x, dz = this.z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < 14 && d > 0.01) { fx += (dx / d) * (14 - d); fz += (dz / d) * (14 - d); }
    }
    if (fx || fz) {
      this.fleeing = 1.2;
      const len = Math.hypot(fx, fz);
      this.heading = Math.atan2(fx / len, fz / len);
      const s = 5.2;
      const nx = this.x + Math.sin(this.heading) * s * dt;
      const nz = this.z + Math.cos(this.heading) * s * dt;
      const hit = collideCircle(nx, nz, 0.5, colliders);
      const c = clampWorld(hit.x, hit.z);
      this.x = c.x; this.z = c.z;
    } else {
      if (this.fleeing > 0) this.fleeing -= dt;
      if (!this.target) this.pickTarget(rng);
      const dx = this.target.x - this.x, dz = this.target.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 1.5) { this.target = null; return; }
      this.heading = Math.atan2(dx / d, dz / d);
      const nx = this.x + (dx / d) * this.speed * dt;
      const nz = this.z + (dz / d) * this.speed * dt;
      const hit = collideCircle(nx, nz, 0.5, colliders);
      const c = clampWorld(hit.x, hit.z);
      this.x = c.x; this.z = c.z;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // simple walk bob
    const t = performance.now() / 1000;
    this.mesh.position.y = Math.abs(Math.sin(t * 6 + this.x)) * 0.06;
  }
}

export function spawnPedestrians(scene, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const mesh = makePersonMesh(rng.pick(SHIRTS), rng.pick(SKINS));
    scene.add(mesh);
    const line = rng.pick(CFG.roadLines);
    const along = rng.range(-230, 230);
    const off = rng.chance(0.5) ? 9.5 : -9.5;
    const x = rng.chance(0.5) ? along : line + off;
    const z = rng.chance(0.5) ? line + off : along;
    peds.push(new Pedestrian(mesh, x, z, rng));
  }
  return peds;
}
