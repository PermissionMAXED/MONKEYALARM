# UserFeedback — Bubble Shield NeoForge 1.21.1 Port

## Wave-Log

| Wave | Datum      | Inhalt                                                                                                                                                                | Build |
|------|------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| W0   | 2026-08-02 | Scaffold: NeoForge 21.1.248 MDK (ModDevGradle 2.0.143, Gradle 8.12, Java 21), `@Mod`-Entrypoint `com.bubbleshield.BubbleShield`, `neoforge.mods.toml`, Icon (aus Upstream übernommen), Runs client/server/gameTestServer/data, README, `.gitignore`. Kein Gameplay-Code. | grün  |
| W1   | 2026-08-02 | Pure-Logic-Port: `shield/**` (ShieldState/Logic/Geometry/Linking/Math, FuelMap, Shapes/Modes, GuardEnforcer, `ShieldHost`-Interface), `effect/**` (EffectRegistry-Katalog 840 Effekte + 120 Inside-Behaviors, ohne Client-Shader-Bind), `advancements/**` (7 Criterion-Trigger via DeferredRegister), `net/ShieldPayloads` (Datenrecords inkl. `ImpactEntry`). Entrypoint registriert Behaviors + `EffectRegistry.validate()`. Server-Smoke-Test: Mod lädt, Katalog validiert. | grün  |
| W2   | 2026-08-02 | Registries via DeferredRegister (Blocks/Items/BlockEntities/Menus/CreativeTab/GameRule/TicketType), `BubbleShieldBlock` + `BubbleShieldBlockEntity` (CompoundTag-NBT, MenuProvider, RegionTicket, onRemove-Drops) + `BubbleShieldMenu` (IMenuTypeExtension), Datapack + Assets aus Upstream (Rezepte auf 1.21.1-Ingredient-Format konvertiert). `ServerNet` als W3-Stub. | grün  |
| W3   | 2026-08-02 | Networking: `ShieldPayloads.registerHandlers` via `RegisterPayloadHandlersEvent`/`PayloadRegistrar` (5×`playToServer`, 3×`playToClient`, Protokoll-Version "1"); `ServerNet` komplett (C2S-Handler mit Token-Bucket-Rate-Limit, Owner-/Distanz-/Chunk-Validierung, `PacketDistributor`-S2C-Broadcasts sync/remove/impacts, Level-Join-Resync); Fabric-Lifecycle → NeoForge-Game-Bus: `PlayerLoggedIn`/`PlayerLoggedOut`/`PlayerChangedDimension`/`PlayerRespawn`/`LevelEvent.Unload`/`ServerStopped`. S2C-Client-Handler als Dist-sichere `ClientNet`-Stubs (TODO W5: `ClientShieldManager`). | grün  |

## Offene Fragen

- **Wave-Zuschnitt W1+:** Reihenfolge des Ports — Vorschlag: W1 Registries (Block/Item/BlockEntity/Menu) + Basis-Blockverhalten, W2 Shield-Logik/Fuel/Whitelist + Netzwerk-Payloads, W3 Client (Sphere-Renderer, GUI-Screens), W4 die 50 Effekte (Surface/Inside/Screen-Layer), W5 GameTests.
- **Screen-Layer-Effekte:** Upstream nutzt `assets/bubbleshield/post_effect/*.json` (Post-Effect-Format neuerer MC-Versionen). 1.21.1 verwendet noch das ältere Post-Chain-Format (`shaders/post/` + `shaders/program/`). Konvertieren oder Screen-Layer per Overlay/Shader-Mod-API nachbauen?
- **GameTests:** Upstream hängt an `fabric-gametest`; auf NeoForge via `@GameTestHolder`/`neoforge.enabledGameTestNamespaces` (bereits in allen Runs gesetzt). Umfang 1:1 übernehmen?
- **Config:** Soll eine NeoForge-Config (TOML) für Fuel-Werte/Max-Durchmesser ergänzt werden (Upstream hat keine)?

## Abweichungen

