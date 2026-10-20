import * as THREE from 'three';
import { MAP_HALF, WATER, COLORS, GROUND_Y } from './config.js';

// The World owns the static scenery (ground, water, trees, rocks) and the
// collision data. Entities ask the world to keep them out of obstacles,
// the pond and off the map edge via `clampCircle`.
export class World {
  constructor(scene) {
    this.scene = scene;
    // Each obstacle is a solid cylinder footprint: { x, z, radius }.
    this.obstacles = [];
    this._build();
  }

  _build() {
    // --- Ground -------------------------------------------------------
    const groundGeo = new THREE.PlaneGeometry(MAP_HALF * 2, MAP_HALF * 2);
    const groundMat = new THREE.MeshStandardMaterial({ color: COLORS.grass, roughness: 1 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = GROUND_Y;
    this.scene.add(ground);

    // --- Water (a flat pond, sitting just above the grass) ------------
    const w = WATER;
    const waterGeo = new THREE.PlaneGeometry(w.maxX - w.minX, w.maxZ - w.minZ);
    const waterMat = new THREE.MeshStandardMaterial({
      color: COLORS.water,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set((w.minX + w.maxX) / 2, 0.03, (w.minZ + w.maxZ) / 2);
    this.scene.add(water);

    // --- Edge fence posts (purely visual; real walls are invisible) ---
    this._buildFence();

    // --- Scatter trees and rocks -------------------------------------
    this._scatterProps();
  }

  _buildFence() {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 });
    const postGeo = new THREE.BoxGeometry(0.4, 1.6, 0.4);
    const step = 6;
    for (let i = -MAP_HALF; i <= MAP_HALF; i += step) {
      for (const [x, z] of [[i, -MAP_HALF], [i, MAP_HALF], [-MAP_HALF, i], [MAP_HALF, i]]) {
        const post = new THREE.Mesh(postGeo, postMat);
        post.position.set(x, 0.8, z);
        this.scene.add(post);
      }
    }
  }

  _scatterProps() {
    const rng = mulberry32(1337); // deterministic layout
    const tryPlace = (minR, checkRadius) => {
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = (rng() * 2 - 1) * (MAP_HALF - 2);
        const z = (rng() * 2 - 1) * (MAP_HALF - 2);
        // Keep the central spawn area clear.
        if (Math.hypot(x, z) < 7) continue;
        if (this._inWater(x, z, checkRadius + 1)) continue;
        let ok = true;
        for (const o of this.obstacles) {
          if (Math.hypot(o.x - x, o.z - z) < o.radius + checkRadius + 1.2) { ok = false; break; }
        }
        if (ok) return { x, z };
      }
      return null;
    };

    for (let i = 0; i < 20; i++) {
      const spot = tryPlace(0, 0.8);
      if (!spot) continue;
      const scale = 0.8 + rng() * 0.8;
      this._addTree(spot.x, spot.z, scale, rng);
      this.obstacles.push({ x: spot.x, z: spot.z, radius: 0.7 * scale });
    }
    for (let i = 0; i < 12; i++) {
      const spot = tryPlace(0, 0.9);
      if (!spot) continue;
      const scale = 0.7 + rng() * 1.1;
      this._addRock(spot.x, spot.z, scale, rng);
      this.obstacles.push({ x: spot.x, z: spot.z, radius: 0.9 * scale });
    }
  }

  _addTree(x, z, scale, rng) {
    const group = new THREE.Group();
    const trunkH = 1.8 * scale;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.2 * scale, 0.28 * scale, trunkH, 6),
      new THREE.MeshStandardMaterial({ color: COLORS.trunk, roughness: 1 }),
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);

    const foliageMat = new THREE.MeshStandardMaterial({ color: COLORS.foliage, roughness: 1 });
    // Two stacked cones make a simple low-poly pine.
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.4 * scale, 2.2 * scale, 7), foliageMat);
    c1.position.y = trunkH + 0.6 * scale;
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.0 * scale, 1.8 * scale, 7), foliageMat);
    c2.position.y = trunkH + 1.7 * scale;
    group.add(c1, c2);

    group.position.set(x, 0, z);
    group.rotation.y = rng() * Math.PI * 2;
    this.scene.add(group);
  }

  _addRock(x, z, scale, rng) {
    const rock = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.9 * scale, 0),
      new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 1, flatShading: true }),
    );
    rock.position.set(x, 0.5 * scale, z);
    rock.rotation.set(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI);
    rock.scale.y = 0.8;
    this.scene.add(rock);
  }

  _inWater(x, z, pad = 0) {
    return x > WATER.minX - pad && x < WATER.maxX + pad &&
           z > WATER.minZ - pad && z < WATER.maxZ + pad;
  }

  // Push a circle of the given radius out of all solids and keep it on the
  // map. `out` is a {x, z} that is mutated in place and returned.
  clampCircle(out, radius) {
    // Map edges (invisible walls).
    const lim = MAP_HALF - radius;
    out.x = Math.max(-lim, Math.min(lim, out.x));
    out.z = Math.max(-lim, Math.min(lim, out.z));

    // Water: treat as a rectangle the circle must stay out of. Resolve by
    // pushing along the axis of least penetration.
    if (this._inWater(out.x, out.z, radius)) {
      const left = out.x - (WATER.minX - radius);
      const right = (WATER.maxX + radius) - out.x;
      const top = out.z - (WATER.minZ - radius);
      const bottom = (WATER.maxZ + radius) - out.z;
      const min = Math.min(left, right, top, bottom);
      if (min === left) out.x = WATER.minX - radius;
      else if (min === right) out.x = WATER.maxX + radius;
      else if (min === top) out.z = WATER.minZ - radius;
      else out.z = WATER.maxZ + radius;
    }

    // Obstacles: circle-circle push-out. A couple of passes settles
    // corners where two obstacles are close together.
    for (let pass = 0; pass < 2; pass++) {
      for (const o of this.obstacles) {
        const dx = out.x - o.x;
        const dz = out.z - o.z;
        const minDist = o.radius + radius;
        const d = Math.hypot(dx, dz);
        if (d < minDist && d > 1e-4) {
          const push = (minDist - d);
          out.x += (dx / d) * push;
          out.z += (dz / d) * push;
        } else if (d <= 1e-4) {
          out.x += minDist; // degenerate: shove along +x
        }
      }
    }
    return out;
  }

  // True if a point (e.g. a bullet) is blocking against a solid prop.
  hitsObstacle(x, z) {
    for (const o of this.obstacles) {
      if (Math.hypot(o.x - x, o.z - z) < o.radius) return true;
    }
    return false;
  }

  isInWater(x, z, pad = 0) { return this._inWater(x, z, pad); }
}

// Small deterministic PRNG so the map looks the same every run.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
