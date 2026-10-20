import * as THREE from 'three';
import { COLORS, MAP_HALF } from './config.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Wolf } from './enemy.js';
import { ProjectileSystem, PickupManager } from './weapons.js';
import { CoopCamera } from './camera.js';
import { Input } from './input.js';
import { HUD } from './hud.js';

const container = document.getElementById('app');

// --- Renderer -----------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

// --- Scene + lighting ---------------------------------------------------
const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.FogExp2(COLORS.sky, 0.012);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x3a5a2a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.25);
sun.position.set(20, 40, 15);
scene.add(sun);

// --- Camera -------------------------------------------------------------
const coopCam = new CoopCamera(window.innerWidth / window.innerHeight);

// --- World + entities ---------------------------------------------------
const world = new World(scene);

const players = [
  new Player(scene, COLORS.player1, new THREE.Vector3(-3, 0, -2), 'P1'),
  new Player(scene, COLORS.player2, new THREE.Vector3(3, 0, -2), 'P2'),
];

const projectiles = new ProjectileSystem(scene, world);

const pickups = new PickupManager(scene, world);
// Two pistols so both players can arm themselves, plus scattered ammo.
pickups.addPistol(-5, 4);
pickups.addPistol(6, -6);
pickups.scatterAmmo(4);

const wolves = [];
spawnWolves(3);

function spawnWolves(n) {
  let placed = 0, guard = 0;
  while (placed < n && guard++ < n * 40) {
    const x = (Math.random() * 2 - 1) * (MAP_HALF - 4);
    const z = (Math.random() * 2 - 1) * (MAP_HALF - 4);
    // Keep wolves away from the player spawn and out of the pond/props.
    if (Math.hypot(x, z) < 12) continue;
    if (world.isInWater(x, z, 1.5) || world.hitsObstacle(x, z)) continue;
    wolves.push(new Wolf(scene, new THREE.Vector3(x, 0, z)));
    placed++;
  }
}

// --- Input + HUD --------------------------------------------------------
const input = new Input(renderer.domElement);
const hud = new HUD(container);

// Scratch vector for player 2's gamepad aim.
const _p2Aim = new THREE.Vector3();

let running = false;
hud.onStart(() => { running = true; });

// Dev-only inspection hook (stripped from production builds).
if (import.meta.env.DEV) {
  window.__game = { players, wolves, pickups, world, projectiles };
}

// --- Resize -------------------------------------------------------------
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  coopCam.setAspect(window.innerWidth / window.innerHeight);
});

// --- Loop ---------------------------------------------------------------
const clock = new THREE.Clock();

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05); // clamp to avoid big jumps

  if (running) step(dt);

  renderer.render(scene, coopCam.camera);
}

function step(dt) {
  const cmd1 = input.player1();
  const cmd2 = input.player2();

  // Both players aim in their movement direction (handled in Player.update).
  // Player 2 additionally aims with the gamepad right stick when present.
  if (cmd2.hasAim) {
    _p2Aim.set(cmd2.aimX, 0, cmd2.aimZ);
    cmd2.aimDir = _p2Aim;
  }

  players[0].update(dt, cmd1, world);
  players[1].update(dt, cmd2, world);

  // Shooting (fire rate is gated inside the player).
  if (cmd1.shoot) fire(players[0]);
  if (cmd2.shoot) fire(players[1]);

  // Wolves.
  for (let i = wolves.length - 1; i >= 0; i--) {
    const remove = wolves[i].update(dt, players, world);
    if (remove) wolves.splice(i, 1);
  }

  projectiles.update(dt, wolves);

  // Pickups (flag manual pickup intent for the "press key" path).
  players[0].wantsPickup = cmd1.pickup;
  players[1].wantsPickup = cmd2.pickup;
  pickups.update(dt, players);

  coopCam.update(dt, players);
  hud.update(players);
}

function fire(player) {
  const shot = player.tryShoot();
  if (shot) projectiles.spawn(shot.origin, shot.dir);
}

frame();
