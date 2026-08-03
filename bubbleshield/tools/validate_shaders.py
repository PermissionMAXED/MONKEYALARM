#!/usr/bin/env python3
"""Dev tool: hard validation gate for the W6 surface/beam shader programs.

W6 retarget of upstream's validator for the NeoForge 1.21.1 port: the mod's
membrane/beam pipelines are vanilla-style `ShaderInstance` core programs
(#version 150 GLSL + a program JSON per shader under
assets/bubbleshield/shaders/core/), not 26.2 RenderPipelines, so this gate
validates BOTH halves of each program: the GLSL compiles/links and the JSON
wiring (vertex/fragment program ids, the Sampler0 slot, the vanilla
auto-filled uniform list) is exactly what ShieldPipelines.java expects.

The VM has no GPU driver; the only way to run shaders is a software-GL
client, so this is the fast, exhaustive check. One invalid or missing surface
shader would fall back (fail-soft) at runtime -- but a fallback-only release
is a broken release, so this gate is deliberately fail-CLOSED: the expected
file sets are derived from EffectRegistry.java's COUNT (not from whatever
happens to be on disk), and any gap, extra, misplaced file or half-generated
state is a hard failure.

What it does:

1. parses `COUNT` from src/main/java/com/bubbleshield/effect/EffectRegistry.java
   (the single source of truth for the catalogue size),
2. extracts the vanilla include files (fog.glsl) from the Minecraft 1.21.1
   client jar in the NeoForm runtime cache (override with --client-jar),
3. inlines every '#moj_import <X.glsl>' occurrence (dropping the includes'
   own '#version' lines, which may not repeat mid-file),
4. writes the stitched copies to a per-invocation tempfile.TemporaryDirectory
   (so concurrent runs can never cross-contaminate), and
5. runs 'glslangValidator -S frag' (resp. '-S vert' for .vsh) on every file,
   in a multiprocessing pool by default (use --serial to disable).

COUNT-derived inventory (fail-closed):

* the core/bubble dir must contain EXACTLY fx_000..fx_{COUNT-1}.fsh, their
  paired fx_NNN.json program JSONs, and surface.vsh (contiguous, no gaps, no
  extras) -- on 1.21.1 the .fsh and its JSON are ONE program unit and
  regenerate together (tools/gen_surface_shaders.py);
* the core/beam dir must contain EXACTLY one hand-written beam_<style>.fsh
  (+ its beam_<style>.json) per rendered BeamStyle -- the name set is DERIVED
  from BeamStyle.java's RENDERED array (single source of truth) and
  cross-checked against ShieldPipelines.java's BEAM_STYLE_NAMES registration
  list, so the enum, the shader registration and the shader files can never
  drift apart. A small NAMED set, one per style, NOT per-effect, so it is
  deliberately excluded from the fx_ COUNT contiguity cross-check but still
  fully compile- and link-validated (against bubble/surface.vsh, whose
  varyings they share);
* a recursive sweep of the whole shaders/core tree rejects any
  .fsh/.vsh/.glsl/.json outside those exact path sets -- a misplaced or stray
  file is a hard failure, not a silently-ignored file. (The W8 screen-effect
  assets under shaders/post and shaders/program belong to
  tools/gen_screen_shaders.py / tools/gen_post_effects.py and are validated
  by that wave's tooling, NOT here -- shaders/core is exactly the namespace
  the ShaderInstance loader reads.)

The only escape hatch is the explicit --allow-empty flag, which skips the
fx generated-set checks ONLY while that side has never been generated at all
(no generated files AND no manifest). Without the flag, a missing generated
set fails the run. The hand-written beam set is never skipped.

Cross-stage LINK validation (per-file -S frag alone cannot catch vsh<->fsh
interface mismatches that fail on real drivers):

* every fx_NNN.fsh AND every beam_<style>.fsh is stitched together with
  bubble/surface.vsh (the one shared vertex program in every program JSON)
  and run through 'glslangValidator -l <vert> <frag>';
* glslang's GLSL link is lenient about a fragment input that simply has no
  matching vertex output (a rename), so a declared-interface cross-check also
  verifies every fragment 'in' has a vertex 'out' with the same type and name.

Program-JSON contract (fail-closed; ShaderInstance.setDefaultUniforms only
fills uniforms that are DECLARED in the JSON -- dropping one silently freezes
it at its JSON default, and an extra one is per-draw warning spam):

* every fx_NNN.json: vertex == "bubbleshield:bubble/surface", fragment ==
  "bubbleshield:bubble/fx_NNN", samplers EXACTLY [Sampler0], uniforms EXACTLY
  the pinned (name, type, count) sequence ModelViewMat/ProjMat/FogStart/
  FogEnd/FogColor/FogShape/GameTime with well-formed default values;
* every beam_<style>.json: the same, except fragment ==
  "bubbleshield:beam/beam_<style>" and NO samplers at all (the beam shaders
  sample nothing);
* the GLSL uniform declarations are pinned to the same contract: every fx
  .fsh declares EXACTLY {sampler2D Sampler0, float GameTime, float FogStart,
  float FogEnd, vec4 FogColor, int FogShape}, every beam .fsh the same minus
  Sampler0, and surface.vsh EXACTLY {mat4 ModelViewMat, mat4 ProjMat} -- a
  custom uniform would never be filled by setDefaultUniforms and is a hard
  failure, exactly like a dropped vanilla one.

On top of that it enforces the generated-shader invariants:

* code-uniqueness: no two .fsh across the scanned dirs may share the same
  COMMENT-STRIPPED, whitespace-normalized GLSL (SHA-256 of the executable
  source, not the raw bytes);
* every generated fx_*.fsh carries all six structural layer markers
  ([layer:deep:...], [layer:mid:...], [layer:rim:...], [layer:motif:...],
  [layer:thick:...], [layer:inner:...]), and the in-file motif marker's
  (class, envelope) pair must MATCH the manifest's recorded per-id motif
  fingerprint (motif/env);
* v12 cost budget (check_cost_budget, comment-stripped counts): every fx
  spends EXACTLY 7 texture taps (7 atlasTile call sites minus the helper
  definition; the 26.2 Sampler1/Sampler2 scene-copy taps are GONE in the
  1.21.1 port -- there is no SceneCopy, refraction became the translucent
  Beer-Lambert glass composite), has NO direct 'texture(Sampler0' tap outside
  the atlasTile helper body, keeps its field-function call sites
  (deepField/fbm2/fbm3/caustic/vnoise3) at or under the hardcoded ceiling and
  its raw line count at or under 760, carries exactly one
  [layer:inner:<recipe>] marker equal to the manifest's thick.inner, and the
  recomputed tap/field counts must equal the manifest's costTaps/costField;
* tools/surface_manifest.json exists, has EXACTLY the ids 0..COUNT-1, its
  entries match the fx_* files on disk 1:1, and its (family, warp, deep, rim,
  anim) stack tuples are pairwise distinct (the structural-variety guarantee).

Sampler0 texture-binding contract (fail-closed; glslangValidator compiles a
declared-but-unused sampler cleanly and never sees the Java side or the PNG,
so a renamed TextureStateShard constant, a half-migrated shader or a
missing/corrupt atlas would otherwise surface only at real client resource
load -- which the GPU-less CI VM cannot run):

* ShieldPipelines.java must construct the membrane TextureStateShard from an
  identifier that resolves (directly or through the assigned constant,
  cross-checked like parse_beam_names) to
  BubbleShield.id("textures/effect/surface_atlas.png"), and must reference
  RegisterShadersEvent + EventBusSubscriber (the beam registration path --
  losing the annotation silently drops every custom beam to the W5 fallback);
* every fx_*.fsh must both DECLARE 'uniform sampler2D Sampler0;' and USE it
  ('texture(Sampler0' present after comment stripping);
* NO shader may reference Sampler1/Sampler2 anymore (the scene copy does not
  exist in the 1.21.1 port; a stale refraction tap would die with a missing
  sampler at draw time), the beam shaders must reference NO SamplerN at all,
  and no shader may carry a 'layout(binding' qualifier (the slot comes from
  the JSON samplers list, never from GLSL);
* the atlas itself must ship at
  src/main/resources/assets/bubbleshield/textures/effect/surface_atlas.png as
  a valid PNG with the expected geometry (4096x2048, 8-bit, color-type 6 =
  truecolor+alpha RGBA), and it is decoded END TO END, not just its IHDR.
  Its .png.mcmeta sibling must be valid JSON.

The full scan at COUNT=840 is 849 GLSL compiles (840 fx + surface.vsh + 8
beams) + 848 vsh<->fsh link checks + 848 program JSONs (the tallies scale
with COUNT and the rendered-BeamStyle set).

Exits nonzero when any shader fails to compile or link, any inventory entry is
missing/extra/misplaced, or any invariant is violated. Usage:

    python3 tools/validate_shaders.py [--serial] [--allow-empty]
                                      [--client-jar <path>]
"""