- **Quelle:** Portiert wird die **volle Mod** vom Branch `cursor/bubble-shield-mod` des Upstream-Repos **bubble-shield-mod** (Checkout unter `/tmp/bbs-shield`) — nicht der reduzierte `main`-Stand.
- **Minecraft-Version:** Upstream zielt auf Minecraft **26.2** (Java 25, Fabric Loader 0.19.3); der Port zielt vorgabegemäß auf **1.21.1** (Java 21). Das ist ein Downgrade über viele Spielversionen — Vanilla-APIs (u. a. `Identifier`→`ResourceLocation`, Item/Block-Properties, Netzwerk-Codecs, Post-Effects) weichen erheblich ab, nicht nur Fabric→NeoForge.
- **W1 NBT:** `ValueInput`/`ValueOutput` (26.2) existiert in 1.21.1 nicht — `ShieldState.save/load` arbeitet direkt auf `CompoundTag` mit default-toleranten Gettern; Whitelist-Namen als `ListTag`, Threat-Log über den bestehenden Codec via `NbtOps`.
- **W1 Entity-Referenzen:** 26.2-`EntityReference` entfällt; der Riposte-Besitzer wird beim Deflect über `ServerLevel.getEntity(ownerUuid)` aufgelöst (Offline-Besitzer ⇒ `null`, Pfeil behält dann keinen Owner).
- **W1 Partikel-Mapping (1.21.1 fehlen 26.2-Partikel):** `FIREFLY`→`GLOW`, `PALE_OAK_LEAVES`→`CHERRY_LEAVES`, `COPPER_FIRE_FLAME`→`SOUL_FIRE_FLAME`, `TINTED_LEAVES`(ColorParticleOption)→`dust(rgb)`, `TrailParticleOption`→gepunktete Dust-Spur, `PowerParticleOption(DRAGON_BREATH)`→`DRAGON_BREATH`. Dust-Farben: int-RGB→`Vector3f`-Shims (`BehaviorSupport.dust`/`dustTransition`); der 26.2-Broadcast-Overload `sendParticles(..., overrideLimiter, alwaysShow, ...)` ist als Per-Player-Fanout-Shim in `BehaviorSupport` nachgebaut.
- **W1 Sounds:** `SHIELD_BREAK`/`SHIELD_BLOCK` sind in 1.21.1 direkte `SoundEvent`s (kein `Holder` wie in 26.2, `.value()` entfällt); `RESPAWN_ANCHOR_DEPLETE` bleibt `Holder`.
- **W1 Entkopplung:** `ShieldLogic`/`ShieldLinking` hängen am neuen Interface `shield/ShieldHost` statt an `BubbleShieldBlockEntity`, damit die Pure-Logic-Welle unabhängig vom Block-Entity-Port (W2) kompiliert. Nullability-Annotationen: `org.jetbrains.annotations` (im NeoForge-Dev-Classpath) statt Upstream-JSpecify.
- **W3 Event-Mapping:** Fabric `ServerPlayConnectionEvents.JOIN/DISCONNECT` → NeoForge `PlayerLoggedInEvent`/`PlayerLoggedOutEvent`, `ServerEntityLevelChangeEvents.AFTER_PLAYER_CHANGE_LEVEL` → `PlayerChangedDimensionEvent` (feuert NACH dem Wechsel, `player.serverLevel()` ist das Ziel), `ServerPlayerEvents.AFTER_RESPAWN` → `PlayerRespawnEvent`, `ServerLevelEvents.UNLOAD` → `LevelEvent.Unload` (mit `instanceof ServerLevel`-Guard, feuert auch clientseitig), `SERVER_STOPPED` → `ServerStoppedEvent`. `PlayerLookup.level()` → `PacketDistributor.sendToPlayersInDimension` bzw. `level.players()`-Loop (Distanzfilter für Impacts). 1.21.1-Vanilla: `Level.isLoaded` existiert nicht (und `hasChunkAt` ist deprecated) → `ServerChunkCache.getChunkNow` (nur voll geladene Chunks, erzwingt nie einen Chunk-Load); `GameProfile.name()` (26.2-Record) → `getName()`.
- **Mod-Version:** Scaffold startet bei `0.1.0` (Upstream `1.0.0`); `1.0.0` erst bei Feature-Parität.
- **mods-Metadaten:** `fabric.mod.json` → `META-INF/neoforge.mods.toml` (Werte werden aus `gradle.properties` via `processResources` expandiert).
- **Keine Mixins im Scaffold:** Upstream nutzt Mixins (`GameRendererInvoker`); auf NeoForge werden zunächst Events/Hooks geprüft, Mixin nur als Fallback.

## Compat

- **NeoForge:** `[21.1.0,)` (gebaut gegen 21.1.248), **Minecraft:** `[1.21.1,1.22)` — deklariert in `neoforge.mods.toml`.
- **Java:** 21 (Toolchain via Gradle erzwungen; foojay-resolver lädt bei Bedarf nach).
- **Seiten:** `side="BOTH"`; Shield-Logik ist serverautoritativ, Rendering/GUI/Screen-FX rein clientseitig (wie Upstream) — Dedicated-Server-Kompatibilität muss beim Client-Port (W3) über `Dist`-Trennung gesichert werden.
- **Fabric-API-Abhängigkeiten entfallen:** Networking (`ShieldPayloads`/`ServerNet`) wird auf NeoForge-`StreamCodec`/`PayloadRegistrar` portiert; Menus auf `IMenuTypeExtension`.
