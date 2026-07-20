# AETHERION

AETHERION is a Fabric mod for Minecraft 1.21.9 about fallen stars, astral technology, and the hostile dimension beyond the Rift Gateway.

## Features

- Starshard ore and Aetherium tools, armor, and building blocks
- Astral Altar rituals using four surrounding pedestals
- Rift Gateways to the custom Expanse dimension
- Astral Charge abilities, the Starcaller Staff, and the Phase Pearl
- Dynamic Overworld starfalls and Fallen Star Cores
- The multi-phase Aster boss and its Star Wisp minions
- An advancement-gated Astral Codex with English and German localization

## Build and run

Use Java 21 and the checked-in Gradle wrapper.

- `./gradlew clean build` — compile, check resources, and create the remapped mod jar
- `./gradlew runClient` — start the development client
- `./gradlew runServer` — start the dedicated development server
- `./gradlew runDatagen` — validate the configured Fabric data-generation entrypoint

For a first dedicated-server run, set `eula=true` in `run/eula.txt`. Detailed integration notes and manual gameplay flows are documented in `INTEGRATION.md`.

## Showcase command

Operators with permission level 2 can run `/aetherion showcase <scene>`.

Available scenes are `particles`, `altar`, `starfall`, `boss`, `portal`, and `charge`. The command creates each scene near the executing player; `starfall` must be run in the Overworld.

## Resource scripts

The scripts produce deterministic checked-in resources:

- `python3 scripts/gen_resources.py` — base models, item definitions, recipes, loot tables, tags, worldgen, and base language data
- `python3 scripts/gen_textures.py` — base block, item, armor, and Astral Codex textures
- `python3 scripts/gen_particles.py` — particle sprites
- `python3 scripts/gen_w4_textures.py` — boss, minion, and W4 item textures

See `AGENTS.md` before changing generated resource lists or development-runtime behavior.
