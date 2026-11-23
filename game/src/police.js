// Wanted level and the Bay PD response: cruisers that chase and ram,
// foot cops that close in and try to bust the player.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePoliceCar } from './vehicles.js';
import { makePersonMesh } from './pedestrians.js';
import { collideCircle, clampWorld } from './city.js';

export class WantedSystem {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.stars = 0;
    this.decayTimer = 0;
    this.copCars = [];
    this.copPeds = [];
    this.bustTimer = 0;
    this._flash = 0;
  }
  addStars(n, silent = false) {
    const before = this.stars;
    this.stars = Math.min(CFG.maxWanted, this.stars + n);
    this.decayTimer = 0;
    if (this.stars > before && !silent) this.audio.setSiren(this.stars > 0);
    return this.stars;
  }
  clear() {
    this.stars = 0;
    this.decayTimer = 0;
    this.audio.setSiren(false);
    this.despawnAll();
  }
  despawnAll() {
    for (const c of this.copCars) this.scene.remove(c.mesh);
    for (const p of this.copPeds) this.scene.remove(p.mesh);
    this.copCars = [];
    this.copPeds = [];
  }
  // Spawn a cruiser on the nearest road, a little way off so it drives in.
  _spawnCopCar(px, pz, rng) {
    const line = CFG.roadLines.reduce((a, b) => (Math.abs(b - px) < Math.abs(a - px) ? b : a));
    const x = line + 3.4;
    const z = pz + (rng.chance(0.5) ? 60 : -60);
    const car = makePoliceCar(this.scene, x, Math.max(-240, Math.min(240, z)), 0);
    car.speed = 30;
    this.copCars.push(car);
    return car;
  }
  _spawnCopPed(px, pz, rng) {
    const mesh = makePersonMesh(0x1a3a6b, 0xf1c27d);
    this.scene.add(mesh);
    const a = rng.range(0, Math.PI * 2);
    const ped = {
      mesh, x: px + Math.sin(a) * 18, z: pz + Math.cos(a) * 18,
      heading: a, speed: 6.5, shootTimer: rng.range(0.5, 1.5), health: CFG.copHealth,
    };
    mesh.userData.copRef = ped;
    this.copPeds.push(ped);
    return ped;
  }
  update(dt, player, rng, colliders, onBusted, onCopShot) {
    const px = player.x, pz = player.z;
    // decay: one star per quiet stretch with no cop nearby
    if (this.stars > 0) {
      const nearCop = this.copCars.some((c) => Math.hypot(c.x - px, c.z - pz) < 45)
        || this.copPeds.some((p) => Math.hypot(p.x - px, p.z - pz) < 30);
      if (!nearCop) {
        this.decayTimer += dt;
        if (this.decayTimer > CFG.wantedDecayMs / 1000) {
          this.stars--;
          this.decayTimer = 0;
          if (this.stars === 0) { this.audio.setSiren(false); this.despawnAll(); }
        }
      } else {
        this.decayTimer = 0;
      }
    }
    // keep the right number of cruisers on the road
    const wantCars = Math.min(this.stars, 3);
    while (this.copCars.length < wantCars) this._spawnCopCar(px, pz, rng);
    while (this.copCars.length > wantCars) {
      const c = this.copCars.pop();
      this.scene.remove(c.mesh);
    }
    // foot cops when the player is on foot and the heat is on
    const wantPeds = !player.inCar && this.stars >= 2 ? Math.min(2, this.stars - 1) : 0;
    while (this.copPeds.length < wantPeds) this._spawnCopPed(px, pz, rng);
    while (this.copPeds.length > wantPeds) {
      const p = this.copPeds.pop();
      this.scene.remove(p.mesh);
    }
    // cruisers chase: steer toward the player, ram on contact
    for (const car of this.copCars) {
      const dx = px - car.x, dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let diff = wantHeading - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.heading += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
      car.speed = dist > 60 ? 44 : 36;
      const f = car.forward();
      const nx = car.x + f.x * car.speed * dt;
      const nz = car.z + f.z * car.speed * dt;
      const hit = collideCircle(nx, nz, CFG.carRadius, colliders);
      const c = clampWorld(hit.x, hit.z);
      car.x = c.x; car.z = c.z;
      car.sync();
      // flash the light bar
      this._flash += dt;
      const bar = car.mesh.userData.lightBar;
      if (bar) bar.material.color.setHex(Math.floor(this._flash * 3) % 2 === 0 ? 0xff2222 : 0x2244ff);
      // ramming (once per second per cruiser)
      car._ramCd = Math.max(0, (car._ramCd || 0) - dt);
      if (dist < 3.4 && car._ramCd <= 0) {
        car._ramCd = 1;
        if (player.inCar) {
          player.car.speed *= 0.6;
          onBusted?.('ram');
        } else {
          onCopShot(18, 'ram');
        }
      }
    }
    // foot cops close in, shoot, and bust the player up close
    let busting = false;
    for (const p of this.copPeds) {
      const dx = px - p.x, dz = pz - p.z;
      const dist = Math.hypot(dx, dz);
      p.heading = Math.atan2(dx, dz);
      if (dist > 2.2) {
        const nx = p.x + Math.sin(p.heading) * p.speed * dt;
        const nz = p.z + Math.cos(p.heading) * p.speed * dt;
        const hit = collideCircle(nx, nz, 0.5, colliders);
        p.x = hit.x; p.z = hit.z;
      } else {
        busting = true;
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      p.shootTimer -= dt;
      if (p.shootTimer <= 0 && dist < 34) {
        p.shootTimer = 1.4;
        onCopShot(7, 'shot');
        this.audio.enemyShoot();
      }
    }
    if (busting) {
      this.bustTimer += dt;
      if (this.bustTimer > 2.2) { this.bustTimer = 0; onBusted?.('busted'); }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
