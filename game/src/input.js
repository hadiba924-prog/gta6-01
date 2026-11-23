// Keyboard + mouse input, with pointer lock for the third-person camera.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this._pressed = new Set(); // keydowns since last frame — survives quick taps
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (e.code === 'Space') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    };
    this._onMouseDown = (e) => { if (e.button === 0) this.mouseDown = true; };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onLockChange = () => { this.locked = document.pointerLockElement === canvas; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
    document.addEventListener('pointerlockchange', this._onLockChange);
  }
  lock() {
    if (!this.locked) this.canvas.requestPointerLock?.();
  }
  unlock() {
    if (this.locked) document.exitPointerLock?.();
  }
  down(code) { return this.keys.has(code); }
  // edge-triggered: true once per physical press, even a quick tap
  pressed(code) { return this._pressed.has(code); }
  endFrame() {
    this.mouseDX = 0;
    this.mouseDY = 0;
    this._pressed.clear();
  }
  axis() {
    let x = 0, z = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) z += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) z -= 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    return { x, z };
  }
}
