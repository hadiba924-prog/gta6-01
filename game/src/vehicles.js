// Cars: a low-poly factory, arcade driving physics, traffic that follows
// the road grid, parked cars to steal, and black-and-white police cruisers.
import * as THREE from 'three';
import { CFG } from './config.js';
import { collideCircle, clampWorld } from './city.js';

export const CAR_COLORS = [0xd94f3d, 0x3d7ad9, 0xf2c14e, 0x7ac74f, 0x9b59b6, 0xe8e8e8, 0x2c2f33, 0x1abc9c, 0xff8c42];

export function makeCarMesh(color, isPolice = false) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x111111 : color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabinMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0xf5f5f5 : 0x1a2530 });
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), cabinMat);
  cabin.position.set(0, 1.1, -0.25);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz, front] of [[-0.95, 1.45, true], [0.95, 1.45, true], [-0.95, -1.45, false], [0.95, -1.45, false]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push({ mesh: w, front });
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const s of [-0.6, 0.6]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.1), lightMat);
    hl.position.set(s, 0.62, 2.16);
    g.add(hl);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
  for (const s of [-0.6, 0.6]) {
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.1), tailMat);
    tl.position.set(s, 0.62, -2.16);
    g.add(tl);
  }
  if (isPolice) {
    const barMat = new THREE.MeshBasicMaterial({ color: 0x2244ff });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), barMat);
    bar.position.set(0, 1.45, -0.25);
    g.add(bar);
    g.userData.lightBar = bar;
    const doorMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 1.4), doorMat);
    door.position.set(0, 0.62, 0.2);
    g.add(door);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Car {
  constructor(mesh, x, z, heading) {
    this.mesh = mesh;
    this.mesh.userData.carRef = this;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.parked = false;
    this.isPolice = false;
    this.dead = false;
    this.mesh.position.set(x, 0, z);
    this.mesh.rotation.y = heading;
  }
  forward() { return { x: Math.sin(this.heading), z: Math.cos(this.heading) }; }
  sync() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const wheels = this.mesh.userData.wheels || [];
    for (const w of wheels) {
      w.mesh.rotation.x += this.speed * 0.016 * 2.4;
      if (w.front) w.mesh.rotation.y = this.steer * 0.35;
    }
  }
}

// Player driving: arcade handling with drift, braking and building hits.
export function drivePlayerCar(car, input, dt, colliders, audio, effects, onCrash) {
  const ax = input.axis();
  const throttle = ax.z; // W forward, S reverse/brake
  const steering = ax.x;
  const handbrake = input.down('Space');
  const targetSteer = steering * (car.speed >= 0 ? 1 : -1);
  car.steer += (targetSteer - car.steer) * Math.min(1, dt * 8);
  if (throttle > 0) car.speed += CFG.carAccel * dt;
  else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= CFG.carBrake * dt;
    else car.speed -= CFG.carReverseAccel * dt;
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
  }
  if (handbrake) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
    if (Math.abs(car.speed) > 12 && Math.random() < 0.4) {
      effects.skidMark(car.x, car.z, car.heading);
      if (Math.random() < 0.2) audio.skid();
    }
  }
  car.speed = Math.max(-CFG.carMaxReverse, Math.min(CFG.carMaxSpeed, car.speed));
  const turnRate = CFG.carSteer * car.steer * Math.min(1, Math.abs(car.speed) / 10) * Math.sign(car.speed || 1);
  car.heading += turnRate * dt * (handbrake ? 1.5 : 1);
  const f = car.forward();
  const nx = car.x + f.x * car.speed * dt;
  const nz = car.z + f.z * car.speed * dt;
  const clamped = clampWorld(nx, nz);
  const hit = collideCircle(clamped.x, clamped.z, CFG.carRadius, colliders);
  if (Math.abs(hit.x - clamped.x) > 0.01 || Math.abs(hit.z - clamped.z) > 0.01) {
    if (Math.abs(car.speed) > 8) {
      onCrash(Math.abs(car.speed));
      effects.burst(new THREE.Vector3(nx, 1, nz), 0xffd23e, 10, 6, 0.5, 3);
      audio.crash();
    }
    car.speed *= -0.25;
  }
  car.x = hit.x; car.z = hit.z;
  car.sync();
  audio.setEngine(Math.abs(car.speed) / CFG.carMaxSpeed, true);
}