import argparse
import hashlib
import json
import multiprocessing
import re
import struct
import subprocess
import sys
import tempfile
import zipfile
import zlib
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
# The vanilla 1.21.1 client jar (for the fog.glsl include): the NeoForm
# runtime caches it once per version, machine-wide. --client-jar overrides.
DEFAULT_CLIENT_JAR = Path.home() / ".gradle/caches/neoformruntime/artifacts/minecraft_1.21.1_client.jar"
INCLUDE_NAMES = ["fog"]
REGISTRY_JAVA = REPO_ROOT / "src/main/java/com/bubbleshield/effect/EffectRegistry.java"
MAIN_SHADER_ROOT = REPO_ROOT / "src/main/resources/assets/bubbleshield/shaders"
# 1.21.1: ShaderInstance core programs live under shaders/core/<name>.json
# (+ .vsh/.fsh); this validator owns EXACTLY that tree. The W8 screen-effect
# assets (shaders/post, shaders/program) belong to that wave's tooling.
CORE_DIR = MAIN_SHADER_ROOT / "core"
BUBBLE_DIR = CORE_DIR / "bubble"
BEAM_DIR = CORE_DIR / "beam"
SURFACE_VSH = BUBBLE_DIR / "surface.vsh"
# The projector-beam shaders: a fixed NAMED set (one per rendered BeamStyle in
# com.bubbleshield.shield.BeamStyle), hand-written rather than generated, so
# they sit outside the fx_ COUNT contiguity contract but are still
# compile-validated and link-validated against bubble/surface.vsh. The name set
# is DERIVED from BeamStyle.java's RENDERED array (single source of truth, see
# parse_beam_names) and cross-checked against ShieldPipelines.java's
# BEAM_STYLE_NAMES registration list.
BEAM_STYLE_JAVA = REPO_ROOT / "src/main/java/com/bubbleshield/shield/BeamStyle.java"
SHIELD_PIPELINES_JAVA = REPO_ROOT / "src/main/java/com/bubbleshield/client/render/ShieldPipelines.java"
BEAM_RENDERED_RE = re.compile(r"BeamStyle\[\]\s+RENDERED\s*=\s*\{([^}]*)\}\s*;")
BEAM_PIPELINE_NAMES_RE = re.compile(r"String\[\]\s+BEAM_STYLE_NAMES\s*=\s*\{([^}]*)\}\s*;")
MANIFEST_PATH = REPO_ROOT / "tools/surface_manifest.json"
# 1.21.1 moj_import: bare '<X.glsl>' resolves inside the minecraft include
# dir (the 26.2 'minecraft:' prefix form is gone).
MOJ_IMPORT = re.compile(r"^#moj_import <([a-z_]+)\.glsl>\s*$")
COUNT_RE = re.compile(r"^\s*public static final int COUNT = (\d+);", re.MULTILINE)
FX_NAME = re.compile(r"^fx_(\d{3})\.fsh$")
FX_JSON_NAME = re.compile(r"^fx_(\d{3})\.json$")
LAYER_MARKERS = ("// [layer:deep:", "// [layer:mid:", "// [layer:rim:", "// [layer:motif:",
                 # v11 volumetric thickness: every fx must carry the chord/paratex
                 # thickness layers and the back-face interior recipe.
                 "// [layer:thick:", "// [layer:inner:")
# The per-id motif fingerprint marker the generator writes into every fx file
# (// [layer:motif:<class>:<envelope>]); its (class, envelope) pair is
# cross-checked against the manifest's recorded (motif, env) so the in-file
# marker and the manifest can never drift apart.
MOTIF_MARKER_RE = re.compile(r"^\s*// \[layer:motif:([a-z0-9]+):([a-z0-9]+)\]\s*$", re.MULTILINE)
# The v11 inner-face recipe marker (// [layer:inner:<recipe>]); its recipe
# name is cross-checked against the manifest's thick.inner in
# check_cost_budget so the marker and the manifest can never drift apart.
INNER_MARKER_RE = re.compile(r"^\s*// \[layer:inner:([a-z0-9_]+)\]\s*$", re.MULTILINE)
STACK_KEYS = ("family", "warp", "deep", "rim", "anim", "motif", "motifN", "env")
# v9 per-EFFECT motif fingerprint: within one family, no two ids may share
# the same (motif class, element count, envelope) triple -- the structural
# per-id distinctness guarantee beyond the palette.
MOTIF_KEYS = ("motif", "motifN", "env")
BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.DOTALL)
LINE_COMMENT = re.compile(r"//[^\n]*")
# Global-scope stage in/out declarations (the vanilla includes declare none, so
# scanning the raw sources is exact; function parameters never match because a
# declaration must end in ';' right after the name).
STAGE_IO = re.compile(r"^\s*(?:flat\s+|noperspective\s+|smooth\s+)?(in|out)\s+(\w+)\s+(\w+)\s*;", re.MULTILINE)
# Global-scope uniform declarations, for the pinned GLSL uniform-set check.
UNIFORM_DECL = re.compile(r"^\s*uniform\s+(\w+)\s+(\w+)\s*;", re.MULTILINE)

# --- Program-JSON contract (see module docstring) ----------------------------
# The one shared vertex program every fx and beam program JSON references.
VERTEX_PROGRAM = "bubbleshield:bubble/surface"
# The pinned JSON uniform sequence (name, type, count): exactly the vanilla
# auto-filled set ShaderInstance.setDefaultUniforms services. Order is pinned
# too -- the generator emits it deterministically, so drift means hand-editing.
EXPECTED_JSON_UNIFORMS = (
    ("ModelViewMat", "matrix4x4", 16),
    ("ProjMat", "matrix4x4", 16),
    ("FogStart", "float", 1),
    ("FogEnd", "float", 1),
    ("FogColor", "float", 4),
    ("FogShape", "int", 1),
    ("GameTime", "float", 1),
)
# The pinned GLSL uniform sets per stage (type, name), compared as sets: a
# declaration the JSON does not list is never filled (silently frozen), an
# extra JSON entry is per-draw warning spam, so both sides are pinned.
FX_GLSL_UNIFORMS = {("sampler2D", "Sampler0"), ("float", "GameTime"), ("float", "FogStart"),
                    ("float", "FogEnd"), ("vec4", "FogColor"), ("int", "FogShape")}
BEAM_GLSL_UNIFORMS = FX_GLSL_UNIFORMS - {("sampler2D", "Sampler0")}
VSH_GLSL_UNIFORMS = {("mat4", "ModelViewMat"), ("mat4", "ProjMat")}

