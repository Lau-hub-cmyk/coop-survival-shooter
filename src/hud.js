import { PLAYER } from './config.js';

// DOM overlay: a per-player panel (health, stamina, ammo, status) plus a
// basic start screen. Kept as plain DOM so it never competes with the WebGL
// canvas for draw time.
export class HUD {
  constructor(container) {
    this.root = document.createElement('div');
    this.root.style.cssText = `
      position: fixed; inset: 0; pointer-events: none;
      font-family: system-ui, sans-serif; color: #fff; user-select: none;`;
    container.appendChild(this.root);

    this.p1 = this._makePanel('left', '#2e78ff', 'PLAYER 1');
    this.p2 = this._makePanel('right', '#ff5a3c', 'PLAYER 2');

    this.start = this._makeStartScreen();
  }

  _makePanel(side, color, title) {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; top: 16px; ${side}: 16px; width: 230px;
      background: rgba(10,16,32,0.55); border: 1px solid ${color};
      border-radius: 10px; padding: 10px 12px; backdrop-filter: blur(4px);`;
    el.innerHTML = `
      <div style="font-weight:700;font-size:13px;letter-spacing:1px;color:${color}">${title}</div>
      <div class="hp-wrap" style="margin-top:8px;height:14px;background:#2a3043;border-radius:7px;overflow:hidden">
        <div class="hp" style="height:100%;width:100%;background:#49d06b;transition:width .12s"></div>
      </div>
      <div class="st-wrap" style="margin-top:6px;height:7px;background:#2a3043;border-radius:4px;overflow:hidden">
        <div class="st" style="height:100%;width:100%;background:#ffd36b"></div>
      </div>
      <div class="info" style="margin-top:8px;font-size:13px;display:flex;justify-content:space-between">
        <span class="ammo">No weapon</span>
        <span class="status"></span>
      </div>`;
    this.root.appendChild(el);
    return {
      hp: el.querySelector('.hp'),
      st: el.querySelector('.st'),
      ammo: el.querySelector('.ammo'),
      status: el.querySelector('.status'),
    };
  }

  _makeStartScreen() {
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; text-align: center;
      background: radial-gradient(circle at 50% 40%, rgba(20,30,60,0.75), rgba(5,8,18,0.92));
      pointer-events: auto; gap: 18px; padding: 24px;`;
    el.innerHTML = `
      <h1 style="font-size:40px;margin:0;text-shadow:0 2px 12px #000">Co-op Survival Shooter</h1>
      <p style="max-width:620px;opacity:.85;line-height:1.5;margin:0">
        Two players, one keyboard. Explore the meadow, grab a pistol, and survive the wolves.
      </p>
      <div style="display:flex;gap:28px;flex-wrap:wrap;justify-content:center;font-size:14px;opacity:.9">
        <div style="text-align:left">
          <b style="color:#2e78ff">Player 1</b><br>
          Move: W A S D &nbsp;•&nbsp; Sprint: Left Shift<br>
          Aim: move direction &nbsp;•&nbsp; Shoot: Space<br>
          Pick up: walk over or press E
        </div>
        <div style="text-align:left">
          <b style="color:#ff5a3c">Player 2</b><br>
          Move: Arrow Keys &nbsp;•&nbsp; Sprint: Right Ctrl<br>
          Aim: move direction &nbsp;•&nbsp; Shoot: Right Shift / Numpad 0<br>
          Pick up: walk over or press /<br>
          <i style="opacity:.75">Gamepad: left stick move, right stick aim, RT shoot</i>
        </div>
      </div>
      <button id="startBtn" style="
        pointer-events:auto;margin-top:6px;padding:12px 30px;font-size:17px;font-weight:700;
        border:none;border-radius:10px;background:#49d06b;color:#05240f;cursor:pointer">
        Start</button>`;
    this.root.appendChild(el);
    this.startBtn = el.querySelector('#startBtn');
    return el;
  }

  onStart(cb) {
    const go = () => { this.hideStart(); cb(); };
    this.startBtn.addEventListener('click', go);
  }

  hideStart() { this.start.style.display = 'none'; }

  _updatePanel(panel, player) {
    const hpPct = (player.health / PLAYER.maxHealth) * 100;
    panel.hp.style.width = `${hpPct}%`;
    panel.hp.style.background = hpPct > 50 ? '#49d06b' : hpPct > 25 ? '#ffd36b' : '#ff5a3c';
    panel.st.style.width = `${(player.stamina / PLAYER.maxStamina) * 100}%`;

    if (player.downed) {
      panel.status.textContent = `DOWN ${Math.ceil(player.respawnTimer)}s`;
      panel.status.style.color = '#ff5a3c';
    } else {
      panel.status.textContent = '';
    }

    if (!player.hasGun) {
      panel.ammo.textContent = 'No weapon';
      panel.ammo.style.color = '#aab';
    } else {
      panel.ammo.textContent = `Ammo: ${player.ammo}`;
      panel.ammo.style.color = player.ammo > 0 ? '#fff' : '#ff5a3c';
    }
  }

  update(players) {
    this._updatePanel(this.p1, players[0]);
    this._updatePanel(this.p2, players[1]);
  }
}
