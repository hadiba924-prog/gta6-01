// Solmar Bay — Sunset Streets. Bootstrap, game loop and wiring:
// city, player, cars, cops, missions, combat, HUD, audio and saves.
import * as THREE from 'three';
import { CFG } from './config.js';
import { makeRng } from './rng.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { buildCity } from './city.js';
import { spawnTraffic, spawnParked, drivePlayerCar, stopEngineSound } from './vehicles.js';
import { spawnPedestrians } from './pedestrians.js';
import { WantedSystem } from './police.js';
import { Combat } from './combat.js';
import { MissionManager, MISSION_DEFS } from './missions.js';
import { HUD } from './hud.js';
import { Effects } from './effects.js';
import { Player } from './player.js';
import { loadSave, writeSave, clearSave } from './save.js';
import { parseShotParams, stageShot, autoDriveInput } from './shots.js';

const $ = (id) => document.getElementById(id);

const params = parseShotParams();
const rng = makeRng(params.seed || ((Math.random() * 1e9) | 0));

// ---------- renderer / scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.className = 'game';
$('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1500);
camera.position.set(0, 60, 190);

const G = {
  scene, camera, renderer, rng,
  state: 'menu',
  money: 0, respect: 0, missionIndex: 0,
  coinsTaken: new Set(), completedMissions: new Set(),
  autoDrive: false,
  nearestCar: null,
  pendingMission: null,
  saveTimer: 0,
};

G.city = buildCity(scene, rng);
G.input = new Input(renderer.domElement);
G.audio = new AudioEngine();
G.effects = new Effects(scene);
G.player = new Player(scene);
G.player.spawn(G.city.places.start.x, G.city.places.start.z);
G.traffic = spawnTraffic(scene, rng, CFG.trafficCars);
G.parkedCars = spawnParked(scene, rng, 9);
G.allCars = [...G.traffic, ...G.parkedCars];
G.peds = spawnPedestrians(scene, rng, CFG.pedestrians);
G.wanted = new WantedSystem(scene, G.audio);
G.combat = new Combat(scene, camera, G.audio, G.effects);
G.hud = new HUD();
G.missions = new MissionManager({
  scene, rng, places: G.city.places,
  player: G.player, wanted: G.wanted, audio: G.audio, effects: G.effects,
  addDrivableCar: (car) => { G.allCars.push(car); },
  toast: (t, ms) => G.hud.toast(t, ms),
  onComplete: (def) => missionComplete(def),
  onFail: (def, reason) => missionFailed(def, reason),
});
G.playerPos = { x: G.player.x, y: 0, z: G.player.z };

function missionComplete(def) {
  G.money += def.reward;
  G.respect += def.respect;
  G.completedMissions.add(def.id);
  G.missionIndex = Math.min(MISSION_DEFS.length - 1, def.id);
  G.audio.missionDone();
  writeSave(G);
  if (def.id === MISSION_DEFS.length) {
    G.hud.banner('STORY COMPLETE', `You did it, Danny — ${def.reward.toLocaleString('en-US')} richer and a Bay Legend. Free roam!`, 6000);
    G.hud.toast('All 7 missions done. The Bay is yours.', 6000);
    G.pendingMission = null;
  } else {
    G.hud.banner('MISSION COMPLETE', `+$${def.reward.toLocaleString('en-US')}  ·  +${def.respect} respect`, 3600);
    G.pendingMission = { index: def.id, at: performance.now() + 3600 };
  }
}

function missionFailed(def, reason) {
  G.audio.missionFail();
  G.hud.banner('MISSION FAILED', reason, 3600);
  G.pendingMission = { index: def.id - 1, at: performance.now() + 3600 };
}

function startPlaying() {
  G.state = 'playing';
  $('menu').classList.add('hidden');
  $('pause').classList.add('hidden');
  $('dead').classList.add('hidden');
  $('loading').classList.add('hidden');
  G.hud.show();
  G.audio.ensure();
  G.audio.startMusic();
  G.input.lock();
}

function toMenu() {
  G.state = 'menu';
  writeSave(G);
  G.wanted.clear();
  G.missions.cleanup();
  stopEngineSound(G.audio);
  G.audio.setSiren(false);
  G.hud.hide();
  $('pause').classList.add('hidden');
  $('dead').classList.add('hidden');
  $('menu').classList.remove('hidden');
  G.input.unlock();
  refreshMenuButtons();
}

function die(kind) {
  if (G.state !== 'playing') return;
  G.state = 'dead';
  G.player.dead = true;
  stopEngineSound(G.audio);
  G.audio.setSiren(false);
  G.audio.missionFail();
  G.input.unlock();
  $('deadTitle').textContent = kind;
  $('deadText').textContent = kind === 'BUSTED'
    ? 'The Bay PD finally put the cuffs on you, Danny.'
    : 'The Bay PD scraped you off the asphalt.';
  $('dead').classList.remove('hidden');
}

function respawn() {
  G.player.spawn(G.city.places.start.x, G.city.places.start.z);
  G.wanted.clear();
  G.missions.start(G.missionIndex);
  $('dead').classList.add('hidden');
  startPlaying();
}

function refreshMenuButtons() {
  const save = loadSave();
  const btn = $('btnContinue');
  if (save) {
    btn.classList.remove('hidden');
    $('continueNum').textContent = String(Math.min(MISSION_DEFS.length, (save.missionIndex ?? 0) + 1));
  } else {
    btn.classList.add('hidden');
  }
}

$('btnStart').addEventListener('click', () => {
  clearSave();
  G.money = 0; G.respect = 0; G.missionIndex = 0;
  G.coinsTaken = new Set(); G.completedMissions = new Set();
  for (const c of G.city.coins) { c.taken = false; c.mesh.visible = true; }
  G.player.spawn(G.city.places.start.x, G.city.places.start.z);
  G.wanted.clear();
  G.missions.start(0);
  startPlaying();
});
$('btnContinue').addEventListener('click', () => {
  const save = loadSave();
  if (!save) return;
  G.money = save.money ?? 0;
  G.respect = save.respect ?? 0;
  G.missionIndex = save.missionIndex ?? 0;
  G.coinsTaken = new Set(save.coinsTaken ?? []);
  G.completedMissions = new Set(save.completed ?? []);
  for (let i = 0; i < G.city.coins.length; i++) {
    const taken = G.coinsTaken.has(i);
    G.city.coins[i].taken = taken;
    G.city.coins[i].mesh.visible = !taken;
  }
  const [sx, , sz] = save.pos ?? [G.city.places.start.x, 0, G.city.places.start.z];
  G.player.spawn(sx, sz);
  G.wanted.clear();
  G.missions.start(G.missionIndex);
  startPlaying();
});
$('btnResume').addEventListener('click', () => {
  $('pause').classList.add('hidden');
  G.state = 'playing';
  G.input.lock();
});
$('btnQuit').addEventListener('click', toMenu);
$('btnRetry').addEventListener('click', respawn);
$('btnDeadMenu').addEventListener('click', toMenu);
renderer.domElement.addEventListener('click', () => {
  if (G.state === 'playing') G.input.lock();
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- helpers ----------
function nearestDrivableCar(maxDist) {
  let best = null, bd = maxDist;
  for (const c of G.allCars) {
    if (c.dead) continue;
    const d = Math.hypot(c.x - G.player.x, c.z - G.player.z);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function stealCar(car) {
  const wasTraffic = G.traffic.includes(car);
  if (wasTraffic) G.traffic.splice(G.traffic.indexOf(car), 1);
  if (!car.stolen) {
    car.stolen = true;
    G.wanted.addStars(car.isPolice ? 2 : 1);
    G.hud.toast(car.isPolice ? 'You stole a cop car! The whole Bay PD is coming.' : 'Car stolen — the owner called it in. +1★', 2600);
  }
  G.player.enterCar(car);
  G.audio.carDoor();
}

function handleShootResult(r) {
  if (!r) return;
  if (r.empty) { G.hud.toast('Out of ammo — press R to reload', 1600); return; }
  if (!r.hit) return;
  if (r.kind === 'enemy' && r.killed) {
    G.missions.registerKill();
    G.money += 50; G.respect += 10;
    G.effects.floatText('+$50', new THREE.Vector3(r.point.x, r.point.y + 1, r.point.z));
    G.audio.pickup();
  }
  if (r.kind === 'cop' && r.killed) {
    G.wanted.addStars(2);
    const i = G.wanted.copPeds.indexOf(r.cop);
    if (i >= 0) G.wanted.copPeds.splice(i, 1);
    G.scene.remove(r.cop.mesh);
    G.effects.floatText('COP DOWN  +2★', new THREE.Vector3(r.point.x, r.point.y + 1, r.point.z), '#ff6b6b');
  }
  if (r.kind === 'ped' && r.killed) {
    G.wanted.addStars(1);
    const i = G.peds.indexOf(r.ped);
    if (i >= 0) G.peds.splice(i, 1);
  }
  if (r.kind === 'car' && r.killed) {
    G.wanted.addStars(1);
    for (const list of [G.allCars, G.traffic, G.parkedCars]) {
      const i = list.indexOf(r.car);
      if (i >= 0) list.splice(i, 1);
    }
    if (G.player.car === r.car) { G.player.exitCar(); G.player.damage(25); }
  }
}

// ---------- screenshot staging ----------
if (params.shot) {
  stageShot(G, params.shot);
  $('loading').classList.add('hidden');
} else {
  refreshMenuButtons();
  $('loading').classList.add('hidden');
}
window.__solmar = G;

// ---------- main loop ----------
const clock = new THREE.Clock();
let menuT = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  if (G.state === 'menu') {
    menuT += dt;
    G.city.update(dt, t);
    G.effects.update(dt, camera);
    G.player.updateCamera(camera, dt, menuT);
    renderer.render(scene, camera);
    G.input.endFrame();
    return;
  }
  if (G.state !== 'playing') {
    renderer.render(scene, camera);
    G.input.endFrame();
    return;
  }

  const input = G.autoDrive ? autoDriveInput : G.input;
  const p = G.player;

  // --- pending mission start ---
  if (G.pendingMission && performance.now() >= G.pendingMission.at) {
    const idx = G.pendingMission.index;
    G.pendingMission = null;
    G.missions.start(idx);
  }

  // --- enter / exit car ---
  G.nearestCar = p.inCar ? null : nearestDrivableCar(5.5);
  if (G.input.pressed('KeyE')) {
    if (p.inCar) {
      p.exitCar();
      stopEngineSound(G.audio);
      G.audio.carDoor();
    } else if (G.nearestCar) {
      stealCar(G.nearestCar);
    }
  }

  // --- movement ---
  if (p.inCar && p.car) {
    drivePlayerCar(p.car, input, dt, G.city.colliders, G.audio, G.effects, (speed) => {
      p.damage(Math.max(2, speed * 0.25));
      G.effects.addShake(0.35);
      G.hud.damageFlash(0.5);
    });
    // car-to-car bumps
    for (const o of G.allCars) {
      if (o === p.car || o.dead) continue;
      const d = Math.hypot(o.x - p.car.x, o.z - p.car.z);
      if (d < 3.4 && d > 0.01) {
        const push = (3.4 - d) / 2;
        const nx = (p.car.x - o.x) / d, nz = (p.car.z - o.z) / d;
        p.car.x += nx * push; p.car.z += nz * push;
        if (!o.parked && o.speed !== undefined) { o.x -= nx * push; o.z -= nz * push; }
      }
    }
  } else {
    p.updateOnFoot(dt, G.input, G.city.colliders, G.audio);
    stopEngineSound(G.audio);
  }

  // --- shooting ---
  if (!p.inCar && G.input.mouseDown && G.input.locked) {
    const r = G.combat.shoot(p, G.missions.enemies, G.wanted.copPeds,
      [...G.allCars, ...G.wanted.copCars], G.peds, G.city.buildingMeshes);
    handleShootResult(r);
    if (r?.hit) G.wanted.decayTimer = 0;
  }
  if (G.input.pressed('KeyR')) G.combat.startReload();
  if (G.input.pressed('KeyM')) {
    const on = G.audio.toggleMusic();
    G.hud.toast(on ? 'Music on' : 'Music off', 1200);
  }
  if (G.input.pressed('Escape') || G.input.pressed('KeyP')) {
    G.state = 'paused';
    $('pause').classList.remove('hidden');
    G.input.unlock();
  }

  // --- world life ---
  for (const c of G.traffic) c.update(dt, G.allCars);
  const threats = [];
  if (p.inCar && p.car && Math.abs(p.car.speed) > 15) threats.push({ x: p.x, z: p.z });
  for (const ped of G.peds) ped.update(dt, rng, G.city.colliders, threats);
  G.wanted.update(dt, p, rng, G.city.colliders,
    (reason) => {
      if (reason === 'busted') die('BUSTED');
      else { G.effects.addShake(0.4); G.audio.crash(); p.damage(3); }
    },
    (dmg) => { p.damage(dmg); G.hud.damageFlash(0.65); },
  );
  G.missions.update(dt, t);
  G.combat.update(dt);
  G.city.update(dt, t);
  G.effects.update(dt, camera);

  // --- coins ---
  for (let i = 0; i < G.city.coins.length; i++) {
    const c = G.city.coins[i];
    if (c.taken) continue;
    if (Math.hypot(p.x - c.x, p.z - c.z) < 2.4) {
      c.taken = true;
      c.mesh.visible = false;
      G.coinsTaken.add(i);
      G.money += 100; G.respect += 5;
      G.audio.coin();
      G.effects.floatText('+$100', new THREE.Vector3(c.x, 2.5, c.z));
    }
  }

  // --- camera, health, HUD ---
  p.updateCamera(camera, dt);
  p.regen(dt);
  G.hud.damageFlash(p.health < 30 ? 0.35 : 0);
  G.hud.update(G, dt);
  G.playerPos = { x: p.x, y: p.y, z: p.z };

  // --- autosave ---
  G.saveTimer += dt;
  if (G.saveTimer > 30) { G.saveTimer = 0; writeSave(G); }

  if (p.dead) die('WASTED');

  renderer.render(scene, camera);
  G.input.endFrame();
}
frame();
