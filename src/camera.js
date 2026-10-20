import * as THREE from 'three';
import { CAMERA } from './config.js';

// A single shared top-down-ish camera. It frames the midpoint of both
// players and pulls back as they spread apart, staying within sensible
// zoom bounds. Fixed ~50 degree downward tilt (not a behind-the-player
// view).
export class CoopCamera {
  constructor(aspect) {
    this.cam = new THREE.PerspectiveCamera(CAMERA.fov, aspect, 0.1, 500);
    this._pitch = THREE.MathUtils.degToRad(CAMERA.pitchDeg);
    this._mid = new THREE.Vector3(0, 0, 0);
    this._radius = CAMERA.radiusBase;
    // Snap to a sensible starting pose.
    this._place(this._mid, this._radius);
  }

  get camera() { return this.cam; }

  setAspect(aspect) {
    this.cam.aspect = aspect;
    this.cam.updateProjectionMatrix();
  }

  _place(mid, radius) {
    // Camera sits on the +Z side, lifted so the look direction is `pitch`
    // degrees below the horizon. back = radius*cos(pitch), up = radius*sin.
    const back = radius * Math.cos(this._pitch);
    const up = radius * Math.sin(this._pitch);
    this.cam.position.set(mid.x, up, mid.z + back);
    this.cam.lookAt(mid.x, 0, mid.z);
  }

  update(dt, players) {
    // Midpoint of living players (fall back to all if everyone is down).
    const live = players.filter((p) => !p.downed);
    const group = live.length ? live : players;
    let cx = 0, cz = 0;
    for (const p of group) { cx += p.pos.x; cz += p.pos.z; }
    cx /= group.length; cz /= group.length;

    // Separation drives zoom.
    let sep = 0;
    if (players.length >= 2) {
      sep = Math.hypot(players[0].pos.x - players[1].pos.x, players[0].pos.z - players[1].pos.z);
    }
    const targetRadius = THREE.MathUtils.clamp(
      CAMERA.radiusBase + sep * CAMERA.separationFactor,
      CAMERA.minRadius, CAMERA.maxRadius,
    );

    // Smooth follow.
    const k = 1 - Math.exp(-CAMERA.lerp * dt);
    this._mid.x += (cx - this._mid.x) * k;
    this._mid.z += (cz - this._mid.z) * k;
    this._radius += (targetRadius - this._radius) * k;

    this._place(this._mid, this._radius);
  }
}
