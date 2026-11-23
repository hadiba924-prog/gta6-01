// Particles, skid marks, floating labels and camera shake.
// One pooled system so the frame never allocates mid-play.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.pool = [];
    this.skids = [];
    this.labels = [];
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.mesh = new THREE.InstancedMesh(geo, mat, 600);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.shake = 0;
  }
  burst(pos, color, count = 18, speed = 9, life = 0.8, up = 4) {
    for (let i = 0; i < count; i++) {
      if (this.pool.length >= 600) return;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.pool.push({
        x: pos.x, y: pos.y, z: pos.z,
        vx: Math.cos(a) * s, vy: up * Math.random() + 1, vz: Math.sin(a) * s,
        life, maxLife: life, color, size: 0.6 + Math.random() * 1.2,
      });
    }
  }
  explosion(pos) {
    this.burst(pos, 0xff7a1a, 42, 14, 1.0, 7);
    this.burst(pos, 0xffd23e, 26, 10, 0.8, 6);
    this.burst(pos, 0x555555, 20, 5, 1.6, 5);
    this.shake = Math.max(this.shake, 0.7);
  }
  muzzle(pos, dir) {
    this.burst(pos, 0xffe9a3, 6, 4, 0.12, 0.5);
    this.burst(new THREE.Vector3(pos.x + dir.x, pos.y + dir.y, pos.z + dir.z), 0xffc23e, 3, 3, 0.1, 0.3);
  }
  skidMark(x, z, angle) {
    const geo = new THREE.PlaneGeometry(0.35, 1.1);
    const mat = new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = angle;
    m.position.set(x, 0.06, z);
    this.scene.add(m);
    this.skids.push({ mesh: m, life: 9 });
    if (this.skids.length > 90) {
      const old = this.skids.shift();
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose(); old.mesh.material.dispose();
    }
  }
  floatText(text, pos, color = '#ffd23e') {
    this.labels.push({ text, pos: pos.clone(), life: 1.6, color });
  }
  addShake(amount) { this.shake = Math.max(this.shake, amount); }
  update(dt, camera) {
    // particles
    let n = 0;
    for (let i = this.pool.length - 1; i >= 0; i--) {
      const p = this.pool[i];
      p.life -= dt;
      if (p.life <= 0) { this.pool.splice(i, 1); continue; }
      p.vy -= 12 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < 0.05) { p.y = 0.05; p.vy *= -0.3; p.vx *= 0.7; p.vz *= 0.7; }
      const k = p.life / p.maxLife;
      this._m.compose(
        new THREE.Vector3(p.x, p.y, p.z),
        this._q.identity(),
        this._s.setScalar(p.size * (0.5 + k * 0.5)),
      );
      this.mesh.setMatrixAt(n, this._m);
      this.mesh.setColorAt(n, this._c.setHex(p.color).multiplyScalar(0.4 + k * 0.6));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    // skid fade
    for (let i = this.skids.length - 1; i >= 0; i--) {
      const s = this.skids[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose(); s.mesh.material.dispose();
        this.skids.splice(i, 1);
      } else if (s.life < 3) {
        s.mesh.material.opacity = 0.55 * (s.life / 3);
      }
    }
    // floating labels
    for (let i = this.labels.length - 1; i >= 0; i--) {
      const l = this.labels[i];
      l.life -= dt;
      l.pos.y += dt * 1.2;
      if (l.life <= 0) this.labels.splice(i, 1);
    }
    // camera shake decay
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 1.6);
      if (camera) {
        camera.position.x += (Math.random() - 0.5) * this.shake * 0.35;
        camera.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      }
    }
  }
  // Project floating labels to screen space for the HUD layer.
  drawLabels(ctx, camera, width, height) {
    const v = new THREE.Vector3();
    ctx.font = 'bold 15px Arial';
    ctx.textAlign = 'center';
    for (const l of this.labels) {
      v.copy(l.pos).project(camera);
      if (v.z > 1) continue;
      const x = (v.x * 0.5 + 0.5) * width;
      const y = (-v.y * 0.5 + 0.5) * height;
      ctx.globalAlpha = Math.min(1, l.life);
      ctx.fillStyle = l.color;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.lineWidth = 3;
      ctx.strokeText(l.text, x, y);
      ctx.fillText(l.text, x, y);
    }
    ctx.globalAlpha = 1;
  }
}
