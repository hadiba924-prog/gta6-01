// The story: 7 missions for Danny Cruz, from a sunrise courier run to the
// last score at the marina. One manager drives objectives, markers,
// enemies, checkpoints and cash drops for whichever mission is active.
import * as THREE from 'three';
import { CFG } from './config.js';
import { Enemy, makeEnemyMesh } from './combat.js';
import { makeCarMesh, Car } from './vehicles.js';

export const MISSION_DEFS = [
  { id: 1, title: 'SUNRISE DELIVERY', reward: 400, respect: 100, type: 'goto', target: 'marinaCafe',
    text: 'Pick up the package at the Marina Café. Walk or drive — the sun is already up.' },
  { id: 2, title: 'BORROWED WHEELS', reward: 600, respect: 150, type: 'deliver', target: 'garage',
    text: 'Steal any car (E) and bring it to the garage on the south side. The crew needs wheels.' },
  { id: 3, title: 'BEACHFRONT RUSH', reward: 900, respect: 200, type: 'race', timeLimit: 115,
    checkpoints: [[74, 148], [222, 148], [222, -74], [0, -74], [-148, -74], [-148, 222]],
    text: 'Street race! Hit every checkpoint before the clock runs out. Grab a fast car first.' },
  { id: 4, title: 'DOCKSIDE TROUBLE', reward: 1200, respect: 250, type: 'combat', target: 'warehouse', count: 5,
    text: 'Rivals took over the old warehouse. Clear all 5 of them out. Click to shoot, R to reload.' },
  { id: 5, title: 'HOT PURSUIT', reward: 1500, respect: 300, type: 'escape', target: 'hideout',
    text: 'The Bay PD is onto you — 3 stars! Lose them and reach the hideout up north.' },
  { id: 6, title: 'SAND & CASH', reward: 1800, respect: 350, type: 'collect', target: 'beach', count: 6,
    text: 'Cash bags are stashed along the beach. Collect all 6 before the tide — or the cops — get them.' },
  { id: 7, title: 'THE LAST SCORE', reward: 4000, respect: 600, type: 'final', target: 'marina', count: 8,
    text: 'The big one. Take down 8 rivals at the marina, then drive the gold getaway car to the yacht.' },
];

const RANKS = [
  [0, 'ROOKIE'], [300, 'WHEELMAN'], [800, 'HUSTLER'], [1500, 'STREET KING'], [2500, 'BAY LEGEND'],
];
export function rankFor(respect) {
  let r = RANKS[0][1];
  for (const [min, name] of RANKS) if (respect >= min) r = name;
  return r;
}