# --- Sampler0 texture-binding contract (see module docstring) ---------------
# The shipped surface atlas every bubble fx samples through Sampler0, plus its
# .mcmeta sibling.
SURFACE_ATLAS_PNG = REPO_ROOT / "src/main/resources/assets/bubbleshield/textures/effect/surface_atlas.png"
SURFACE_ATLAS_MCMETA = SURFACE_ATLAS_PNG.with_name(SURFACE_ATLAS_PNG.name + ".mcmeta")
# The ResourceLocation path ShieldPipelines must feed the membrane
# TextureStateShard.
SURFACE_ATLAS_ID_PATH = "textures/effect/surface_atlas.png"
SURFACE_ATLAS_SIZE = (4096, 2048)  # 8x4 grid of 512px tiles (32 tiles)
SURFACE_ATLAS_BIT_DEPTH = 8
SURFACE_ATLAS_COLOR_TYPE = 6  # truecolor + alpha (RGBA); A is the emission mask
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
# The uniform declaration every fx must carry, and the sampling call that must
# consume it (both matched after comment stripping; a declared-but-unused
# sampler is a hard failure, not a warning).
SAMPLER0_DECL_RE = re.compile(r"^\s*uniform\s+sampler2D\s+Sampler0\s*;", re.MULTILINE)
SAMPLER0_USE_RE = re.compile(r"\btexture\s*\(\s*Sampler0\b")
# The 26.2 scene-copy samplers are GONE in the 1.21.1 port (no SceneCopy):
# ANY Sampler1/Sampler2 reference is a stale refraction tap and a hard
# failure. Beam shaders bind no texture at all, so for them ANY SamplerN
# reference fails.
SCENE_SAMPLER_RE = re.compile(r"\bSampler[12]\b")
ANY_SAMPLER_RE = re.compile(r"\bSampler[0-9]\b")
# layout(binding = N) needs #version 420 / ARB_shading_language_420pack; at the
# shaders' #version 150 it fails to compile on real drivers. The slot comes
# from the program JSON's samplers list, never from GLSL.
LAYOUT_BINDING_RE = re.compile(r"layout\s*\(\s*binding\b")
# ShieldPipelines.java binding-chain patterns (searched after comment
# stripping, so a javadoc mention can never satisfy the check): the direct
# form new TextureStateShard(BubbleShield.id("..."), ...), the indirect form
# new TextureStateShard(CONSTANT, ...) plus that constant's
# CONSTANT = BubbleShield.id("...") assignment (cross-checked the same way
# parse_beam_names cross-checks BEAM_STYLE_NAMES).
TEXTURE_SHARD_DIRECT_RE = re.compile(
    r'new\s+TextureStateShard\(\s*BubbleShield\.id\(\s*"([^"]+)"\s*\)')
TEXTURE_SHARD_VAR_RE = re.compile(r"new\s+TextureStateShard\(\s*(\w+)\s*,")

# --- v12 per-fx cost budget (see check_cost_budget; the regexes mirror the
# count_texture_taps / count_field_calls helpers in gen_surface_shaders.py,
# and the counts are cross-checked against the manifest's costTaps/costField
# so the recorded cost and the emitted file can never drift apart) ----------
# Texture taps: atlasTile() call sites (minus the helper definition itself;
# its internal texture(Sampler0 is the same tap, not an extra one). The v12
# 1.21.1 contract is exactly 7 atlasTile sites (center + 2 gradient + 2 flow
# + 2 deep-parallax); the 26.2 Sampler1/Sampler2 scene-copy taps are gone
# with SceneCopy. Because atlasTile call sites are the unit of counting, a
# direct 'texture(Sampler0' ANYWHERE outside the helper's own body would be
# an uncounted tap -- sampler0_taps_outside_atlas() makes that a hard failure
# instead of letting it escape the budget. The Sampler1/Sampler2 tap terms
# stay in the recount formula purely to mirror the generator's
# count_texture_taps (check_texture_binding hard-fails any occurrence, so
# they always count zero here).
ATLAS_CALL_RE = re.compile(r"\batlasTile\s*\(")
ATLAS_DEF_RE = re.compile(r"^\s*vec4\s+atlasTile\s*\(", re.MULTILINE)
SAMPLER1_TAP_RE = re.compile(r"\btexture\s*\(\s*Sampler1\b")
SAMPLER2_TAP_RE = re.compile(r"\btexture\s*\(\s*Sampler2\b")
EXPECTED_TEXTURE_TAPS = 7
# Field-function call sites (the procedural-noise ALU cost proxy),
# definitions excluded the same way.
FIELD_CALL_RE = re.compile(r"\b(?:deepField|fbm2|fbm3|caustic|vnoise3)\s*\(")
FIELD_DEF_RE = re.compile(r"^\s*float\s+(?:deepField|fbm2|fbm3|caustic|vnoise3)\s*\(", re.MULTILINE)
# Pre-v11 fleet maximum was 20 call sites (fx_482, PRISMDISPERSE); the v11
# inner recipes/showcases add at most 1 per file, so 20 + 3 leaves headroom
# without letting a runaway composer slip through.
FIELD_CALL_CEILING = 23
# Raw line ceiling, kept in lock-step with the generator's 130..760 sanity
# bounds.
MAX_FX_LINES = 760


def parse_registry_count() -> int:
    """The catalogue size, parsed from EffectRegistry.java (source of truth)."""
    if not REGISTRY_JAVA.is_file():
        sys.exit(f"EffectRegistry.java not found: {REGISTRY_JAVA}")
    match = COUNT_RE.search(REGISTRY_JAVA.read_text(encoding="utf-8"))
    if not match:
        sys.exit(f"could not parse 'COUNT = <n>' from {REGISTRY_JAVA}")
    return int(match.group(1))


def strip_comments(text: str) -> str:
    return LINE_COMMENT.sub("", BLOCK_COMMENT.sub("", text))


def normalized_code(text: str) -> str:
    """The shader's EXECUTABLE source: comments stripped, per-line whitespace
    collapsed, empty lines dropped. The uniqueness check hashes this (not the
    raw bytes), so a unique-id comment or seed annotation can never make two
    copies of the same executable shader count as distinct."""
    lines = (" ".join(line.split()) for line in strip_comments(text).splitlines())
    return "\n".join(line for line in lines if line)


def parse_beam_names() -> tuple[str, ...]:
    """The expected beam shader file names, derived from BeamStyle.java's
    RENDERED array (the single source of truth) and cross-checked against
    ShieldPipelines.java's BEAM_STYLE_NAMES registration list. Exits when
    either cannot be parsed or when they disagree, so the enum, the shader
    registration and the shader file set can never silently drift."""
    if not BEAM_STYLE_JAVA.is_file():
        sys.exit(f"BeamStyle.java not found: {BEAM_STYLE_JAVA}")
    match = BEAM_RENDERED_RE.search(strip_comments(BEAM_STYLE_JAVA.read_text(encoding="utf-8")))
    if not match:
        sys.exit(f"could not parse 'BeamStyle[] RENDERED = {{...}}' from {BEAM_STYLE_JAVA}")
    styles = [entry.strip().lower() for entry in match.group(1).split(",") if entry.strip()]
    if not styles:
        sys.exit(f"BeamStyle.RENDERED parsed empty from {BEAM_STYLE_JAVA}")

    if not SHIELD_PIPELINES_JAVA.is_file():
        sys.exit(f"ShieldPipelines.java not found: {SHIELD_PIPELINES_JAVA}")
    pipelines_match = BEAM_PIPELINE_NAMES_RE.search(
        strip_comments(SHIELD_PIPELINES_JAVA.read_text(encoding="utf-8")))
    if not pipelines_match:
        sys.exit(f"could not parse 'String[] BEAM_STYLE_NAMES = {{...}}' from {SHIELD_PIPELINES_JAVA}")
    pipeline_names = [entry.strip().strip('"') for entry in pipelines_match.group(1).split(",") if entry.strip()]
    if pipeline_names != styles:
        sys.exit(f"BeamStyle.RENDERED {styles} != ShieldPipelines.BEAM_STYLE_NAMES {pipeline_names} "
                 "(the enum and the shader registration drifted apart)")
    return tuple(f"beam_{name}.fsh" for name in styles)


