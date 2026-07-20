# W2–W5 integration

## Start and verify

- Use Java 21 and the checked-in wrapper.
- `./gradlew clean build` compiles common/client sources, processes resources, runs checks, and creates the remapped mod jar.
- `./gradlew runClient` starts the integrated client.
- `./gradlew runServer` starts a dedicated server; accept `run/eula.txt` for local smoke testing.

## Showcase

Create a creative test world with commands enabled.

- Run `/aetherion showcase <scene>` as an operator (permission level 2). Available scenes:
  - `particles` emits every AETHERION particle around the player.
  - `altar` creates a loaded altar and four loaded pedestals five blocks ahead.
  - `starfall` forces a starfall near the player; this scene only works in the Overworld.
  - `boss` spawns Aster five blocks ahead.
  - `portal` creates an active framed Rift Gateway five blocks ahead.
  - `charge` restores the player's Astral Charge to 100.
- Codex: `/give @s aetherion:astral_codex`; use the item to open it. Entries unlock from the AETHERION advancement tree.
- Visuals: `/particle aetherion:starlight_mote ~ ~1 ~ 0.5 0.5 0.5 0.01 30`
- Charge, HUD, and staff: `/give @s aetherion:starcaller_staff`; right-click fires a Star Bolt, sneak-right-click calls a targeted starfall. Holding the staff displays Astral Charge.
- Phase Pearl: `/give @s aetherion:phase_pearl`; right-click blinks toward the crosshair and consumes charge.
- Boss: `/setblock ~ ~-1 ~ aetherion:fallen_star_core` and `/give @s aetherion:sundered_sigil`; use the sigil on the core to summon Aster. Its slam drives the shared screen-shake payload.
- Expanse: `/give @s aetherion:rift_key` and `/give @s aetherion:aetherium_block 20`; build a 4×5 outer Aetherium frame with a 2×3 empty interior, then use the key on the frame.

## Integration contracts

- `ModNetworking` registers the sole definitions of `aetherion:astral_charge_sync` and `aetherion:screen_shake`.
- `Aetherion` owns common registry/manager initialization. `AetherionClient` owns particles, entity/block-entity renderers, Expanse sky effects, HUD, shake ticking, and both S2C receivers.
- The Expanse is data-driven under `data/aetherion/dimension*`; `ModDimensions` supplies its shared typed registry keys.
- Advancements live under the singular 1.21.9 path `data/aetherion/advancement/`.
- `StarfallManager.force` is the server-side API used by the showcase command for deterministic starfall tests.

## Runtime notes

- The Gradle test source set is empty, so validation is currently build plus runtime smoke testing.
- Astral Charge and portal return points are session-local and are not persisted across server restarts.
- Natural starfall triggering remains random (35% per eligible Overworld night); use the showcase command for deterministic testing.
