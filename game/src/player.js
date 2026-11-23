// Danny Cruz on foot: WASD movement relative to the camera, sprint,
// jump, and the third-person camera rig that follows him and his car.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makePersonMesh } from './pedestrians.js';
import { collideCircle, clampWorld } from './city.js';

export class Player {
  constructor(scene) {
    this.mesh = makePersonMesh(0xf2c14e, 0xe0ac69);
    scene.add(this.mesh);
    this.x = 0; this.z = 0;
    this.y = 0; this.vy = 0;
    this.heading = 0;
    this.yaw = 0;          // camera yaw
    this.pitch = 0.32;     // camera pitch (0..0.9)
    this.health = CFG.playerHealth;
    this.dead = false;
    this.inCar = false;
    this.car = null;
    this.lastDamageAt = 0;
    this._bob = 0;
  }
  spawn(x, z) {
    this.x = x; this.z = z; this.y = 0; this.vy = 0;
    this.heading = 0; this.yaw = 0;
    this.health = CFG.playerHealth;
    this.dead = false;
    this.inCar = false;
    this.car = null;
    this.mesh.visible = true;
    this.mesh.rotation.set(0, 0, 0);
    this.sync();
  }
  sync() {
    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.heading;
  }
  updateOnFoot(dt, input, colliders, audio) {
    // mouse look
    this.yaw -= input.mouseDX * 0.0032;
    this.pitch += input.mouseDY * 0.0022;
    this.pitch = Math.max(0.08, Math.min(0.95, this.pitch));
    const ax = input.axis();
    const sprint = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = sprint ? CFG.sprintSpeed : CFG.walkSpeed;
    // movement relative to camera yaw
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    let mx = fx * ax.z + rx * ax.x;
    let mz = fz * ax.z + rz * ax.x;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len; mz /= len;
      this.heading = Math.atan2(mx, mz);
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      const hit = collideCircle(nx, nz, CFG.playerRadius, colliders);
      const c = clampWorld(hit.x, hit.z);
      this.x = c.x; this.z = c.z;
      this._bob += dt * (sprint ? 13 : 9);
    }
    // jump + gravity
    if (input.pressed('Space') && this.y <= 0.01) this.vy = CFG.jumpSpeed;
    this.vy -= 22 * dt;
    this.y += this.vy * dt;
    if (this.y <= 0) { this.y = 0; this.vy = 0; }
    this.sync();
    this.mesh.position.y = this.y + (len > 0.01 ? Math.abs(Math.sin(this._bob)) * 0.07 : 0);
  }
  enterCar(car) {
    this.inCar = true;
    this.car = car;
    car.parked = false;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.car) return;
    const f = this.car.forward();
    this.x = this.car.x - f.x * 3.5;
    this.z = this.car.z - f.z * 3.5;
    this.y = 0;
    this.inCar = false;
    this.car.speed = 0;
    this.car = null;
    this.mesh.visible = true;
    this.heading = this.yaw;
    this.sync();
  }
  damage(amount) {
    if (this.dead) return;
    this.health -= amount;
    this.lastDamageAt = performance.now();
    if (this.health <= 0) {
      this.health = 0;
      this.dead = true;
    }
  }
  regen(dt) {
    if (!this.dead && performance.now() - this.lastDamageAt > 5000 && this.health < CFG.playerHealth) {
      this.health = Math.min(CFG.playerHealth, this.health + 6 * dt);
    }
  }
  // Smooth third-person camera. Returns nothing; moves the camera.
  updateCamera(camera, dt, menuOrbitT = 0) {
    if (menuOrbitT > 0) {
      const a = menuOrbitT * 0.05;
      camera.position.set(Math.sin(a) * 190, 62, Math.cos(a) * 190);
      camera.lookAt(40, 12, 0);
      return;
    }
    const target = new THREE.Vector3();
    let dist, height, lookY;
    if (this.inCar && this.car) {
      const car = this.car;
      // chase cam: ease yaw toward behind-the-car
      const wantYaw = car.heading + Math.PI;
      let diff = wantYaw - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 3.2);
      dist = 11.5; height = 4.6; lookY = 1.4;
      target.set(car.x, 0, car.z);
    } else {
      dist = 7.5; height = 3.2; lookY = 1.7;
      target.set(this.x, this.y, this.z);
    }
    const pitchH = height * (0.5 + this.pitch);
    const cx = target.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch * 0.7);
    const cz = target.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch * 0.7);
    const cy = target.y + pitchH;
    camera.position.x += (cx - camera.position.x) * Math.min(1, dt * 10);
    camera.position.y += (cy - camera.position.y) * Math.min(1, dt * 10);
    camera.position.z += (cz - camera.position.z) * Math.min(1, dt * 10);
    camera.lookAt(target.x, target.y + lookY, target.z);
  }
}