def extract_vanilla(client_jar: Path) -> dict[str, str]:
    """Extracts the vanilla include sources (keyed by name) from the jar."""
    if not client_jar.is_file():
        sys.exit(f"vanilla client jar not found: {client_jar}\n"
                 "(run any gradle task once to populate the NeoForm cache, or pass --client-jar)")

    includes: dict[str, str] = {}
    with zipfile.ZipFile(client_jar) as jar:
        for name in INCLUDE_NAMES:
            source = jar.read(f"assets/minecraft/shaders/include/{name}.glsl").decode("utf-8")
            # The includes carry their own '#version' header, which must not be
            # repeated mid-file after inlining.
            lines = [line for line in source.splitlines() if not line.startswith("#version")]
            includes[name] = "\n".join(lines).strip("\n")

    return includes


def stitch(source: str, includes: dict[str, str], label: str) -> str:
    stitched: list[str] = []
    for line in source.splitlines():
        match = MOJ_IMPORT.match(line.strip())
        if match:
            name = match.group(1)
            if name not in includes:
                sys.exit(f"{label}: unknown moj_import '{name}.glsl' (add it to INCLUDE_NAMES)")
            stitched.append(f"// --- inlined {name}.glsl ---")
            stitched.append(includes[name])
            stitched.append(f"// --- end {name}.glsl ---")
        else:
            stitched.append(line)

    return "\n".join(stitched) + "\n"


def run_glslang(job: tuple[str, list[str]]) -> tuple[str, bool, str]:
    """Pool worker: runs one glslangValidator invocation (compile or link).

    Takes/returns plain strings so the job stays picklable for multiprocessing.
    """
    label, argv = job
    result = subprocess.run(argv, capture_output=True, text=True)
    return label, result.returncode == 0, (result.stdout + result.stderr).strip()


def interface_errors(vert_source: str, frag_source: str, label: str) -> list[str]:
    """Declared-interface cross-check: every fragment 'in' needs a same-typed
    vertex 'out' of the same name (glslang's GLSL link pass is lenient about
    plain renames, which still fail on real drivers)."""
    vert_outs = {name: type_ for direction, type_, name in STAGE_IO.findall(strip_comments(vert_source))
                 if direction == "out"}
    errors = []
    for direction, type_, name in STAGE_IO.findall(strip_comments(frag_source)):
        if direction != "in":
            continue
        if name not in vert_outs:
            errors.append(f"{label}: fragment input '{type_} {name}' has no matching vertex output")
        elif vert_outs[name] != type_:
            errors.append(f"{label}: fragment input '{type_} {name}' vs vertex output "
                          f"'{vert_outs[name]} {name}' (type mismatch)")
    return errors


def check_inventory(count: int, beam_names: tuple[str, ...], skip_fx: bool) -> list[str]:
    """COUNT-derived exact file sets + recursive sweep for misplaced files."""
    errors: list[str] = []

    def diff_exact(directory: Path, expected: set[str], what: str) -> None:
        if not directory.is_dir():
            errors.append(f"{what} directory not found: {directory}")
            return
        actual = {p.name for p in directory.iterdir() if p.is_file()}
        for missing in sorted(expected - actual):
            errors.append(f"{what}: missing expected file {directory / missing}")
        for extra in sorted(actual - expected):
            errors.append(f"{what}: unexpected file {directory / extra}")

    # 1.21.1: the .fsh and its program JSON are one unit; both are inventoried.
    expected_bubble = {"surface.vsh"}
    if not skip_fx:
        expected_bubble |= {f"fx_{i:03d}.fsh" for i in range(count)}
        expected_bubble |= {f"fx_{i:03d}.json" for i in range(count)}
    diff_exact(BUBBLE_DIR, expected_bubble, f"bubble program set (COUNT={count})")

    # The beam set is COUNT-independent (one shader per rendered BeamStyle,
    # derived from BeamStyle.java), but still exact: a missing style silently
    # drops that beam to the W5 fallback forever, an extra file is a stray.
    expected_beam = set(beam_names) | {name.replace(".fsh", ".json") for name in beam_names}
    diff_exact(BEAM_DIR, expected_beam, f"beam program set (BeamStyle.RENDERED, {len(beam_names)} styles)")

    # Recursive sweep: no .fsh/.vsh/.glsl/.json may exist anywhere under
    # shaders/core outside the exact per-directory sets above (a misplaced
    # fx_*.fsh under beam/ or a stray nested dir must fail, not be ignored).
    allowed = {Path("bubble") / name for name in expected_bubble}
    allowed |= {Path("beam") / name for name in expected_beam}
    if not CORE_DIR.is_dir():
        errors.append(f"core shader root not found: {CORE_DIR}")
    else:
        for path in sorted(CORE_DIR.rglob("*")):
            if path.is_file() and path.suffix in (".fsh", ".vsh", ".glsl", ".json") \
                    and path.relative_to(CORE_DIR) not in allowed:
                errors.append(f"unexpected shader file: {path.relative_to(REPO_ROOT)}")

    if not errors:
        print(f"OK    shader program inventory is exactly COUNT={count} derived from EffectRegistry.java")
    return errors


def check_manifest_ids(manifest: dict, count: int, name: str) -> list[str]:
    """The manifest key set must be exactly the string ids 0..COUNT-1."""
    errors = []
    expected = {str(i) for i in range(count)}
    actual = set(manifest)
    for missing in sorted(expected - actual, key=int):
        errors.append(f"{name} is missing id {missing} (must cover exactly 0..{count - 1})")
    for extra in sorted(actual - expected):
        errors.append(f"{name} has unexpected id {extra} (must cover exactly 0..{count - 1})")
    return errors


