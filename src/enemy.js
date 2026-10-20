import * as THREE from 'three';
import { WOLF, COLORS, MAP_HALF } from './config.js';

const STATE = { IDLE: 'idle', ALERT: 'alert', ATTACK: 'attack', FLEE: 'flee', DEAD: 'dead' };

// A wolf built from primitives with a readable 4-legged silhouette.
// Simple finite state machine: IDLE wanders, ALERT turns to a spotted
// player, ATTACK chases and bites, FLEE runs off when badly hurt, DEAD
// plays a short topple-and-sink effect before removal.
export class Wolf {
  constructor(scene, spawn) {
    this.scene = scene;
    this.radius = WOLF.radius;
    this.pos = spawn.clone();
    this.heading = Math.random() * Math.PI * 2; // facing angle around Y
    this.health = WOLF.maxHealth;
    this.state = STATE.IDLE;

    this._wanderTarget = this._pickWanderTarget();
    this._wanderTimer = 2 + Math.random() * 2;
    this._attackCd = 0;
    this._alertTimer = 0;
    this._fleeTimer = 0;
    this._deathTimer = 0;
    this._legPhase = Math.random() * 10;

    this.mesh = this._buildMesh();
    this.scene.add(this.mesh);
    this._sync();
  }

  _buildMesh() {
    const group = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: COLORS.wolf, roughness: 1, flatShading: true });
    const belly = new THREE.MeshStandardMaterial({ color: COLORS.wolfBelly, roughness: 1 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 1.5), fur);
    body.position.y = 0.95;
    group.add(body);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.5), belly);
    chest.position.set(0, 0.85, 0.75);
    group.add(chest);

    // Head + snout at +z (forward).
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), fur);
    head.position.set(0, 1.15, 1.1);
    group.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.35), belly);
    snout.position.set(0, 1.05, 1.45);
    group.add(snout);

    // Pointy ears.
    const earGeo = new THREE.ConeGeometry(0.14, 0.32, 4);
    const earL = new THREE.Mesh(earGeo, fur); earL.position.set(-0.16, 1.5, 1.0);
    const earR = new THREE.Mesh(earGeo, fur); earR.position.set(0.16, 1.5, 1.0);
    group.add(earL, earR);

    // Legs (kept as references so they can swing while moving).
    this.legs = [];
    const legGeo = new THREE.BoxGeometry(0.18, 0.75, 0.18);
    const legPositions = [[-0.22, 0.6], [0.22, 0.6], [-0.22, -0.55], [0.22, -0.55]];
    for (const [lx, lz] of legPositions) {
      const leg = new THREE.Mesh(legGeo, fur);
      leg.position.set(lx, 0.38, lz);
      group.add(leg);
      this.legs.push({ mesh: leg, baseZ: lz });
    }

    // Tail.
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.6), fur);
    tail.position.set(0, 1.1, -0.9);
    tail.rotation.x = -0.5;
    group.add(tail);

    return group;
  }

  _sync() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    if (this.state !== STATE.DEAD) this.mesh.rotation.y = this.heading;
  }

  isAlive() { return this.state !== STATE.DEAD; }
  center() { return new THREE.Vector3(this.pos.x, 0.95, this.pos.z); }

  takeDamage(amount) {
    if (this.state === STATE.DEAD) return;
    this.health -= amount;
    if (this.health <= 0) {
      this._die();
    } else if (this.health < WOLF.fleeHealth) {
      this.state = STATE.FLEE;
      this._fleeTimer = WOLF.fleeDuration;
    } else if (this.state === STATE.IDLE) {
      // A hit from afar still wakes it up.
      this.state = STATE.ALERT;
      this._alertTimer = 0.3;
    }
  }

  _die() {
    this.state = STATE.DEAD;
    this._deathTimer = WOLF.deathDuration;
  }

  _pickWanderTarget() {
    const a = Math.random() * Math.PI * 2;
    const r = 4 + Math.random() * 10;
    return new THREE.Vector3(
      Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, this.pos.x + Math.cos(a) * r)),
      0,
      Math.max(-MAP_HALF + 2, Math.min(MAP_HALF - 2, this.pos.z + Math.sin(a) * r)),
    );
  }

  _nearestPlayer(players) {
    let best = null, bestD = Infinity;
    for (const p of players) {
      if (p.downed) continue;
      const d = Math.hypot(p.pos.x - this.pos.x, p.pos.z - this.pos.z);
      if (d < bestD) { bestD = d; best = p; }
    }
    return { player: best, dist: bestD };
  }

  update(dt, players, world) {
    if (this.state === STATE.DEAD) {
      this._updateDeath(dt);
      return this.readyToRemove;
    }

    this._attackCd = Math.max(0, this._attackCd - dt);
    const { player, dist } = this._nearestPlayer(players);

    let speed = 0;
    let moveDir = null;

    switch (this.state) {
      case STATE.IDLE: {
        this._wanderTimer -= dt;
        if (player && dist < WOLF.detectRadius) {
          this.state = STATE.ALERT;
          this._alertTimer = 0.4;
          break;
        }
        const toTarget = this._wanderTarget.clone().sub(new THREE.Vector3(this.pos.x, 0, this.pos.z));
        if (toTarget.length() < 1 || this._wanderTimer <= 0) {
          this._wanderTarget = this._pickWanderTarget();
          this._wanderTimer = 2 + Math.random() * 3;
        } else {
          moveDir = toTarget.normalize();
          speed = WOLF.wanderSpeed;
        }
        break;
      }
      case STATE.ALERT: {
        this._alertTimer -= dt;
        if (!player || dist > WOLF.loseRadius) { this.state = STATE.IDLE; break; }
        // Turn to face the player, then lunge into the chase.
        moveDir = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z).normalize();
        if (this._alertTimer <= 0) this.state = STATE.ATTACK;
        break;
      }
      case STATE.ATTACK: {
        if (!player || dist > WOLF.loseRadius) { this.state = STATE.IDLE; break; }
        moveDir = new THREE.Vector3(player.pos.x - this.pos.x, 0, player.pos.z - this.pos.z).normalize();
        speed = WOLF.chaseSpeed;
        if (dist < WOLF.attackRange && this._attackCd <= 0) {
          player.takeDamage(WOLF.attackDamage);
          this._attackCd = WOLF.attackCooldown;
        }
        break;
      }
      case STATE.FLEE: {
        this._fleeTimer -= dt;
        if (this._fleeTimer <= 0) { this.state = STATE.IDLE; break; }
        if (player) {
          moveDir = new THREE.Vector3(this.pos.x - player.pos.x, 0, this.pos.z - player.pos.z).normalize();
        }
        speed = WOLF.fleeSpeed;
        break;
      }
    }

    // Apply movement + collision.
    if (moveDir && moveDir.lengthSq() > 1e-4) {
      // Smoothly rotate toward the heading.
      const target = Math.atan2(moveDir.x, moveDir.z);
      this.heading = rotateToward(this.heading, target, WOLF.turnSpeed * dt);
      if (speed > 0) {
        this.pos.x += moveDir.x * speed * dt;
        this.pos.z += moveDir.z * speed * dt;
        world.clampCircle(this.pos, this.radius);
      }
    }

    // Leg swing while moving.
    if (speed > 0) {
      this._legPhase += dt * speed * 1.6;
      const swing = Math.sin(this._legPhase) * 0.3;
      this.legs[0].mesh.rotation.x = swing;
      this.legs[3].mesh.rotation.x = swing;
      this.legs[1].mesh.rotation.x = -swing;
      this.legs[2].mesh.rotation.x = -swing;
    }

    this._sync();
    return false; // not ready to remove
  }

  _updateDeath(dt) {
    this._deathTimer -= dt;
    const t = 1 - Math.max(0, this._deathTimer / WOLF.deathDuration);
    // Topple sideways and sink into the ground, then flag for removal.
    this.mesh.rotation.z = (Math.PI / 2) * Math.min(1, t * 2);
    this.mesh.position.y = -t * 1.2;
    if (this._deathTimer <= 0) {
      this.scene.remove(this.mesh);
      this.readyToRemove = true;
    }
  }
}

// Rotate `current` toward `target` by at most `maxStep`, taking the short
// way around the circle.
function rotateToward(current, target, maxStep) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) <= maxStep) return target;
  return current + Math.sign(diff) * maxStep;
}
