# UserFeedback — Bubble Shield NeoForge 1.21.1 Port

## Wave-Log

| Wave | Datum      | Inhalt                                                                                                                                                                | Build |
|------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| W0   | 2026-08-02 | Scaffold: NeoForge 21.1.248 MDK (ModDevGradle 2.0.143, Gradle 8.12, Java 21), `@Mod`-Entrypoint `com.bubbleshield.BubbleShield`, `neoforge.mods.toml`, Icon (aus Upstream übernommen), Runs client/server/gameTestServer/data, README, `.gitignore`. Kein Gameplay-Code. | grün  |

## Offene Fragen

- **Wave-Zuschnitt W1+:** Reihenfolge des Ports — Vorschlag: W1 Registries (Block/Item/BlockEntity/Menu) + Basis-Blockverhalten, W2 Shield-Logik/Fuel/Whitelist + Netzwerk-Payloads, W3 Client (Sphere-Renderer, GUI-Screens), W4 die 50 Effekte (Surface/Inside/Screen-Layer), W5 GameTests.
- **Screen-Layer-Effekte:** Upstream nutzt `assets/bubbleshield/post_effect/*.json` (Post-Effect-Format neuerer MC-Versionen). 1.21.1 verwendet noch das ältere Post-Chain-Format (`shaders/post/` + `shaders/program/`). Konvertieren oder Screen-Layer per Overlay/Shader-Mod-API nachbauen?
- **GameTests:** Upstream hängt an `fabric-gametest`; auf NeoForge via `@GameTestHolder`/`neoforge.enabledGameTestNamespaces` (bereits in allen Runs gesetzt). Umfang 1:1 übernehmen?
- **Config:** Soll eine NeoForge-Config (TOML) für Fuel-Werte/Max-Durchmesser ergänzt werden (Upstream hat keine)?

## Abweichungen

- **Minecraft-Version:** Upstream zielt auf Minecraft **26.2** (Java 25, Fabric Loader 0.19.3); der Port zielt vorgabegemäß auf **1.21.1** (Java 21). Das ist ein Downgrade über viele Spielversionen — Vanilla-APIs (u. a. `Identifier`→`ResourceLocation`, Item/Block-Properties, Netzwerk-Codecs, Post-Effects) weichen erheblich ab, nicht nur Fabric→NeoForge.
- **Mod-Version:** Scaffold startet bei `0.1.0` (Upstream `1.0.0`); `1.0.0` erst bei Feature-Parität.
- **mods-Metadaten:** `fabric.mod.json` → `META-INF/neoforge.mods.toml` (Werte werden aus `gradle.properties` via `processResources` expandiert).
- **Keine Mixins im Scaffold:** Upstream nutzt Mixins (`GameRendererInvoker`); auf NeoForge werden zunächst Events/Hooks geprüft, Mixin nur als Fallback.

## Compat

- **NeoForge:** `[21.1.0,)` (gebaut gegen 21.1.248), **Minecraft:** `[1.21.1,1.22)` — deklariert in `neoforge.mods.toml`.
- **Java:** 21 (Toolchain via Gradle erzwungen; foojay-resolver lädt bei Bedarf nach).
- **Seiten:** `side="BOTH"`; Shield-Logik ist serverautoritativ, Rendering/GUI/Screen-FX rein clientseitig (wie Upstream) — Dedicated-Server-Kompatibilität muss beim Client-Port (W3) über `Dist`-Trennung gesichert werden.
- **Fabric-API-Abhängigkeiten entfallen:** Networking (`ShieldPayloads`/`ServerNet`) wird auf NeoForge-`StreamCodec`/`PayloadRegistrar` portiert; Menus auf `IMenuTypeExtension`.