def check_generated_invariants(shaders: list[Path], count: int, skip_fx: bool) -> list[str]:
    """Code-uniqueness + fx layer markers + manifest agreement. Returns errors."""
    errors: list[str] = []

    # 1. No two .fsh anywhere in the scanned dirs may share the same
    # COMMENT-STRIPPED, whitespace-normalized source: hashing the raw bytes
    # would let two executably-identical shaders pass as "distinct" on the
    # strength of a unique-id comment or seed annotation alone.
    by_digest: dict[str, Path] = {}
    for shader in shaders:
        if shader.suffix != ".fsh":
            continue
        digest = hashlib.sha256(normalized_code(shader.read_text(encoding="utf-8")).encode("utf-8")).hexdigest()
        if digest in by_digest:
            errors.append(f"code-identical shaders (identical after comment stripping): "
                          f"{by_digest[digest].name} == {shader.name}")
        else:
            by_digest[digest] = shader

    if skip_fx:
        print("NOTE  --allow-empty: no generated fx_*.fsh and no surface_manifest.json yet -- "
              "skipping generated-shader checks (run tools/gen_surface_shaders.py)")
        return errors
    fx_files = sorted(p for p in shaders if FX_NAME.match(p.name))

    # 2. Every generated fx_*.fsh must carry the six structural layer markers;
    # the motif marker's (class, envelope) pair is remembered for the manifest
    # cross-check below.
    file_motifs: dict[str, tuple[str, str]] = {}
    for shader in fx_files:
        text = shader.read_text()
        for marker in LAYER_MARKERS:
            if marker not in text:
                errors.append(f"{shader.name}: missing structural marker '{marker}...]'")
        motif_match = MOTIF_MARKER_RE.search(text)
        if motif_match:
            file_motifs[shader.name] = (motif_match.group(1), motif_match.group(2))

    # 3. Manifest exists, covers exactly ids 0..COUNT-1, matches the fx_* file
    # set, and its stack tuples are pairwise distinct.
    if not MANIFEST_PATH.is_file():
        errors.append(f"surface manifest is missing: {MANIFEST_PATH}")
        return errors
    try:
        manifest = json.loads(MANIFEST_PATH.read_text())
    except json.JSONDecodeError as e:
        errors.append(f"{MANIFEST_PATH.name}: invalid JSON ({e})")
        return errors

    errors += check_manifest_ids(manifest, count, MANIFEST_PATH.name)
    manifest_files = {entry.get("file") for entry in manifest.values()}
    disk_files = {p.name for p in fx_files}
    for missing in sorted(manifest_files - disk_files):
        errors.append(f"manifest lists {missing} but the file does not exist")
    for extra in sorted(disk_files - manifest_files):
        errors.append(f"{extra} exists on disk but is not in the manifest")
    for effect_id, entry in sorted(manifest.items()):
        expected = f"fx_{int(effect_id):03d}.fsh"
        if entry.get("file") != expected:
            errors.append(f"manifest id {effect_id} points at {entry.get('file')}, expected {expected}")

    stacks: dict[tuple, str] = {}
    for effect_id, entry in sorted(manifest.items()):
        stack = tuple(entry.get(key) for key in STACK_KEYS)
        if stack in stacks:
            errors.append(f"manifest ids {stacks[stack]} and {effect_id} share the same "
                          f"stack tuple {dict(zip(STACK_KEYS, stack))}")
        else:
            stacks[stack] = effect_id

    # v9 per-EFFECT motif fingerprint distinctness: the (motif, motifN, env)
    # triple must be present on every entry and pairwise distinct WITHIN each
    # family -- two effects of one family must differ in structure AND
    # motion, not just hue. The in-file '// [layer:motif:<class>:<envelope>]'
    # marker must also MATCH the manifest's recorded (motif, env) pair, so the
    # marker and the manifest can never drift apart (e.g. a stale manifest
    # over regenerated files, or a hand-edited fx file).
    family_motifs: dict[tuple, str] = {}
    motif_markers_checked = 0
    fx_names_on_disk = {p.name for p in fx_files}
    for effect_id, entry in sorted(manifest.items()):
        triple = tuple(entry.get(key) for key in MOTIF_KEYS)
        if any(value is None for value in triple):
            errors.append(f"manifest id {effect_id} is missing a motif fingerprint key "
                          f"(expected all of {list(MOTIF_KEYS)})")
            continue
        fam_key = (entry.get("family"),) + triple
        if fam_key in family_motifs:
            errors.append(f"manifest ids {family_motifs[fam_key]} and {effect_id} (family "
                          f"{entry.get('family')}) share the same motif fingerprint "
                          f"{dict(zip(MOTIF_KEYS, triple))}")
        else:
            family_motifs[fam_key] = effect_id

        file_name = entry.get("file")
        if file_name not in fx_names_on_disk:
            continue  # already reported as a missing file above
        marker = file_motifs.get(file_name)
        if marker is None:
            errors.append(f"{file_name}: manifest id {effect_id} records motif "
                          f"({entry.get('motif')}, {entry.get('env')}) but the file has no "
                          "parseable '// [layer:motif:<class>:<envelope>]' marker")
        elif marker != (entry.get("motif"), entry.get("env")):
            errors.append(f"{file_name}: in-file motif marker '// [layer:motif:{marker[0]}:{marker[1]}]' "
                          f"does not match manifest id {effect_id}'s recorded motif "
                          f"({entry.get('motif')}, {entry.get('env')})")
        else:
            motif_markers_checked += 1

    print(f"OK    generated-shader invariants ({len(fx_files)} fx files, "
          f"{len(manifest)} manifest entries, {len(stacks)} distinct stacks, "
          f"{len(family_motifs)} per-family-distinct motif fingerprints, "
          f"{motif_markers_checked} in-file motif markers match the manifest)")
    return errors


def json_uniform_errors(config: dict, json_name: str) -> list[str]:
    """The pinned uniform sequence check shared by fx and beam program JSONs."""
    errors: list[str] = []
    uniforms = config.get("uniforms")
    if not isinstance(uniforms, list):
        return [f"{json_name}: no 'uniforms' array"]
    actual = []
    for uniform in uniforms:
        name = uniform.get("name")
        actual.append((name, uniform.get("type"), uniform.get("count")))
        values = uniform.get("values")
        if not (isinstance(values, list) and len(values) == uniform.get("count")
                and all(isinstance(component, (int, float)) and not isinstance(component, bool)
                        for component in values)):
            errors.append(f"{json_name}: uniform {name} 'values' is not a "
                          f"{uniform.get('count')}-number list")
    if tuple(actual) != EXPECTED_JSON_UNIFORMS:
        errors.append(f"{json_name}: uniform (name, type, count) sequence {actual} != pinned "
                      f"{list(EXPECTED_JSON_UNIFORMS)} (setDefaultUniforms only fills DECLARED "
                      "uniforms; a dropped one silently freezes at its JSON default)")
    return errors


def glsl_uniform_errors(path: Path, expected: set[tuple[str, str]]) -> list[str]:
    """The pinned GLSL uniform-set check (comment-stripped, exact set)."""
    declared = {(type_, name) for type_, name
                in UNIFORM_DECL.findall(strip_comments(path.read_text(encoding="utf-8")))}
    errors = []
    for type_, name in sorted(expected - declared):
        errors.append(f"{path.name}: missing 'uniform {type_} {name};' declaration")
    for type_, name in sorted(declared - expected):
        errors.append(f"{path.name}: unexpected 'uniform {type_} {name};' declaration "
                      "(setDefaultUniforms never fills custom uniforms; the frozen contract "
                      "is the vanilla auto-filled set only)")
    return errors


