// The HUD: health bar, cash, rank, wanted stars, objective, speedometer,
// hints, banners, and the round 2D minimap drawn on a canvas.
import { CFG } from './config.js';
import { rankFor } from './missions.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.healthFill = $('healthFill');
    this.cash = $('cash');
    this.rank = $('rank');
    this.stars = $('stars');
    this.objTitle = $('objTitle');
    this.objText = $('objText');
    this.objDist = $('objDist');
    this.speedNum = $('speedNum');
    this.gearLabel = $('gearLabel');
    this.hint = $('hint');
    this.crosshair = $('crosshair');
    this.bannerEl = $('banner');
    this.bannerBig = $('bannerBig');
    this.bannerSub = $('bannerSub');
    this.toastEl = $('toast');
    this.damageEl = $('damage');
    this.minimap = $('minimap');
    this.mm = this.minimap.getContext('2d');
    this._bannerTimer = 0;
    this._toastTimer = 0;
    this._starSpans = [];
    for (let i = 0; i < CFG.maxWanted; i++) {
      const s = document.createElement('span');
      s.textContent = '★';
      this.stars.appendChild(s);
      this._starSpans.push(s);
    }
  }
  show() { $('hud').classList.remove('hidden'); }
  hide() { $('hud').classList.add('hidden'); }
  banner(big, sub = '', ms = 3200) {
    this.bannerBig.textContent = big;
    this.bannerSub.textContent = sub;
    this.bannerEl.classList.remove('hidden');
    this._bannerTimer = ms / 1000;
  }
  toast(text, ms = 2800) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    this._toastTimer = ms / 1000;
  }
  damageFlash(v) { this.damageEl.style.opacity = String(Math.max(0, Math.min(1, v))); }
  update(G, dt) {
    if (this._bannerTimer > 0) {
      this._bannerTimer -= dt;
      if (this._bannerTimer <= 0) this.bannerEl.classList.add('hidden');
    }
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) this.toastEl.classList.add('hidden');
    }
    const p = G.player;
    this.healthFill.style.width = `${Math.max(0, p.health)}%`;
    this.healthFill.style.background = p.health > 50
      ? 'linear-gradient(90deg,#37e08b,#1db954)'
      : p.health > 25 ? 'linear-gradient(90deg,#ffb52e,#ff7a1a)' : 'linear-gradient(90deg,#ff5a5a,#c81e1e)';
    this.cash.textContent = `$${G.money.toLocaleString('en-US')}`;
    this.rank.textContent = rankFor(G.respect);
    for (let i = 0; i < this._starSpans.length; i++) {
      this._starSpans[i].classList.toggle('lit', i < G.wanted.stars);
    }
    const obj = G.missions.objectiveText();
    this.objTitle.textContent = obj.title;
    this.objText.textContent = obj.text;
    this.objDist.textContent = obj.dist ? `◈ ${obj.dist}` : '';
    const speed = p.inCar && p.car ? Math.abs(p.car.speed) * 2.2 : 0;
    this.speedNum.textContent = String(Math.round(speed));
    if (p.inCar) this.gearLabel.textContent = 'DRIVING';
    else if (G.combat.reloading > 0) this.gearLabel.textContent = 'RELOADING…';
    else this.gearLabel.textContent = `PISTOL ${G.combat.ammo}/${CFG.pistolMag}`;
    this.crosshair.classList.toggle('hidden', p.inCar);
    // contextual hint
    let hint = '';
    if (!p.inCar) {
      const near = G.nearestCar;
      if (near) hint = 'Press E to steal the car';
      else if (G.missions.active) hint = 'WASD move · Shift sprint · Click shoot · E enter car';
      else hint = 'WASD move · E enter car · M music';
    } else {
      hint = 'WASD drive · Space handbrake · E exit car';
    }
    this.hint.textContent = hint;
    this.drawMinimap(G);
  }
  drawMinimap(G) {
    const ctx = this.mm;
    const S = 190;
    const mx = (x) => ((x + 360) / 740) * S;
    const mz = (z) => ((z + 280) / 560) * S;
    ctx.clearRect(0, 0, S, S);
    // ocean + sand
    ctx.fillStyle = '#0e3a4d';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#1e7fa8';
    ctx.fillRect(mx(330), 0, S - mx(330), S);
    ctx.fillStyle = '#eed9a4';
    ctx.fillRect(mx(266), 0, mx(330) - mx(266), S);
    // city ground
    ctx.fillStyle = '#274b2e';
    ctx.fillRect(0, 0, mx(266), S);
    // roads
    ctx.strokeStyle = '#4a4f55';
    ctx.lineWidth = 4;
    for (const line of CFG.roadLines) {
      ctx.beginPath(); ctx.moveTo(mx(-260), mz(line)); ctx.lineTo(mx(260), mz(line)); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(mx(line), mz(-260)); ctx.lineTo(mx(line), mz(260)); ctx.stroke();
    }
    const dot = (x, z, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx(x), mz(z), r, 0, Math.PI * 2); ctx.fill();
    };
    // coins
    for (const c of G.city.coins) if (!c.taken) dot(c.x, c.z, '#ffd23e', 2);
    // mission target (pulsing)
    const tgt = G.missions.target;
    if (tgt && G.missions.active) {
      const pulse = 4 + Math.sin(performance.now() / 180) * 1.5;
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath(); ctx.arc(mx(tgt.x), mz(tgt.z), pulse, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(mx(tgt.x), mz(tgt.z), pulse + 2.5, 0, Math.PI * 2); ctx.stroke();
    }
    // traffic + parked cars
    for (const c of G.allCars) if (!c.dead) dot(c.x, c.z, '#ffffff', 2);
    // peds
    for (const p of G.peds) if (!p.dead) dot(p.x, p.z, '#9aa0a3', 1.6);
    // enemies
    for (const e of G.missions.enemies) if (!e.dead) dot(e.x, e.z, '#ff4444', 3);
    // cops (flashing)
    const copColor = Math.floor(performance.now() / 300) % 2 === 0 ? '#2244ff' : '#ff2222';
    for (const c of G.wanted.copCars) dot(c.x, c.z, copColor, 3.5);
    for (const p of G.wanted.copPeds) dot(p.x, p.z, copColor, 2.5);
    // player arrow
    const p = G.player;
    const px = mx(p.x), pz = mz(p.z);
    const a = p.inCar && p.car ? p.car.heading : p.yaw;
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-a + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 5); ctx.lineTo(0, 2.5); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
}
