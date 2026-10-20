# Co-op Survival Shooter (MVP)

A browser-based 3D **local co-op** survival shooter built with
[Three.js](https://threejs.org/) and [Vite](https://vitejs.dev/). Two
players share one screen and **one keyboard** — no mouse needed (player 2
can optionally use a gamepad). Walk around a small grass-and-water
overworld, pick up a pistol, and fight wolves. The vibe: the calm overworld
of an old Pokémon game — but with guns and dangerous animals.

Everything is built from Three.js primitives (boxes, cones, cylinders,
spheres). **No downloaded 3D assets** — the game runs fully offline once
dependencies are installed.

## Run it

```bash
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173) and click
**Start**.

Production build:

```bash
npm run build
npm run preview
```

## Controls

| Action        | Player 1              | Player 2                                   |
| ------------- | --------------------- | ------------------------------------------ |
| Move          | `W` `A` `S` `D`       | Arrow keys                                 |
| Sprint        | `Left Shift`          | `Right Ctrl`                               |
| Aim           | Movement direction    | Movement direction                         |
| Shoot         | `Space`               | `Right Shift` or `Numpad 0`                |
| Pick up       | walk over / `E`       | walk over / `/`                            |

Both players aim in the direction they are walking, and keep facing that
way when they stop — so you can stand still and shoot the last direction
you moved. No mouse is used.

**Gamepad (player 2, optional):** left stick to move, right stick to aim,
right trigger to shoot, `A` to sprint. Plug it in and it takes over
automatically for player 2.

Both players have a stamina-limited sprint (the thin yellow bar under each
health bar).

## How to play

- Grab one of the two pistols lying in the meadow by walking over it (or
  pressing your pick-up key next to it).
- Ammo is limited and shown in your HUD. When it hits `0` you can't shoot —
  grab a glowing yellow ammo box to refill. Ammo boxes respawn over time.
- Wolves wander until you get close. Then they turn, charge, and bite.
  Shoot them to kill them; badly hurt wolves flee for a moment.
- A wolf bite drains your health. At `0` health you go **down** and respawn
  at your start point after a few seconds.
- You can't walk into the pond or off the edge of the map, and trees and
  rocks are solid.

## Project structure

```
src/
  main.js      entry point + game loop, wires everything together
  config.js    shared tunables (map, player, wolf, camera, bullet)
  world.js     ground, water, trees, rocks, edge walls + collision
  player.js    player entity: movement, sprint, aim, shooting, health
  enemy.js     wolf entity + idle/alert/attack/flee/dead state machine
  weapons.js   bullets (fast projectiles) + pistol/ammo pickups
  camera.js    shared co-op camera that frames both players
  input.js     keyboard, mouse and gamepad handling
  hud.js       per-player health/stamina/ammo overlay + start screen
```

## Scope

This is an MVP. In scope: the small grass/water world, two local players, a
shared co-op camera, a pickup-able pistol with limited/refillable ammo,
wolves with a simple AI state machine, and health with down/respawn.

Out of scope (not built): networking/online play, extra biomes, bears or
coordinated wolf packs, crafting/taming/fishing, day-night cycle, co-op
revive, and menus beyond the basic start screen.