def check_program_jsons(count: int, beam_names: tuple[str, ...], skip_fx: bool) -> list[str]:
    """The 1.21.1 program-JSON contract + pinned GLSL uniform sets (see module
    docstring). Missing files are already reported by check_inventory, so this
    only validates the files that exist. Returns errors."""
    errors: list[str] = []
    checked = 0

    fx_ids = [] if skip_fx else list(range(count))
    for effect_id in fx_ids:
        json_path = BUBBLE_DIR / f"fx_{effect_id:03d}.json"
        fsh_path = BUBBLE_DIR / f"fx_{effect_id:03d}.fsh"
        if not json_path.is_file():
            continue
        try:
            config = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{json_path.name}: invalid JSON ({e})")
            continue
        before = len(errors)
        if config.get("vertex") != VERTEX_PROGRAM:
            errors.append(f"{json_path.name}: vertex program {config.get('vertex')!r}, "
                          f"expected {VERTEX_PROGRAM!r}")
        expected_frag = f"bubbleshield:bubble/fx_{effect_id:03d}"
        if config.get("fragment") != expected_frag:
            errors.append(f"{json_path.name}: fragment program {config.get('fragment')!r}, "
                          f"expected {expected_frag!r}")
        samplers = [s.get("name") for s in config.get("samplers") or []]
        if samplers != ["Sampler0"]:
            errors.append(f"{json_path.name}: samplers {samplers} != ['Sampler0'] "
                          "(every fx samples exactly the surface atlas)")
        errors += json_uniform_errors(config, json_path.name)
        if fsh_path.is_file():
            errors += glsl_uniform_errors(fsh_path, FX_GLSL_UNIFORMS)
        if len(errors) == before:
            checked += 1

    for beam_fsh in beam_names:
        name = beam_fsh.removesuffix(".fsh")
        json_path = BEAM_DIR / f"{name}.json"
        fsh_path = BEAM_DIR / beam_fsh
        if not json_path.is_file():
            continue
        try:
            config = json.loads(json_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{json_path.name}: invalid JSON ({e})")
            continue
        before = len(errors)
        if config.get("vertex") != VERTEX_PROGRAM:
            errors.append(f"{json_path.name}: vertex program {config.get('vertex')!r}, "
                          f"expected {VERTEX_PROGRAM!r}")
        expected_frag = f"bubbleshield:beam/{name}"
        if config.get("fragment") != expected_frag:
            errors.append(f"{json_path.name}: fragment program {config.get('fragment')!r}, "
                          f"expected {expected_frag!r}")
        if config.get("samplers"):
            errors.append(f"{json_path.name}: declares samplers {config.get('samplers')} but the "
                          "beam shaders sample nothing (a declared-but-unbound sampler is "
                          "per-draw warning spam)")
        errors += json_uniform_errors(config, json_path.name)
        if fsh_path.is_file():
            errors += glsl_uniform_errors(fsh_path, BEAM_GLSL_UNIFORMS)
        if len(errors) == before:
            checked += 1

    if SURFACE_VSH.is_file():
        errors += glsl_uniform_errors(SURFACE_VSH, VSH_GLSL_UNIFORMS)

    if not errors:
        print(f"OK    program-JSON contract ({checked} program JSONs pin vertex={VERTEX_PROGRAM}, "
              f"their own fragment, the sampler slots and the {len(EXPECTED_JSON_UNIFORMS)} vanilla "
              "auto-filled uniforms; GLSL uniform sets pinned per stage)")
    return errors


def parse_png_ihdr(data: bytes) -> tuple[int, int, int, int] | str:
    """(width, height, bit depth, color type) from the IHDR chunk, or an error
    description string when the data is not a structurally valid PNG header."""
    if data[:8] != PNG_SIGNATURE:
        return "does not start with the 8-byte PNG signature"
    if len(data) < 33:  # signature + IHDR length/type/13-byte payload/CRC
        return "truncated before a complete IHDR chunk"
    length, chunk_type = struct.unpack(">I4s", data[8:16])
    if chunk_type != b"IHDR" or length != 13:
        return f"first chunk is {chunk_type!r} with length {length}, expected a 13-byte IHDR"
    width, height, bit_depth, color_type = struct.unpack(">IIBB", data[16:26])
    return width, height, bit_depth, color_type


# PNG color type -> samples per pixel, for the decoded-raster size check.
PNG_CHANNELS = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}


def parse_png(data: bytes) -> tuple[int, int, int, int] | str:
    """Full structural decode of a PNG (not just the IHDR): the chunk chain
    must be well-formed with valid per-chunk CRCs and terminated by IEND, and
    the concatenated IDAT payload must zlib-decompress to EXACTLY the
    height * (1 filter byte + scanline bytes) the IHDR geometry implies --
    a truncated or bit-corrupted atlas passes an IHDR-only parse but fails
    here instead of at client resource load. Returns (width, height, bit
    depth, color type) on success, else an error description string."""
    header = parse_png_ihdr(data)
    if isinstance(header, str):
        return header
    width, height, bit_depth, color_type = header
    compression, filter_method, interlace = struct.unpack(">BBB", data[26:29])
    if compression != 0 or filter_method != 0:
        return f"IHDR compression/filter method {compression}/{filter_method}, expected 0/0"
    if interlace != 0:
        # The Adam7 pass layout has a different decompressed size; the
        # generator always writes non-interlaced scanlines.
        return f"IHDR interlace method {interlace}, expected 0 (non-interlaced)"
    channels = PNG_CHANNELS.get(color_type)
    if channels is None:
        return f"unknown PNG color type {color_type}"

    idat = bytearray()
    saw_iend = False
    offset = 8
    while offset < len(data):
        if offset + 8 > len(data):
            return f"truncated chunk header at byte {offset}"
        length, chunk_type = struct.unpack(">I4s", data[offset:offset + 8])
        chunk_name = chunk_type.decode("latin-1")
        end = offset + 8 + length + 4  # header + payload + CRC
        if end > len(data):
            return f"truncated {chunk_name} chunk at byte {offset} (file ends {end - len(data)} bytes early)"
        payload = data[offset + 8:offset + 8 + length]
        (crc,) = struct.unpack(">I", data[end - 4:end])
        if zlib.crc32(chunk_type + payload) != crc:
            return f"{chunk_name} chunk at byte {offset} fails its CRC (corrupted)"
        if chunk_type == b"IDAT":
            idat += payload
        elif chunk_type == b"IEND":
            saw_iend = True
            if end != len(data):
                return f"{len(data) - end} trailing bytes after the IEND chunk"
            break
        offset = end
    if not saw_iend:
        return "no IEND chunk (truncated PNG)"
    if not idat:
        return "no IDAT chunk (no image data)"

    try:
        raster = zlib.decompress(bytes(idat))
    except zlib.error as e:
        return f"IDAT payload fails to zlib-decompress ({e})"
    scanline_bytes = (width * channels * bit_depth + 7) // 8
    expected = height * (1 + scanline_bytes)
    if len(raster) != expected:
        return (f"IDAT decompresses to {len(raster)} bytes, expected {expected} "
                f"({height} scanlines x (1 filter byte + {scanline_bytes} pixel bytes))")
    return width, height, bit_depth, color_type


def sampler0_taps_outside_atlas(text: str) -> int:
    """Count 'texture(Sampler0' call sites OUTSIDE the atlasTile helper body
    in comment-stripped GLSL. The tap budget counts atlasTile call sites, so
    the helper's own internal tap is the only legitimate direct Sampler0
    sample; anything else is an uncounted texture tap. Brace-matches each
    atlasTile definition to its closing brace so multi-line helper bodies
    stay covered."""
    spans: list[tuple[int, int]] = []
    for definition in ATLAS_DEF_RE.finditer(text):
        open_brace = text.find("{", definition.end())
        if open_brace < 0:
            continue
        depth = 0
        end = len(text)
        for i in range(open_brace, len(text)):
            if text[i] == "{":
                depth += 1
            elif text[i] == "}":
                depth -= 1
                if depth == 0:
                    end = i + 1
                    break
        spans.append((definition.start(), end))
    return sum(1 for tap in SAMPLER0_USE_RE.finditer(text)
               if not any(start <= tap.start() < end for start, end in spans))


