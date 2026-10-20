// Shared tunables and world constants.
// One place to tweak the feel of the whole game.

// --- Map ---------------------------------------------------------------
export const MAP_HALF = 30;           // map spans [-30, 30] on X and Z (~60x60)
export const GROUND_Y = 0;

// A single rectangular pond. Players and wolves cannot walk into it.
export const WATER = { minX: 5, maxX: 25, minZ: 4, maxZ: 22 };

// --- Colors ------------------------------------------------------------
export const COLORS = {
  sky: 0x8fc6ff,
  grass: 0x5a9e4a,
  water: 0x2f7fd6,
  trunk: 0x6b4a2b,
  foliage: 0x2f7d3a,
  rock: 0x8a8f99,
  player1: 0x2e78ff,
  player2: 0xff5a3c,
  wolf: 0x5b616e,
  wolfBelly: 0x8a909c,
  pistol: 0x2b2f38,
  ammo: 0xf2c14e,
  bullet: 0xfff1a8,
};

// --- Player ------------------------------------------------------------
export const PLAYER = {
  radius: 0.6,
  speed: 7.5,
  sprintSpeed: 12.5,
  maxHealth: 100,
  maxStamina: 100,
  staminaDrain: 32,     // per second while sprinting
  staminaRegen: 22,     // per second while not sprinting
  sprintMinStamina: 5,  // need at least this much to start sprinting
  respawnDelay: 3,      // seconds downed before respawn
  startAmmo: 12,
  fireCooldown: 0.22,   // seconds between shots (semi-auto feel while held)
  clipSize: 12,         // ammo granted per ammo pickup
};

// --- Weapon / bullets --------------------------------------------------
export const BULLET = {
  radius: 0.14,
  speed: 48,
  lifetime: 1.2,        // seconds
  damage: 34,
};

// --- Wolf --------------------------------------------------------------
export const WOLF = {
  radius: 0.75,
  maxHealth: 100,
  wanderSpeed: 2.2,
  chaseSpeed: 8.2,
  fleeSpeed: 9.5,
  detectRadius: 14,     // enters ALERT within this range
  loseRadius: 22,       // gives up chase beyond this
  attackRange: 1.6,     // deals damage when this close
  attackDamage: 14,
  attackCooldown: 0.9,  // seconds between bites
  fleeHealth: 30,       // flees when health drops below this
  fleeDuration: 2.5,    // seconds of fleeing
  deathDuration: 1.1,   // seconds for the death animation before removal
  turnSpeed: 6,         // how fast it rotates to face its heading
};

// --- Camera ------------------------------------------------------------
export const CAMERA = {
  pitchDeg: 50,         // angle below the horizon
  minRadius: 20,        // closest the camera gets
  maxRadius: 44,        // furthest the camera pulls back
  radiusBase: 20,
  separationFactor: 0.95, // extra radius per unit of player separation
  lerp: 4,              // follow smoothing (higher = snappier)
  fov: 55,
};
