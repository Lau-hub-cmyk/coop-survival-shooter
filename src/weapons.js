import * as THREE from 'three';
import { BULLET, COLORS, PLAYER } from './config.js';

// Fast projectile bullets. Each step the bullet is advanced and tested
// against wolves (sphere overlap), props and the map. Collision is done on
// the travelled segment so fast bullets don't tunnel through wolves.
export class ProjectileSystem {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.bullets = [];
    this.geo = new THREE.SphereGeometry(BULLET.radius, 8, 6);
    this.mat = new THREE.MeshStandardMaterial({
      color: COLORS.bullet, emissive: COLORS.bullet, emissiveIntensity: 0.8, roughness: 0.4,
    });
    this.effects = []; // transient hit sparks
  }

  spawn(origin, dir) {
    const mesh = new THREE.Mesh(this.geo, this.mat);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.bullets.push({
      mesh,
      pos: origin.clone(),
      vel: dir.clone().normalize().multiplyScalar(BULLET.speed),
      life: BULLET.lifetime,
    });
  }

  update(dt, wolves) {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.life -= dt;
      const step = b.vel.clone().multiplyScalar(dt);
      const next = b.pos.clone().add(step);

      let dead = b.life <= 0;

      // Segment vs wolves.
      if (!dead) {
        for (const w of wolves) {
          if (!w.isAlive()) continue;
          if (segmentHitsSphere(b.pos, next, w.center(), w.radius + BULLET.radius)) {
            w.takeDamage(BULLET.damage);
            this._spark(next);
            dead = true;
            break;
          }
        }
      }

      // Props / map bounds.
      if (!dead && (this.world.hitsObstacle(next.x, next.z) ||
          Math.abs(next.x) > 30 || Math.abs(next.z) > 30)) {
        this._spark(next);
        dead = true;
      }

      if (dead) {
        this.scene.remove(b.mesh);
        this.bullets.splice(i, 1);
      } else {
        b.pos.copy(next);
        b.mesh.position.copy(next);
      }
    }

    // Fade hit sparks.
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const t = Math.max(0, e.life / e.max);
      e.mesh.scale.setScalar(0.2 + (1 - t) * 0.9);
      e.mesh.material.opacity = t;
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }

  _spark(pos) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xffd36b, transparent: true, opacity: 1 }),
    );
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.18, max: 0.18 });
  }
}

// Pistol and ammo pickups scattered in the world. Pickups bob and spin so
// they are easy to spot. Players collect them by walking close or pressing
// their pickup key.
export class PickupManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.pistols = [];
    this.ammo = [];
    this._ammoRespawn = 0;
    this._t = 0;
  }

  addPistol(x, z) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.22, 0.22),
      new THREE.MeshStandardMaterial({ color: COLORS.pistol, roughness: 0.6, metalness: 0.4 }),
    );
    const grip = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.35, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 }),
    );
    grip.position.set(-0.18, -0.22, 0);
    group.add(body, grip);
    group.position.set(x, 0.8, z);
    this.scene.add(group);
    this.pistols.push({ mesh: group, x, z });
  }

  addAmmo(x, z) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.4, 0.4),
      new THREE.MeshStandardMaterial({ color: COLORS.ammo, emissive: 0x6b4e10, roughness: 0.5 }),
    );
    mesh.position.set(x, 0.6, z);
    this.scene.add(mesh);
    this.ammo.push({ mesh, x, z });
  }

  // Scatter a few ammo boxes at valid (non-water, non-prop) spots.
  scatterAmmo(count) {
    let placed = 0, guard = 0;
    while (placed < count && guard++ < count * 30) {
      const x = (Math.random() * 2 - 1) * 26;
      const z = (Math.random() * 2 - 1) * 26;
      if (this.world.isInWater(x, z, 1.5) || this.world.hitsObstacle(x, z)) continue;
      this.addAmmo(x, z);
      placed++;
    }
  }

  update(dt, players) {
    this._t += dt;
    const bob = Math.sin(this._t * 3) * 0.12;

    for (const p of this.pistols) {
      p.mesh.rotation.y += dt * 1.5;
      p.mesh.position.y = 0.8 + bob;
    }
    for (const a of this.ammo) {
      a.mesh.rotation.y += dt * 2;
      a.mesh.position.y = 0.6 + bob;
    }

    for (const p of players) {
      if (p.downed) continue;
      // Pistols.
      for (let i = this.pistols.length - 1; i >= 0; i--) {
        const g = this.pistols[i];
        const near = Math.hypot(g.x - p.pos.x, g.z - p.pos.z) < 1.4;
        if (near && (!p.hasGun || p.wantsPickup)) {
          p.giveGun();
          this.scene.remove(g.mesh);
          this.pistols.splice(i, 1);
        }
      }
      // Ammo (always auto-collected on contact if the player has a gun).
      for (let i = this.ammo.length - 1; i >= 0; i--) {
        const a = this.ammo[i];
        if (Math.hypot(a.x - p.pos.x, a.z - p.pos.z) < 1.3) {
          p.giveAmmo(PLAYER.clipSize);
          if (!p.hasGun) p.giveGun();
          this.scene.remove(a.mesh);
          this.ammo.splice(i, 1);
        }
      }
    }

    // Keep the world stocked: respawn an ammo box every few seconds until
    // a small cap, so players never get permanently stranded without ammo.
    this._ammoRespawn -= dt;
    if (this._ammoRespawn <= 0 && this.ammo.length < 5) {
      this._ammoRespawn = 6;
      this.scatterAmmo(1);
    }
  }
}

// Closest approach of segment [a,b] to point c; true if within radius r.
function segmentHitsSphere(a, b, c, r) {
  const ab = b.clone().sub(a);
  const lenSq = ab.lengthSq();
  let t = lenSq > 1e-8 ? c.clone().sub(a).dot(ab) / lenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const closest = a.clone().add(ab.multiplyScalar(t));
  return closest.distanceToSquared(c) <= r * r;
}
