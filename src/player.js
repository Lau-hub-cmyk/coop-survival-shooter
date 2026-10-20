import * as THREE from 'three';
import { PLAYER, COLORS } from './config.js';

// A local player character. Movement, facing/aim, sprint+stamina, health,
// ammo and down/respawn all live here. Input is fed in each frame as a
// normalized command object so this class stays input-source agnostic.
export class Player {
  constructor(scene, color, spawn, label) {
    this.scene = scene;
    this.color = color;
    this.label = label;
    this.spawn = spawn.clone();

    this.pos = spawn.clone();          // on the ground plane (y used only for mesh)
    this.dir = new THREE.Vector3(0, 0, 1); // facing / aim direction (unit, XZ)
    this.health = PLAYER.maxHealth;
    this.stamina = PLAYER.maxStamina;
    this.hasGun = false;
    this.ammo = 0;
    this.downed = false;
    this.respawnTimer = 0;
    this._fireTimer = 0;

    this.mesh = this._buildMesh(color);
    this.scene.add(this.mesh);
    this._syncMesh();
  }

  _buildMesh(color) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.8 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x222634, roughness: 0.9 });

    // Torso (capsule-ish box).
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.5), bodyMat);
    body.position.y = 1.0;
    group.add(body);

    // Head.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10),
      new THREE.MeshStandardMaterial({ color: 0xf1c6a0, roughness: 0.9 }));
    head.position.y = 1.75;
    group.add(head);

    // A short "arm + barrel" sticking forward (+z) to show aim direction.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.7), darkMat);
    arm.position.set(0.28, 1.1, 0.45);
    group.add(arm);
    this.barrel = arm;

    // Feet.
    const footGeo = new THREE.BoxGeometry(0.24, 0.3, 0.3);
    const lf = new THREE.Mesh(footGeo, darkMat); lf.position.set(-0.18, 0.15, 0);
    const rf = new THREE.Mesh(footGeo, darkMat); rf.position.set(0.18, 0.15, 0);
    group.add(lf, rf);

    return group;
  }

  _syncMesh() {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = Math.atan2(this.dir.x, this.dir.z);
  }

  takeDamage(amount) {
    if (this.downed) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this._goDown();
  }

  _goDown() {
    this.downed = true;
    this.respawnTimer = PLAYER.respawnDelay;
    this.mesh.rotation.z = Math.PI / 2; // topple over
    this.mesh.position.y = 0;
  }

  _respawn() {
    this.downed = false;
    this.health = PLAYER.maxHealth;
    this.stamina = PLAYER.maxStamina;
    this.pos.copy(this.spawn);
    this.mesh.rotation.z = 0;
    this._syncMesh();
  }

  // cmd: { x, z, sprint, aimDir?:Vector3 }  (x,z are a desired move vector)
  update(dt, cmd, world) {
    this._fireTimer = Math.max(0, this._fireTimer - dt);

    if (this.downed) {
      this.respawnTimer -= dt;
      if (this.respawnTimer <= 0) this._respawn();
      return;
    }

    // --- Movement + sprint/stamina ----------------------------------
    let mx = cmd.x, mz = cmd.z;
    const len = Math.hypot(mx, mz);
    const moving = len > 0.01;
    if (moving) { mx /= len; mz /= len; }

    let speed = PLAYER.speed;
    const wantsSprint = cmd.sprint && moving && this.stamina > PLAYER.sprintMinStamina;
    if (wantsSprint) {
      speed = PLAYER.sprintSpeed;
      this.stamina = Math.max(0, this.stamina - PLAYER.staminaDrain * dt);
    } else {
      this.stamina = Math.min(PLAYER.maxStamina, this.stamina + PLAYER.staminaRegen * dt);
    }

    if (moving) {
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      world.clampCircle(this.pos, PLAYER.radius);
    }

    // --- Facing / aim -----------------------------------------------
    if (cmd.aimDir && cmd.aimDir.lengthSq() > 1e-4) {
      this.dir.set(cmd.aimDir.x, 0, cmd.aimDir.z).normalize();
    } else if (moving) {
      this.dir.set(mx, 0, mz);
    }

    this._syncMesh();
  }

  // Returns a bullet {origin, dir} if a shot fired this frame, else null.
  tryShoot() {
    if (this.downed || !this.hasGun || this.ammo <= 0 || this._fireTimer > 0) return null;
    this.ammo -= 1;
    this._fireTimer = PLAYER.fireCooldown;
    const origin = new THREE.Vector3(
      this.pos.x + this.dir.x * (PLAYER.radius + 0.3),
      1.1,
      this.pos.z + this.dir.z * (PLAYER.radius + 0.3),
    );
    return { origin, dir: this.dir.clone() };
  }

  giveGun() { this.hasGun = true; this.ammo = Math.max(this.ammo, PLAYER.startAmmo); }
  giveAmmo(amount) { this.ammo += amount; }
}