def check_cost_budget(shaders: list[Path], skip_fx: bool) -> list[str]:
    """v12 per-fx cost lint (fail-closed, like everything else here): every
    generated fx must spend EXACTLY the contracted texture budget (7 atlasTile
    call sites -- the 26.2 Sampler1/Sampler2 scene-copy taps are gone with
    SceneCopy), have NO direct 'texture(Sampler0' tap outside the atlasTile
    helper body (it would escape the atlasTile-call-site count), stay at or
    under the field-function call ceiling and the raw line ceiling, and agree
    with the manifest's records -- the in-file [layer:inner:<recipe>] marker
    must equal thick.inner, and the recomputed tap/field counts must equal
    costTaps/costField. glslang can not see any of this (an extra tap or a
    runaway inner recipe compiles fine), so this is the only gate keeping
    the per-fragment cost and the recorded cost model honest. Returns errors."""
    errors: list[str] = []
    if skip_fx:
        return errors
    fx_files = sorted(p for p in shaders if FX_NAME.match(p.name))

    manifest: dict = {}
    if MANIFEST_PATH.is_file():
        try:
            manifest = json.loads(MANIFEST_PATH.read_text())
        except json.JSONDecodeError:
            manifest = {}  # already reported by check_generated_invariants
    by_file = {entry.get("file"): entry for entry in manifest.values()}

    checked = 0
    for shader in fx_files:
        raw = shader.read_text(encoding="utf-8")
        text = strip_comments(raw)
        file_ok = True

        taps = (len(ATLAS_CALL_RE.findall(text)) - len(ATLAS_DEF_RE.findall(text))
                + len(SAMPLER1_TAP_RE.findall(text)) + len(SAMPLER2_TAP_RE.findall(text)))
        if taps != EXPECTED_TEXTURE_TAPS:
            errors.append(f"{shader.name}: {taps} texture taps (atlasTile call sites), "
                          f"expected exactly {EXPECTED_TEXTURE_TAPS}")
            file_ok = False

        stray_taps = sampler0_taps_outside_atlas(text)
        if stray_taps:
            errors.append(f"{shader.name}: {stray_taps} direct 'texture(Sampler0' tap(s) outside "
                          "the atlasTile helper definition -- all Sampler0 sampling must go "
                          "through atlasTile() so the tap budget counts it")
            file_ok = False

        fields = len(FIELD_CALL_RE.findall(text)) - len(FIELD_DEF_RE.findall(text))
        if fields > FIELD_CALL_CEILING:
            errors.append(f"{shader.name}: {fields} field-function call sites "
                          f"(deepField/fbm2/fbm3/caustic/vnoise3), over the ceiling "
                          f"{FIELD_CALL_CEILING}")
            file_ok = False

        raw_lines = raw.count("\n")
        if raw_lines > MAX_FX_LINES:
            errors.append(f"{shader.name}: {raw_lines} lines, over the {MAX_FX_LINES}-line ceiling")
            file_ok = False

        inner_markers = INNER_MARKER_RE.findall(raw)
        if len(inner_markers) != 1:
            errors.append(f"{shader.name}: expected exactly one '// [layer:inner:<recipe>]' "
                          f"marker, found {len(inner_markers)}")
            file_ok = False

        entry = by_file.get(shader.name)
        if entry is None:
            continue  # missing manifest entry is already reported elsewhere
        thick = entry.get("thick")
        if not isinstance(thick, dict) or not isinstance(thick.get("rho"), (int, float)) \
                or not isinstance(thick.get("k"), (int, float)) or "inner" not in thick:
            errors.append(f"{shader.name}: manifest entry has no valid 'thick' record "
                          "(expected {rho: <num>, k: <num>, inner: <recipe>})")
            file_ok = False
        elif len(inner_markers) == 1 and inner_markers[0] != thick["inner"]:
            errors.append(f"{shader.name}: in-file marker '// [layer:inner:{inner_markers[0]}]' "
                          f"does not match manifest thick.inner '{thick['inner']}'")
            file_ok = False
        if entry.get("costTaps") != taps:
            errors.append(f"{shader.name}: manifest costTaps {entry.get('costTaps')} != "
                          f"recomputed {taps}")
            file_ok = False
        if entry.get("costField") != fields:
            errors.append(f"{shader.name}: manifest costField {entry.get('costField')} != "
                          f"recomputed {fields}")
            file_ok = False
        if file_ok:
            checked += 1

    if not errors:
        print(f"OK    v12 cost budget ({checked} fx at exactly {EXPECTED_TEXTURE_TAPS} texture "
              f"taps, no Sampler0 tap outside atlasTile, field calls <= {FIELD_CALL_CEILING}, "
              f"<= {MAX_FX_LINES} lines, inner marker + costTaps/costField match the manifest)")
    return errors


