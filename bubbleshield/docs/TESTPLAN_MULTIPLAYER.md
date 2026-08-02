# Multiplayer test plan (two real clients)

Closes the remaining P1 verification gap from the parity evaluation
(`UserFeedback.md` → "Eval Sol", rank 3): the full C2S/S2C path has been
exercised end-to-end by the W10 GameTest suite with **mock** `ServerPlayer`s
(real `Connection` objects put through `NetworkRegistry.configureMockConnection`,
S2C payloads captured off the embedded channel), but no **real** NeoForge
client handshake, codec round trip over a socket, or client-side render/HUD
reaction has been observed. This plan is the manual procedure for that last
step. It requires two interactive game clients and therefore cannot run on a
headless CI VM.

## What is already covered automatically (do not re-test by hand)

`./gradlew runGameTestServer` (194 tests, W10) already proves server-side:

- all five C2S handlers incl. owner/distance(≤ 8 blocks)/loaded-chunk
  validation and the 20 packets/s token bucket (`ServerNet.tryConsumeToken`),
- S2C sync/remove broadcast gating (diff gate, impacts bypass), impact-batch
  coalescing (cap 8, break kept), receiver filter radius + 32,
  passage in/out flips, contact rate limit (10 ticks),
- join-resync payload emission, boss-bar lifecycle, `/bubbleshield`
  command output, loot injection, advancements, NBT persistence.

What GameTests **cannot** show: real handshake/protocol negotiation, client
deserialization, `ClientShieldManager` replica correctness, rendering, HUD,
screens, and cross-client visibility. That is this plan.

## Prerequisites

- Build the mod jar: `./gradlew build` → `build/libs/bubbleshield-<version>.jar`.
- One dedicated server: `./gradlew runServer` (accept `eula.txt` on first run),
  `online-mode=false` in `server.properties` so two offline identities can join.
- Two NeoForge 1.21.1 clients (21.1.x) with the same jar in `mods/`, distinct
  usernames — **A** (shield owner) and **B** (second player). From a second
  checkout `./gradlew runClient --args="--username TesterB"` works; any launcher
  profile does too.
- Record: server log, both client logs, and screen capture of both clients.

## Test matrix

Execute in order; each step lists the observable pass criterion. "A sees / B
sees" always means: authoritative echo on A **and** replica update on B without
relog.

### 1. Handshake and join resync

| # | Action | Pass criterion |
|---|--------|----------------|
| 1.1 | A joins the dedicated server | Clean NeoForge handshake, no channel-mismatch kick; server log shows the join resync (one sync payload per loaded shield — zero on a fresh world) |
| 1.2 | A places a projector, adds coal, activates (diameter 16, DEFENSE) | Membrane renders on A; boss bar appears; HUD shows `HP cur/max` |
| 1.3 | B joins **after** activation | B receives the shield via join resync: membrane + boss bar visible at the right position without A touching anything |

### 2. Full mutation sweep (A mutates, B observes)

| # | Action | Pass criterion |
|---|--------|----------------|
| 2.1 | A cycles all 10 shapes (GUI) | Each shape change appears on B within ~1 s; no ghost geometry from the previous shape |
| 2.2 | A cycles modes DEFENSE → PULSE → ECO | Mode-dependent barrier behavior flips on the server; boss-bar/HUD state consistent on both |
| 2.3 | A drags the diameter slider 14 → 22 (release commits) | One C2S settings payload on release (server log), B sees the resize |
| 2.4 | A picks an effect + cycle toggle, a beam style, a color | Membrane/beam/color update on B; color also recolors the boss bar |
| 2.5 | A renames the shield ("Fort Kokosnuss"), then clears the name | Boss-bar title updates on both; clearing restores the default |
| 2.6 | A adds B to the whitelist, then removes B | Whitelist count in A's GUI updates; B's barrier behavior flips (see §3) |

### 3. Barrier, whitelist, interception (per mode)

| # | Action | Pass criterion |
|---|--------|----------------|
| 3.1 | B (unlisted) walks into the DEFENSE shield | B is expelled; contact flash on B; passage event **not** spammed (10-tick contact rate limit) |
| 3.2 | B shoots an arrow at the membrane | Arrow intercepted, impact dent + sound at hit point on **both** clients; shield HP drops on both HUDs |
| 3.3 | A whitelists B; B walks through | B passes; aperture/passage visuals fire; no expulsion |
| 3.4 | Repeat 3.1–3.2 under PULSE and ECO | PULSE: B stays inside but is zapped (+1 fuel-s per pulse); ECO: no repel, fuel drain visibly lower; fuel deltas match `FuelMap` |

### 4. Impact batches, break, remove

| # | Action | Pass criterion |
|---|--------|----------------|
| 4.1 | B fires a fast volley (bow spam) | Impacts coalesce (≤ 8 entries per batch + break kept); both clients render dents; sound cap holds (no machine-gun audio) |
| 4.2 | Deplete shield HP until break | Break ghost/nova on both clients; boss bar drops; tier cooldown starts; no stale membrane on B |
| 4.3 | A breaks the projector block | Remove broadcast: replica + boss bar vanish on B immediately |

### 5. Lifecycle edges

| # | Action | Pass criterion |
|---|--------|----------------|
| 5.1 | B disconnects and rejoins mid-activation | Fresh join resync; exactly one replica (no doubles), correct HP snapshot |
| 5.2 | B dies and respawns near the shield | Replica intact after respawn; barrier still applies to B |
| 5.3 | B travels Nether and back | No ghost shield in the Nether; overworld replica re-synced on return |
| 5.4 | Server restart with active shield; A+B rejoin | Shield restored from NBT with name/color/whitelist/fuel intact on both |

### 6. Protocol-version mismatch

| # | Action | Pass criterion |
|---|--------|----------------|
| 6.1 | Rebuild the jar with `ShieldPayloads` protocol version bumped (see the `version` constant) on the **client only**, join | Clean handshake rejection with a readable message — no join followed by runtime codec crash. Revert the bump afterwards |

## Reporting

File results as a wave-log row in `UserFeedback.md` (green/red per section,
logs + captures attached). Any red row is a release blocker per the Eval Sol
gate; regressions in §2–§4 should first be reduced to a GameTest where
possible (mock-player payload capture in
`src/main/java/com/bubbleshield/gametest/` covers everything up to the real
client boundary).
