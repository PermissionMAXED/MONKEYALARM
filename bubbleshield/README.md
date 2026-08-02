# Bubble Shield — NeoForge 1.21.1 Port

NeoForge port of the [Bubble Shield Fabric mod](https://github.com/MedusaV9/MinecraftBubbleShieldMod)
(originally Fabric / Minecraft 26.2): deployable translucent force-field spheres projected from a
furnace-like block that keep hostile players and their projectiles out while letting whitelisted
friends walk right through.

**Status: W0 — scaffold only.** The project builds and loads as an empty `@Mod`; the actual game
content (projector block, shield logic, 50 effects, GUI, networking, shaders) is ported in later
waves. Progress, open questions and deviations are tracked in [`UserFeedback.md`](UserFeedback.md).
Third-party compatibility (Sodium, Iris, Distant Horizons, Create, Create Aeronautics) is
documented in [`docs/COMPAT.md`](docs/COMPAT.md).

## Toolchain

| Component     | Version   |
|---------------|-----------|
| Minecraft     | 1.21.1    |
| NeoForge      | 21.1.248  |
| ModDevGradle  | 2.0.143   |
| Gradle        | 8.12      |
| Java          | 21        |

- `mod_id`: `bubbleshield`
- Package: `com.bubbleshield`
- License: CC0-1.0 (same as upstream)

## Building and running

All commands run from this directory (`bubbleshield/`). Java 21 is required.

```bash
# Build the mod; the jar lands in build/libs/
./gradlew build

# Dev client (needs a GPU/display)
./gradlew runClient

# Headless dev server
./gradlew runServer

# Automated game tests (namespace "bubbleshield" is enabled in all runs)
./gradlew runGameTestServer

# Datagen — output goes to src/generated/resources/
./gradlew runData
```

Run directories are created under `runs/` (`runs/client`, `runs/server`, `runs/gameTestServer`,
`runs/data`) and are gitignored.

## Layout

```
bubbleshield/
├── build.gradle              # ModDevGradle 2.0.143, NeoForge 21.1.248, run configs
├── settings.gradle
├── gradle.properties         # versions + mod metadata (expanded into neoforge.mods.toml)
├── src/main/java/com/bubbleshield/BubbleShield.java   # @Mod entrypoint
└── src/main/resources/
    ├── META-INF/neoforge.mods.toml
    └── assets/bubbleshield/icon.png
```
