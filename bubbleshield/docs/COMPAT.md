# Third-party compatibility (W9)

Compatibility posture of the Bubble Shield NeoForge 1.21.1 port toward the usual
performance/render/tech stack. Ground rule for everything below: **no hard
dependencies** — `neoforge.mods.toml` declares only `minecraft` + `neoforge`,
`build.gradle` pulls no third-party maven artifacts, and no third-party class is
referenced at compile time. Iris is the only mod we probe at runtime, and only
via `ModList` + reflection (`com.bubbleshield.client.compat.IrisCompat`).

| Mod | Status | Mechanism |
|---|---|---|
| Sodium | compatible by construction | no mixins, no `LevelRenderer` hooks (audit below) |
| Iris | compatible, soft-detected | vanilla-shader fallback render types + post FX disabled while a shaderpack is active |
| Distant Horizons | no interaction | shields only exist inside vanilla sync/render distance; membrane writes no depth |
| Create | compatible, behavioural | contraptions are neither `Player` nor `Projectile` nor `Enemy` → the shield ignores them |
| Create Aeronautics | compatible, behavioural | airships are in-flight contraptions → same as Create |

## Sodium

Audit result (W9): **the mod ships zero mixins** — no `*.mixins.json`, no
`MixinConfigs` manifest entry — and `git grep LevelRenderer` over `src/` is
empty. Every render-path hook is a plain NeoForge event on vanilla buffers:

| Hook | Used for | Sodium relevance |
|---|---|---|
| `RenderLevelStageEvent` at `AFTER_TRANSLUCENT_BLOCKS` | membrane + beam (`ShieldRenderer`) | NeoForge dispatches the stage events from its own `LevelRenderer` patches; Sodium's replaced terrain path does not remove them |
| `Minecraft.renderBuffers().bufferSource()` | vertex emission (immediate mode, explicit `endBatch` per shield) | vanilla `BufferSource`; never touches chunk meshing or terrain vertex formats |
| `RegisterGuiLayersEvent` / `RegisterMenuScreensEvent` | HUD layers + screens | GUI pass, outside Sodium's scope |
| Access transformer on `BossHealthOverlay.events` | HUD boss-bar offset | GUI field access, not render-pipeline state |

Nothing injects into section building, chunk render lists or terrain shaders, so
Sodium's renderer swap is invisible to the shield. Keep it that way: any future
render work must stay on `RenderLevelStageEvent`/`RenderType` — **no
`LevelRenderer` mixins**.

## Iris

Soft-detection lives in `client/compat/IrisCompat` and is lazy (first
render-path query, never during mod construction):

1. `ModList.isLoaded("iris")` (NeoForge 1.21.1) or `"oculus"` (legacy Forge
   port) — if neither is present the probe is never even class-looked-up;
2. reflective bind of `net.irisshaders.iris.api.v0.IrisApi#isShaderPackInUse()`
   into a `MethodHandle` (per-frame cheap). Any failure — missing API class,
   signature drift, a throwing probe — logs once and **trips permanently to
   "no shaderpack"**: a broken Iris degrades to fallback rendering, never a
   render-loop crash.

Consequences while a shaderpack is active:

- **Membrane/beam fall back**: `ShieldRenderTypes.renderType()` /
  `beamRenderType()` return the vanilla `position_tex_color` fallback types.
  Modded `ShaderInstance`s have no gbuffer/shadow-pass variants under Iris, so
  W6's custom per-effect pipelines may only ever be returned *below* that gate
  (the gate is a behavioural no-op until W6 lands — pre-W6 the fallback is the
  only pipeline — but the branch is the frozen contract).
- **Post FX are disabled**: `IrisCompat.postFxAllowed()` is the frozen contract
  the W8 screen post-effect port (`ScreenEffectManager`, the
  `post_effect/effect_NN` chains) must gate on — a shaderpack owns the post
  pipeline, and layering our chains over it double-processes the frame and
  breaks packs that re-bind the main target.
- GUI-pass visuals (contact flash overlay, shield HUD) stay on: Iris leaves the
  GUI pass alone.

The fallback membrane is ordinary translucent geometry with no depth write, so
under Iris it renders through the pack's translucent gbuffer program like any
vanilla-equivalent translucency — dimmer/tinted per pack, but present.

## Distant Horizons

No shared hooks. Shields render around synced block entities only, i.e. inside
the server's block-entity sync radius and therefore well inside vanilla render
distance; DH's LOD terrain draws in its own pass and never receives shield
geometry, so distant bubbles simply are not visible (by design — the client
does not even know about them). The membrane does not write depth
(`ShieldRenderTypes`), so it cannot occlude or z-fight DH terrain behind it.
No detection code needed.

## Create (soft notes — contraptions, not players)

No Create class is referenced anywhere; everything below is a behavioural
consequence of the vanilla-only entity partition in `ShieldLogic.serverTick`,
which sorts the scanned entities into exactly three buckets: `Projectile`,
`Player`, and `Mob && Enemy` (alive).

- **Contraptions pass through.** A moving contraption entity (minecart,
  piston/bearing/gantry/pulley assembly) is none of the three buckets → it is
  never intercepted, never expelled, never counted by the threat census and
  never zapped by PULSE. The membrane is not a physical collider, so
  contraption-carried blocks glide through as well. Whitelisting a contraption
  is neither possible nor needed — the whitelist admits *players*
  (UUID/name), and that is intentional: **contraptions are not players**.
- **Passengers are.** A player or hostile mob riding/standing on a contraption
  is still a real `Player`/`Enemy` and gets the normal barrier treatment the
  moment *they* cross the boundary — a non-whitelisted player flying an
  airship through a bubble gets pushed off the deck by the barrier while the
  contraption itself sails on. Working as intended.
- **Deployers are fake players.** Create's Deployer interacts through a fake
  `Player`; the barrier treats it like any player (push-out only — the shield
  never cancels interactions). A deployer working across the membrane boundary
  behaves best with its owner whitelisted.
- **Projector on a contraption is inert.** `BubbleShieldBlockEntity` needs real
  in-level ticking plus its region ticket; while contraption-mounted it is
  storage NBT only — no tick, no bubble, no fuel drain — and resumes when the
  contraption disassembles back into blocks.

## Create Aeronautics

Airships are permanently-assembled Create contraptions in flight, so the Create
notes apply verbatim: hulls fly through membranes unhindered (contraptions, not
players), crew members are barrier-checked as themselves, and a shield
projector built into an airship stays inert until the ship is disassembled
somewhere. No detection code, no dependency.

## Re-audit triggers

Re-check this document whenever a wave adds: custom `ShaderInstance` pipelines
(W6 — must sit below the Iris gate), post-effect chains (W8 — must consult
`postFxAllowed()`), any mixin (breaks the Sodium audit's "zero mixins" claim),
or any entity-scan bucket beyond `Projectile`/`Player`/`Enemy` (changes the
Create story).
