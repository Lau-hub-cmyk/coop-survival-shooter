// Centralised input. Tracks keyboard, mouse (for player 1 aim/shoot) and a
// gamepad (optional, for player 2). Produces per-player command objects the
// rest of the game consumes; it does not know about game logic.
export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.mouse = { ndcX: 0, ndcY: 0, left: false };

    window.addEventListener('keydown', (e) => {
      // Stop arrow keys / space from scrolling the page.
      if (HANDLED_KEYS.has(e.code)) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouse.left = false; });

    domElement.addEventListener('mousemove', (e) => {
      const r = domElement.getBoundingClientRect();
      this.mouse.ndcX = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.ndcY = -((e.clientY - r.top) / r.height) * 2 + 1;
    });
    domElement.addEventListener('mousedown', (e) => { if (e.button === 0) this.mouse.left = true; });
    window.addEventListener('mouseup', (e) => { if (e.button === 0) this.mouse.left = false; });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  has(code) { return this.keys.has(code); }

  gamepad() {
    if (!navigator.getGamepads) return null;
    for (const p of navigator.getGamepads()) {
      if (p && p.connected) return p;
    }
    return null;
  }

  // Player 1: WASD move, Shift sprint, E pickup. Aim/shoot come from the
  // mouse and are resolved in main.js (needs the camera for the ground ray).
  player1() {
    let x = 0, z = 0;
    if (this.has('KeyW')) z -= 1;
    if (this.has('KeyS')) z += 1;
    if (this.has('KeyA')) x -= 1;
    if (this.has('KeyD')) x += 1;
    return {
      x, z,
      sprint: this.has('ShiftLeft'),
      pickup: this.has('KeyE'),
      shoot: this.mouse.left,
    };
  }

  // Player 2: arrow keys (aim = move direction), RightShift / Numpad0 shoot,
  // RightCtrl sprint, Slash pickup. A connected gamepad overrides the keys:
  // left stick move, right stick aim, right trigger shoot, A sprint.
  player2() {
    const pad = this.gamepad();
    if (pad) {
      const lx = dz(pad.axes[0]);
      const lz = dz(pad.axes[1]);
      const rx = dz(pad.axes[2] ?? 0);
      const rz = dz(pad.axes[3] ?? 0);
      const rt = pad.buttons[7] ? (pad.buttons[7].pressed || pad.buttons[7].value > 0.4) : false;
      return {
        x: lx, z: lz,
        aimX: rx, aimZ: rz,
        hasAim: Math.hypot(rx, rz) > 0.25,
        sprint: pad.buttons[0] ? pad.buttons[0].pressed : false,
        shoot: rt,
        pickup: pad.buttons[2] ? pad.buttons[2].pressed : false,
      };
    }
    let x = 0, z = 0;
    if (this.has('ArrowUp')) z -= 1;
    if (this.has('ArrowDown')) z += 1;
    if (this.has('ArrowLeft')) x -= 1;
    if (this.has('ArrowRight')) x += 1;
    return {
      x, z,
      hasAim: false,
      sprint: this.has('ControlRight'),
      shoot: this.has('ShiftRight') || this.has('Numpad0'),
      pickup: this.has('Slash'),
    };
  }
}

// Analog stick deadzone.
function dz(v, threshold = 0.18) { return Math.abs(v) < threshold ? 0 : v; }

const HANDLED_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
  'ShiftRight', 'ControlRight', 'Numpad0', 'Slash',
]);