export class MissionManager {
  constructor(ctx) {
    this.ctx = ctx; // { scene, rng, places, player, wanted, audio, effects, addDrivableCar }
    this.index = 0;
    this.def = null;
    this.active = false;
    this.enemies = [];
    this.items = [];
    this.checkpoints = [];
    this.cpIndex = 0;
    this.timer = 0;
    this.phase = '';
    this.getawayCar = null;
    this.kills = 0;
    // marker beacon
    const mat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
    this.marker = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 34, 18, 1, true), mat);
    this.marker.visible = false;
    ctx.scene.add(this.marker);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 3.4, 24), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    ctx.scene.add(this.ring);
  }
  get target() {
    if (!this.def) return null;
    if (this.def.type === 'race') return this.checkpoints[this.cpIndex] || null;
    if (this.def.type === 'final' && this.phase === 'drive') return this.ctx.places.yacht;
    if (this.def.type === 'collect') return this.ctx.places.beach;
    return this.ctx.places[this.def.target];
  }
  start(index) {
    this.cleanup();
    this.index = index;
    this.def = MISSION_DEFS[index];
    this.active = true;
    this.kills = 0;
    this.cpIndex = 0;
    this.phase = this.def.type === 'final' ? 'fight' : 'go';
    const { places, rng, scene } = this.ctx;
    if (this.def.type === 'race') {
      this.checkpoints = this.def.checkpoints.map(([x, z]) => ({ x, z }));
      this.timer = this.def.timeLimit;
    }
    if (this.def.type === 'combat' || this.def.type === 'final') {
      const p = places[this.def.target];
      for (let i = 0; i < this.def.count; i++) {
        const mesh = makeEnemyMesh();
        scene.add(mesh);
        const e = new Enemy(mesh, p.x + rng.range(-14, 14), p.z + rng.range(-14, 14), rng);
        this.enemies.push(e);
      }
    }
    if (this.def.type === 'collect') {
      for (let i = 0; i < this.def.count; i++) {
        const bag = new THREE.Group();
        const box = new THREE.Mesh(
          new THREE.BoxGeometry(1.3, 0.8, 0.7),
          new THREE.MeshLambertMaterial({ color: 0x2ecc71, emissive: 0x0a5a22 }),
        );
        box.castShadow = true;
        bag.add(box);
        const strap = new THREE.Mesh(
          new THREE.BoxGeometry(1.36, 0.2, 0.76),
          new THREE.MeshBasicMaterial({ color: 0xffd23e }),
        );
        bag.add(strap);
        const x = 290 + rng.range(-4, 4);
        const z = -150 + i * 60 + rng.range(-10, 10);
        bag.position.set(x, 0.6, z);
        scene.add(bag);
        this.items.push({ mesh: bag, x, z, taken: false });
      }
    }
    if (this.def.type === 'escape') {
      this.ctx.wanted.addStars(3);
    }
    this.ctx.audio.pickup();
  }
  registerKill() { this.kills++; }
  cleanup() {
    const { scene } = this.ctx;
    for (const e of this.enemies) scene.remove(e.mesh);
    for (const it of this.items) scene.remove(it.mesh);
    this.enemies = [];
    this.items = [];
    this.active = false;
    this.marker.visible = false;
    this.ring.visible = false;
  }
  _distTo(t) {
    const p = this.ctx.player;
    return Math.hypot(p.x - t.x, p.z - t.z);
  }
  _complete() {
    this.active = false;
    this.marker.visible = false;
    this.ring.visible = false;
    this.ctx.onComplete(this.def);
  }
  _fail(reason) {
    this.ctx.onFail(this.def, reason);
  }
  update(dt, t) {
    if (!this.active || !this.def) return;
    const p = this.ctx.player;
    const tgt = this.target;
    if (tgt) {
      this.marker.visible = true;
      this.ring.visible = true;
      this.marker.position.set(tgt.x, 17, tgt.z);
      this.ring.position.set(tgt.x, 0.08, tgt.z);
      const pulse = 1 + Math.sin(t * 4) * 0.12;
      this.ring.scale.set(pulse, pulse, 1);
    }
    // mission enemies fight the player
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      const remove = e.update(dt, p, this.ctx.audio, this.ctx.effects, (dmg) => p.damage(dmg));
      if (remove) {
        this.ctx.scene.remove(e.mesh);
        this.enemies.splice(i, 1);
      }
    }
    switch (this.def.type) {
      case 'goto':
        if (this._distTo(tgt) < CFG.markerRadius) this._complete();
        break;
      case 'deliver':
        if (p.inCar && this._distTo(tgt) < CFG.markerRadius) this._complete();
        break;
      case 'race': {
        this.timer -= dt;
        if (this.timer <= 0) { this._fail('Time ran out!'); return; }
        if (this._distTo(tgt) < 9) {
          this.cpIndex++;
          this.ctx.audio.pickup();
          this.ctx.effects.burst(new THREE.Vector3(tgt.x, 2, tgt.z), 0xffd23e, 20, 8, 0.8, 4);
          if (this.cpIndex >= this.checkpoints.length) this._complete();
        }
        break;
      }
      case 'combat':
        if (this.kills >= this.def.count) this._complete();
        break;
      case 'escape':
        if (this._distTo(tgt) < CFG.markerRadius) this._complete();
        break;
      case 'collect': {
        for (const it of this.items) {
          if (!it.taken && Math.hypot(p.x - it.x, p.z - it.z) < 2.4) {
            it.taken = true;
            this.ctx.scene.remove(it.mesh);
            this.ctx.audio.coin();
            this.ctx.effects.floatText('+$150', new THREE.Vector3(it.x, 2, it.z));
          }
        }
        if (this.items.every((i) => i.taken)) this._complete();
        break;
      }
      case 'final': {
        if (this.phase === 'fight') {
          if (this.kills >= this.def.count) {
            this.phase = 'drive';
            const mesh = makeCarMesh(0xffd23e);
            this.ctx.scene.add(mesh);
            const car = new Car(mesh, this.ctx.places.marina.x + 8, this.ctx.places.marina.z, Math.PI / 2);
            this.getawayCar = car;
            this.ctx.addDrivableCar(car);
            this.ctx.toast('Getaway car is ready — drive it to the yacht!');
            this.ctx.audio.missionDone();
          }
        } else if (p.inCar && p.car === this.getawayCar && this._distTo(this.ctx.places.yacht) < 12) {
          this._complete();
        }
        break;
      }
    }
  }
  objectiveText() {
    if (!this.def) return { title: 'FREE ROAM', text: 'Explore Solmar Bay. Coins, cars and trouble are everywhere.', dist: '' };
    const tgt = this.target;
    const p = this.ctx.player;
    const dist = tgt ? `${Math.round(Math.hypot(p.x - tgt.x, p.z - tgt.z))}m` : '';
    let text = this.def.text;
    if (this.def.type === 'race') text = `Checkpoint ${this.cpIndex + 1}/${this.checkpoints.length} — ${Math.ceil(this.timer)}s left`;
    if (this.def.type === 'combat' || (this.def.type === 'final' && this.phase === 'fight')) {
      text = `Rivals left: ${this.def.count - this.kills} — clear them out!`;
    }
    if (this.def.type === 'collect') {
      const got = this.items.filter((i) => i.taken).length;
      text = `Cash bags: ${got}/${this.def.count} collected`;
    }
    if (this.def.type === 'final' && this.phase === 'drive') text = 'Drive the gold getaway car to the yacht!';
    if (this.def.type === 'deliver' && !p.inCar) text = 'You need a car first — press E near any car to steal it.';
    return { title: `MISSION ${this.def.id} — ${this.def.title}`, text, dist };
  }
}