export function stopEngineSound(audio) { audio.setEngine(0, false); }

// ---- traffic: cars that cruise the grid and turn at intersections ----
export class TrafficCar extends Car {
  constructor(mesh, rng) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const line = rng.pick(CFG.roadLines);
    const lane = rng.chance(0.5) ? 3.4 : -3.4;
    const along = rng.range(-240, 240);
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? along : line + lane;
    const z = axis === 'x' ? line + lane : along;
    super(mesh, x, z, axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI));
    this.axis = axis;
    this.line = line;
    this.lane = lane;
    this.dir = dir;
    this.cruise = rng.range(9, 15);
    this.speed = this.cruise;
    this.parked = false;
  }
  update(dt, cars) {
    // slow down for the car ahead in the same lane
    let targetSpeed = this.cruise;
    for (const o of cars) {
      if (o === this || o.dead) continue;
      const dx = o.x - this.x, dz = o.z - this.z;
      const f = this.forward();
      const ahead = dx * f.x + dz * f.z;
      const side = Math.abs(dx * f.z - dz * f.x);
      if (ahead > 0 && ahead < 9 && side < 2.4) { targetSpeed = 0; break; }
    }
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 2.5);
    const f = this.forward();
    this.x += f.x * this.speed * dt;
    this.z += f.z * this.speed * dt;
    // at an intersection, maybe turn onto the crossing road
    const nearLine = CFG.roadLines.find((l) => Math.abs((this.axis === 'x' ? this.z - this.lane - l : this.x - this.lane - l)) < 1.2);
    const crossCoord = this.axis === 'x' ? this.x : this.z;
    const atIntersection = CFG.roadLines.some((l) => Math.abs(crossCoord - l) < 1.4);
    if (atIntersection && nearLine !== undefined && Math.random() < 0.5) {
      const turn = Math.random() < 0.5;
      if (turn) {
        const newAxis = this.axis === 'x' ? 'z' : 'x';
        const newLine = this.axis === 'x' ? Math.round(this.x / 74) * 74 : Math.round(this.z / 74) * 74;
        const newDir = Math.random() < 0.5 ? 1 : -1;
        const newLane = Math.random() < 0.5 ? 3.4 : -3.4;
        if (CFG.roadLines.includes(newLine)) {
          this.axis = newAxis;
          this.line = newLine;
          this.dir = newDir;
          this.lane = newLane;
          if (newAxis === 'x') { this.z = newLine + newLane; this.x = Math.round(this.x / 74) * 74; }
          else { this.x = newLine + newLane; this.z = Math.round(this.z / 74) * 74; }
          this.heading = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
        }
      }
    }
    // wrap around the city edge
    if (this.axis === 'x' && Math.abs(this.x) > 250) this.x = -Math.sign(this.x) * 250;
    if (this.axis === 'z' && Math.abs(this.z) > 250) this.z = -Math.sign(this.z) * 250;
    this.sync();
  }
}

export function spawnTraffic(scene, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const mesh = makeCarMesh(CAR_COLORS[i % CAR_COLORS.length]);
    scene.add(mesh);
    cars.push(new TrafficCar(mesh, rng));
  }
  return cars;
}

export function spawnParked(scene, rng, count) {
  const cars = [];
  const spots = [];
  for (const line of CFG.roadLines) {
    for (let d = -220; d <= 220; d += 37) {
      spots.push({ x: line + 5.6, z: d, heading: 0 });
      spots.push({ x: d, z: line + 5.6, heading: Math.PI / 2 });
    }
  }
  for (let i = 0; i < count; i++) {
    const s = spots[Math.floor(rng.next() * spots.length)];
    const mesh = makeCarMesh(rng.pick(CAR_COLORS));
    scene.add(mesh);
    const car = new Car(mesh, s.x, s.z, s.heading);
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export function makePoliceCar(scene, x, z, heading) {
  const mesh = makeCarMesh(0x111111, true);
  scene.add(mesh);
  const car = new Car(mesh, x, z, heading);
  car.isPolice = true;
  return car;
}
