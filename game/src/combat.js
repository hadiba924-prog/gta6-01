// Combat: the player's pistol (hitscan), gang rivals who shoot back,
// and cars that smoke, catch fire and blow up when shot enough.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePersonMesh } from './pedestrians.js';

const _ray = new THREE.Raycaster();
const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function makeEnemyMesh() {
  const g = makePersonMesh(0xc0392b, 0xe0ac69);
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.12, 0.42),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.32, 1.15, 0.25);
  g.add(gun);
  return g;
}

export class Enemy {
  constructor(mesh, x, z, rng) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.health = CFG.enemyHealth;
    this.dead = false;
    this.deathTimer = 0;
    this.shootTimer = rng.range(0.6, 1.8);
    this.moveTimer = 0;
    this.heading = rng.range(0, Math.PI * 2);
    this.mesh.position.set(x, 0, z);
    this.mesh.userData.enemy = this;
  }
  update(dt, player, audio, effects, onPlayerHit) {
    if (this.dead) {
      this.deathTimer += dt;
      this.mesh.rotation.x = Math.min(Math.PI / 2, this.mesh.rotation.x + dt * 5);
      return this.deathTimer > 4;
    }
    const dx = player.x - this.x, dz = player.z - this.z;
    const dist = Math.hypot(dx, dz);
    this.heading = Math.atan2(dx, dz);
    // strafe and close in when far away
    this.moveTimer -= dt;
    if (dist > 26 && this.moveTimer <= 0) {
      this.moveTimer = 0.5;
      const nx = this.x + Math.sin(this.heading) * 4 * dt * 10;
      const nz = this.z + Math.cos(this.heading) * 4 * dt * 10;
      this.x = nx; this.z = nz;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // shoot back
    this.shootTimer -= dt;
    if (this.shootTimer <= 0 && dist < 46 && !player.dead) {
      this.shootTimer = 1.3 + Math.random() * 0.9;
      const hitChance = Math.max(0.2, 0.55 - dist / 90);
      if (Math.random() < hitChance) onPlayerHit(6 + Math.random() * 5);
      audio.enemyShoot();
      effects.burst(new THREE.Vector3(this.x, 1.3, this.z), 0xffe9a3, 4, 3, 0.12, 0.4);
    }
    return false;
  }
  damage(amount, effects) {
    this.health -= amount;
    effects.burst(new THREE.Vector3(this.x, 1.3, this.z), 0xff4444, 8, 5, 0.4, 2);
    if (this.health <= 0 && !this.dead) {
      this.dead = true;
      this.deathTimer = 0;
      effects.burst(new THREE.Vector3(this.x, 1, this.z), 0xcc2222, 16, 7, 0.7, 3);
      return true;
    }
    return false;
  }
}

export class Combat {
  constructor(scene, camera, audio, effects) {
    this.scene = scene;
    this.camera = camera;
    this.audio = audio;
    this.effects = effects;
    this.ammo = CFG.pistolMag;
    this.reloading = 0;
    this.cooldown = 0;
    this.carHp = new Map(); // car -> hp
    this.tracers = [];
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.tracerGeo = geo;
  }
  // Fires one shot from the camera center. Returns a hit report or null.
  shoot(playerPos, enemies, copPeds, cars, peds, buildings) {
    if (this.cooldown > 0 || this.reloading > 0) return null;
    if (this.ammo <= 0) { this.startReload(); return { empty: true }; }
    this.cooldown = 0.16;
    this.ammo--;
    this.audio.shoot();
    this.camera.getWorldDirection(_dir);
    _ray.set(this.camera.position, _dir);
    _ray.far = CFG.pistolRange;
    const targets = [];
    for (const e of enemies) if (!e.dead) targets.push(e.mesh);
    for (const p of copPeds) targets.push(p.mesh);
    for (const c of cars) targets.push(c.mesh);
    for (const p of peds) if (!p.dead) targets.push(p.mesh);
    targets.push(...buildings);
    const hits = _ray.intersectObjects(targets, true);
    const muzzle = this.camera.position.clone().addScaledVector(_dir, 1.2);
    muzzle.y -= 0.25;
    this.effects.muzzle(muzzle, _dir);
    if (!hits.length) {
      this._tracer(muzzle, this.camera.position.clone().addScaledVector(_dir, CFG.pistolRange));
      return { hit: false };
    }
    const h = hits[0];
    const point = h.point.clone();
    this._tracer(muzzle, point);
    let obj = h.object;
    while (obj && !obj.userData.enemy && !obj.userData.carRef && !obj.userData.pedRef && !obj.userData.copRef) obj = obj.parent;
    if (obj?.userData.enemy) {
      const enemy = obj.userData.enemy;
      const killed = enemy.damage(CFG.pistolDamage, this.effects);
      return { hit: true, kind: 'enemy', enemy, killed, point };
    }
    if (obj?.userData.copRef) {
      const cop = obj.userData.copRef;
      cop.health -= CFG.pistolDamage;
      this.effects.burst(point, 0xff4444, 8, 5, 0.4, 2);
      return { hit: true, kind: 'cop', cop, killed: cop.health <= 0, point };
    }
    if (obj?.userData.carRef) {
      const car = obj.userData.carRef;
      const hp = (this.carHp.get(car) ?? 100) - CFG.pistolDamage;
      this.carHp.set(car, hp);
      this.effects.burst(point, 0xffd23e, 6, 5, 0.35, 2);
      if (hp <= 0) {
        this.explodeCar(car);
        return { hit: true, kind: 'car', car, killed: true, point };
      }
      return { hit: true, kind: 'car', car, killed: false, point };
    }
    if (obj?.userData.pedRef) {
      const ped = obj.userData.pedRef;
      ped.dead = true;
      this.scene.remove(ped.mesh);
      return { hit: true, kind: 'ped', ped, killed: true, point };
    }
    this.effects.burst(point, 0xcccccc, 5, 3, 0.3, 1);
    return { hit: true, kind: 'wall', point };
  }
  explodeCar(car) {
    const pos = new THREE.Vector3(car.x, 1, car.z);
    this.effects.explosion(pos);
    this.audio.explosion();
    this.scene.remove(car.mesh);
    car.dead = true;
    this.carHp.delete(car);
  }
  startReload() {
    if (this.reloading > 0 || this.ammo === CFG.pistolMag) return;
    this.reloading = CFG.pistolReloadMs / 1000;
  }
  _tracer(from, to) {
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints([from, to]);
    const mat = new THREE.LineBasicMaterial({ color: 0xffe9a3, transparent: true, opacity: 0.9 });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ line, life: 0.09 });
  }
  update(dt) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this.ammo = CFG.pistolMag; this.reloading = 0; }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose(); t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
