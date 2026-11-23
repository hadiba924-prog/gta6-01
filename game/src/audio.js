// All sound is synthesized with WebAudio — no audio files, no network.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicOn = true;
    this.musicTimer = null;
    this.sirenNodes = null;
    this.engineNodes = null;
    this._musicStep = 0;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
  }
  _noiseBuffer(seconds = 1) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  _tone(freq, dur, type = 'sine', vol = 0.2, slideTo = 0, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  _noise(dur, vol, filterFreq, when = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + when;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer(dur + 0.1);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }
  shoot() { this._noise(0.14, 0.5, 2600); this._tone(160, 0.1, 'square', 0.18, 60); }
  enemyShoot() { this._noise(0.12, 0.25, 1800); }
  explosion() {
    this._noise(0.9, 0.8, 500);
    this._tone(90, 0.7, 'sine', 0.5, 30);
  }
  pickup() { this._tone(660, 0.09, 'sine', 0.22); this._tone(990, 0.14, 'sine', 0.22, 0, 0.08); }
  coin() { this._tone(880, 0.08, 'triangle', 0.2); this._tone(1320, 0.16, 'triangle', 0.2, 0, 0.07); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.25, 0, i * 0.11));
  }
  missionFail() { [392, 330, 262].forEach((f, i) => this._tone(f, 0.3, 'sawtooth', 0.14, 0, i * 0.16)); }
  carDoor() { this._noise(0.08, 0.3, 900); }
  crash() { this._noise(0.3, 0.5, 700); this._tone(70, 0.25, 'sine', 0.4, 40); }
  skid() { this._noise(0.18, 0.12, 3200); }
  click() { this._tone(1200, 0.05, 'square', 0.12); }
  // Continuous police siren while wanted (two-tone loop).
  setSiren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenNodes) {
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      const g = this.ctx.createGain(); g.gain.value = 0.045;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.9;
      const lg = this.ctx.createGain(); lg.gain.value = 260;
      o.frequency.value = 760; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.sirenNodes = { o, lfo, g };
    } else if (!on && this.sirenNodes) {
      const { o, lfo, g } = this.sirenNodes;
      g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      setTimeout(() => { try { o.stop(); lfo.stop(); } catch (_) {} }, 400);
      this.sirenNodes = null;
    }
  }
  // Engine hum whose pitch follows speed; call every frame while driving.
  setEngine(speedNorm, active) {
    if (!this.ctx) return;
    if (active && !this.engineNodes) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
      const g = this.ctx.createGain(); g.gain.value = 0.05;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engineNodes = { o, g };
    }
    if (this.engineNodes) {
      const o = this.engineNodes.o;
      o.frequency.setTargetAtTime(55 + speedNorm * 160, this.ctx.currentTime, 0.08);
      this.engineNodes.g.gain.setTargetAtTime(active ? 0.05 : 0, this.ctx.currentTime, 0.1);
      if (!active) { const n = this.engineNodes; this.engineNodes = null; setTimeout(() => { try { n.o.stop(); } catch (_) {} }, 300); }
    }
  }
  // Lazy sunset groove: a quiet bass + pluck loop, pure synth.
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const bass = [55, 55, 65.4, 49, 55, 55, 73.4, 82.4];
    const pluck = [220, 277, 330, 277, 220, 330, 392, 330];
    this.musicTimer = setInterval(() => {
      if (!this.musicOn || !this.ctx) return;
      const i = this._musicStep++ % 8;
      this._tone(bass[i], 0.5, 'sine', 0.16);
      if (i % 2 === 0) this._tone(pluck[i], 0.24, 'triangle', 0.07);
      if (i === 4) this._noise(0.05, 0.05, 6000);
    }, 320);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
  toggleMusic() { this.musicOn = !this.musicOn; return this.musicOn; }
}