def check_texture_binding(shaders: list[Path], beam_names: tuple[str, ...]) -> list[str]:
    """The Sampler0 texture-binding contract, fail-closed (see module
    docstring). glslangValidator compiles a declared-but-unused sampler
    cleanly and never sees ShieldPipelines.java or the shipped PNG, so a
    renamed TextureStateShard constant, a half-migrated shader or a
    missing/corrupt atlas would otherwise surface only at real client
    resource load -- which the GPU-less CI VM cannot run. Returns errors."""
    errors: list[str] = []

    # 1. The Java side of the chain: the membrane render type must construct
    # its TextureStateShard from the shipped atlas identifier, and the beam
    # registration path (RegisterShadersEvent + the EventBusSubscriber
    # annotation that delivers it) must still be present (comment-stripped
    # source, so documentation mentions can never satisfy the check).
    bound_path = None
    if not SHIELD_PIPELINES_JAVA.is_file():
        errors.append(f"ShieldPipelines.java not found: {SHIELD_PIPELINES_JAVA}")
    else:
        pipelines_src = strip_comments(SHIELD_PIPELINES_JAVA.read_text(encoding="utf-8"))
        for token, why in (("RegisterShadersEvent", "the beam programs are never registered"),
                           ("EventBusSubscriber", "the RegisterShadersEvent handler is never delivered")):
            if token not in pipelines_src:
                errors.append(f"ShieldPipelines.java no longer references {token} ({why}; "
                              "every custom pipeline silently drops to the W5 fallback)")
        direct = TEXTURE_SHARD_DIRECT_RE.search(pipelines_src)
        if direct:
            bound_path = direct.group(1)
        else:
            via_var = TEXTURE_SHARD_VAR_RE.search(pipelines_src)
            if not via_var:
                errors.append("ShieldPipelines.java has no 'new TextureStateShard(...)' construction "
                              "(the surface atlas is no longer bound to the membrane render types; "
                              "every fx samples Sampler0)")
            else:
                constant = via_var.group(1)
                assign = re.search(
                    rf'\b{re.escape(constant)}\s*=\s*BubbleShield\.id\(\s*"([^"]+)"\s*\)', pipelines_src)
                if not assign:
                    errors.append(f"ShieldPipelines.java: new TextureStateShard({constant}, ...) found, but "
                                  f"{constant} is not assigned from BubbleShield.id(\"...\") -- cannot "
                                  "verify the bound atlas path (the ResourceLocation constant drifted)")
                else:
                    bound_path = assign.group(1)
        if bound_path is not None and bound_path != SURFACE_ATLAS_ID_PATH:
            errors.append(f"ShieldPipelines.java: the membrane TextureStateShard binds \"{bound_path}\", "
                          f"expected \"{SURFACE_ATLAS_ID_PATH}\"")

    # 2. The GLSL side: every fx must both declare AND sample Sampler0 (a
    # declared-but-unused sampler is per-draw warning spam and the signature
    # of a half-migrated shader; sampling without a declaration cannot
    # compile), NO shader may reference the removed Sampler1/Sampler2 scene
    # copy, no shader may use layout(binding, and the beam shaders must stay
    # free of ANY SamplerN (their program JSONs declare no samplers).
    fx_files = sorted(p for p in shaders if FX_NAME.match(p.name))
    beam_files = sorted(p for p in shaders if p.name in beam_names)
    for shader in fx_files:
        text = strip_comments(shader.read_text(encoding="utf-8"))
        declared = SAMPLER0_DECL_RE.search(text) is not None
        used = SAMPLER0_USE_RE.search(text) is not None
        if declared and not used:
            errors.append(f"{shader.name}: declares 'uniform sampler2D Sampler0;' but never calls "
                          "'texture(Sampler0' (declared-but-unused sampler: per-draw warning "
                          "spam / half-migrated shader)")
        elif used and not declared:
            errors.append(f"{shader.name}: samples Sampler0 without the "
                          "'uniform sampler2D Sampler0;' declaration")
        elif not declared:
            errors.append(f"{shader.name}: missing 'uniform sampler2D Sampler0;' + 'texture(Sampler0' "
                          "(every bubble fx must sample the shared surface atlas)")
        if SCENE_SAMPLER_RE.search(text):
            errors.append(f"{shader.name}: references Sampler1/Sampler2, but the 1.21.1 port has no "
                          "SceneCopy -- the scene-copy refraction became the translucent glass "
                          "composite; a stale tap dies with a missing sampler at draw time")
        if LAYOUT_BINDING_RE.search(text):
            errors.append(f"{shader.name}: 'layout(binding' qualifier found (fails to compile at "
                          "#version 150; the slot comes from the program JSON's samplers list, not GLSL)")
    for shader in beam_files:
        text = strip_comments(shader.read_text(encoding="utf-8"))
        if ANY_SAMPLER_RE.search(text):
            errors.append(f"{shader.name}: references a SamplerN uniform, but the beam program JSONs "
                          "declare no samplers (the beam render types bind no texture)")
        if LAYOUT_BINDING_RE.search(text):
            errors.append(f"{shader.name}: 'layout(binding' qualifier found (fails to compile at "
                          "#version 150; beam programs bind no sampler at all)")

    # 3. The shipped atlas: a fully-decodable PNG (well-formed chunk chain,
    # CRCs, IEND, IDAT zlib-decompresses to the exact raster size -- not just
    # a plausible IHDR) with the exact geometry the shaders' 8x4 tile math
    # assumes, plus a valid-JSON .mcmeta sibling.
    atlas_geometry = None
    if not SURFACE_ATLAS_PNG.is_file():
        errors.append(f"surface atlas is missing: {SURFACE_ATLAS_PNG.relative_to(REPO_ROOT)} "
                      "(every bubble fx samples it; a missing texture fails at client resource load)")
    else:
        parsed = parse_png(SURFACE_ATLAS_PNG.read_bytes())
        if isinstance(parsed, str):
            errors.append(f"{SURFACE_ATLAS_PNG.relative_to(REPO_ROOT)}: {parsed}")
        else:
            width, height, bit_depth, color_type = parsed
            atlas_geometry = f"{width}x{height}"
            if (width, height) != SURFACE_ATLAS_SIZE:
                errors.append(f"{SURFACE_ATLAS_PNG.name}: {width}x{height}, expected "
                              f"{SURFACE_ATLAS_SIZE[0]}x{SURFACE_ATLAS_SIZE[1]} "
                              "(the shaders' 8x4 tile UV math assumes this geometry)")
            if bit_depth != SURFACE_ATLAS_BIT_DEPTH or color_type != SURFACE_ATLAS_COLOR_TYPE:
                errors.append(f"{SURFACE_ATLAS_PNG.name}: bit depth {bit_depth} / color type {color_type}, "
                              f"expected {SURFACE_ATLAS_BIT_DEPTH} / {SURFACE_ATLAS_COLOR_TYPE} "
                              "(truecolor+alpha RGBA; the A channel is the emission mask)")
    if not SURFACE_ATLAS_MCMETA.is_file():
        errors.append(f"surface atlas mcmeta is missing: {SURFACE_ATLAS_MCMETA.relative_to(REPO_ROOT)}")
    else:
        try:
            json.loads(SURFACE_ATLAS_MCMETA.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            errors.append(f"{SURFACE_ATLAS_MCMETA.name}: invalid JSON ({e})")

    if not errors:
        print(f"OK    Sampler0 texture-binding contract ({len(fx_files)} fx declare+sample Sampler0, "
              f"no Sampler1/Sampler2 anywhere, {len(beam_files)} beam shaders sampler-free, "
              f"no layout(binding, atlas {atlas_geometry} RGBA fully decoded + valid mcmeta, "
              f"ShieldPipelines binds \"{bound_path}\")")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description="compile/link-validate the mod's GLSL shader programs")
    parser.add_argument("--serial", action="store_true",
                        help="run one glslangValidator at a time instead of using a process pool")
    parser.add_argument("--allow-empty", action="store_true",
                        help="explicit opt-in: skip the fx generated-set checks while that side "
                             "has never been generated (no files AND no manifest). Without this "
                             "flag a missing generated set is a hard failure.")
    parser.add_argument("--client-jar", type=Path, default=DEFAULT_CLIENT_JAR,
                        help="the vanilla 1.21.1 client jar to extract fog.glsl from "
                             f"(default: {DEFAULT_CLIENT_JAR})")
    args = parser.parse_args()

    count = parse_registry_count()
    beam_names = parse_beam_names()
    includes = extract_vanilla(args.client_jar)

    fx_never_generated = not any(BUBBLE_DIR.glob("fx_*.fsh")) and not MANIFEST_PATH.is_file()
    skip_fx = args.allow_empty and fx_never_generated

    inventory_errors = check_inventory(count, beam_names, skip_fx)

    shaders: list[Path] = []
    if CORE_DIR.is_dir():
        shaders = sorted(p for p in CORE_DIR.rglob("*") if p.is_file() and p.suffix in (".fsh", ".vsh"))

    with tempfile.TemporaryDirectory(prefix="bubbleshield_shader_validation_") as tmp:
        out_dir = Path(tmp)

        # Stitch every mod shader once; keep raw sources for the interface check.
        stitched_paths: dict[Path, Path] = {}
        raw_sources: dict[Path, str] = {}
        compile_jobs: list[tuple[str, list[str]]] = []
        for shader in shaders:
            stage = "vert" if shader.suffix == ".vsh" else "frag"
            relative = shader.relative_to(REPO_ROOT)
            stitched = out_dir / ("__".join(relative.parts[-2:]) + (".vert" if stage == "vert" else ".frag"))
            raw_sources[shader] = shader.read_text()
            stitched.write_text(stitch(raw_sources[shader], includes, str(relative)))
            stitched_paths[shader] = stitched
            compile_jobs.append((str(relative), ["glslangValidator", "-S", stage, str(stitched)]))

        # Link jobs: every fx AND every beam against bubble/surface.vsh (the
        # one shared vertex program every program JSON references).
        link_jobs: list[tuple[str, list[str]]] = []
        interface_issues: list[str] = []
        for shader in shaders:
            if (FX_NAME.match(shader.name) or shader.name in beam_names) and SURFACE_VSH in stitched_paths:
                label = f"link surface.vsh <-> {shader.name}"
                link_jobs.append((label, ["glslangValidator", "-l",
                                          str(stitched_paths[SURFACE_VSH]), str(stitched_paths[shader])]))
                interface_issues += interface_errors(raw_sources[SURFACE_VSH], raw_sources[shader], label)

        jobs = compile_jobs + link_jobs
        if args.serial:
            results = [run_glslang(job) for job in jobs]
        else:
            with multiprocessing.Pool() as pool:
                results = pool.map(run_glslang, jobs)

    compile_failures = 0
    link_failures = 0
    for (label, ok, output), is_link in zip(results, [False] * len(compile_jobs) + [True] * len(link_jobs)):
        if ok:
            print(f"PASS  {label}")
        else:
            if is_link:
                link_failures += 1
            else:
                compile_failures += 1
            print(f"FAIL  {label}")
            if output:
                print("      " + "\n      ".join(output.splitlines()))

    for issue in interface_issues:
        print(f"FAIL  {issue}")

    invariant_errors = inventory_errors
    invariant_errors += check_generated_invariants(shaders, count, skip_fx)
    invariant_errors += check_cost_budget(shaders, skip_fx)
    invariant_errors += check_program_jsons(count, beam_names, skip_fx)
    # The Sampler0/atlas contract runs unconditionally: ShieldPipelines.java
    # and the shipped atlas are hand-maintained (not generated), so even an
    # --allow-empty run must verify them. With no fx generated yet the per-fx
    # loop is simply empty.
    invariant_errors += check_texture_binding(shaders, beam_names)
    for error in invariant_errors:
        print(f"FAIL  {error}")

    print(f"\n{len(compile_jobs) - compile_failures}/{len(compile_jobs)} shaders passed glslangValidator")
    print(f"{len(link_jobs) - link_failures}/{len(link_jobs)} vsh<->fsh links passed glslangValidator -l "
          f"(+{len(interface_issues)} declared-interface issues)")
    if compile_failures or link_failures or interface_issues or invariant_errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
