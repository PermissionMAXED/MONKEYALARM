# MONKEYALARM!

A first-person multiplayer hide-and-seek game built with three.js: a **police** officer hunts escaped **monkeys** across four elaborate themed maps, with several game modes, a main menu, a lobby, and a hiding→seeking→round-end round system.

## Architecture (where things live)

- `client/core/` — engine glue. `Game.js` is the state machine + render loop; `constants.js` is the single source of truth for modes/maps/roles/phases/tuning (imported by the **server** too); `EventBus.js` (`bus`) is the only channel between UI and engine (`ui:*` events up, `game:*` events down); `collision.js` is AABB collide-and-slide.
- `client/player/` — first-person `PlayerController` (PointerLockControls) + keyboard `Input`.
- `client/entities/` — `PoliceAvatar`/`MonkeyAvatar` (procedural primitives), `RemotePlayer` (interpolated avatar + nameplate + seeker beacon), `MonkeyAI` (headless AI brain for solo modes).
- `client/maps/` — `MapBase.js` (the contract every map extends) + one file per themed map. Maps default-export a class; expose `group`, `colliders` (`THREE.Box3[]`), `policeSpawns`/`monkeySpawns`, `bounds`, `killY`, `environment`, and `build()`/`update()`/`dispose()`.
- `client/net/` — `LocalSession.js` (offline authority + AI monkeys, **no server**) and `Network.js` (socket.io client). Both implement the identical session interface/event stream, so `Game.js` has one code path.
- `client/ui/` — `UIManager` + screens (MainMenu, LobbyScreen, HUD, RoundEndScreen), plain DOM, styled in `client/style.css`.
- `server/` — `index.js` (socket.io server) + `Room.js` (authoritative rooms/roles/round timers). Pure Node; never imports `three`.

## Running it (standard commands live in `package.json`)

- `npm run dev` — Vite client dev server on **http://localhost:5173** (hot-reload).
- `npm run server` — multiplayer socket.io server on **port 3010**.
- `npm run lint` / `npm run build`.

## Cursor Cloud specific instructions

- **Solo modes run with NO server.** Time Attack, Free Roam, and solo Classic are driven entirely by `LocalSession` in the browser (AI monkeys). You only need `npm run dev`. Start `npm run server` **only** to test multiplayer (Host/Join). The Vite config proxies `/socket.io` → `http://localhost:3010`, so the browser connects same-origin; if multiplayer can't connect, the server simply isn't running.
- **Both servers are long-running** — start them in the background (e.g. tmux) and leave them up; don't run them as one-shot foreground commands.
- **Controls:** click the canvas to lock the pointer (required — movement/catch only work while pointer-locked); WASD move, Shift sprint, Space jump, mouse look, **left-click to catch** a monkey. Esc releases the pointer and shows the pause overlay.
- **Catch balance invariant:** in `client/core/constants.js`, `PLAYER.MONKEY_SPRINT_SPEED` **must stay below** `PLAYER.SPRINT_SPEED`, otherwise a fleeing monkey is uncatchable in the open. Police get a through-wall "alarm beacon" over each un-caught monkey to aid finding them.
- **Testing the catch with an automated/computer-use harness is hard**: monkeys are small and flee, and the maps are large (~120²). A human catches them easily by cornering; an automated tester struggles to sustain the chase. For a reliable automated catch demo you can *temporarily* lower `MONKEY_WALK_SPEED`/`MONKEY_SPRINT_SPEED` and/or raise `CATCH_RANGE` in `constants.js`, then revert before committing. Do not ship those test values.
- **Maps are heavy, self-contained procedural files.** They only depend on `MapBase`. Editing/adding a map should not touch other files. Keep repeated props as `InstancedMesh`/merged geometry (draw-call budget ~250).
- `dist/` and `node_modules/` are gitignored; don't commit them.
