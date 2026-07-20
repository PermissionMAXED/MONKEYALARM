# AETHERION

Fabric mod scaffold for Minecraft 1.21.9. Standard build and run tasks are defined by Loom in `build.gradle`; use the checked-in Gradle wrapper with Java 21.

## Cursor Cloud specific instructions

- Common code/resources live under `src/main`; client-only code/resources live under `src/client` because Loom split environment source sets are enabled.
- Minecraft 1.21.9 item settings require a registry key before constructing an item. Keep the `Item.Settings.registryKey(...)` step in `ModItems`.
- Item rendering uses both the 1.21.4+ item definition under `assets/aetherion/items/` and the conventional model under `assets/aetherion/models/item/`.
- Astral Altar recipes use four pedestals exactly two blocks away in each cardinal direction. The altar holds the catalyst; placing the final ingredient triggers the server-side craft.
- Base-content JSON is checked in under `src/main/resources`; rerun `scripts/gen_resources.py` after changing its resource lists and `scripts/gen_textures.py` after changing the procedural palette or sprites. `runDatagen` validates the wired datagen entrypoint but intentionally does not replace these hand-maintained resources.
- The Cloud VM has no ALSA output device. `runClient` can report an OpenAL initialization error while the client and resource loading continue normally; this is an environment limitation, not a mod startup failure.
- Particle sprites are generated separately with `scripts/gen_particles.py`; W4 boss, minion, and item textures use `scripts/gen_w4_textures.py`. Rerun the matching generator after changing that artwork.
- Fabric API 0.134.1 for Minecraft 1.21.9 has no `DimensionRenderingRegistry`; Expanse sky state and dimension-effects registration therefore use client mixins, while the HUD uses `VanillaHudElements.INFO_BAR` (the 1.21.9 replacement for an experience-bar-specific anchor).
- Rift Gateways use an exact 4×5 outer Aetherium frame with a 2×3 empty interior; use a Rift Key on any frame block. The generated Expanse landing gateway is at Y=96, and return positions are session-local (after a server restart, an Expanse gateway safely falls back to the Overworld spawn).
