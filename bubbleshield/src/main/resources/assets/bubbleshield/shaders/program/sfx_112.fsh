#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 112. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:glitch:tear:surge:none]

uniform sampler2D DiffuseSampler;

in vec2 texCoord;

// Legacy 1.21.1 plain uniforms (no std140 blocks in the EffectInstance loader).
// InSize is auto-fed by PostPass; GameTime is fed by ScreenEffectManager every
// frame with the modern global's semantics (day fraction, wraps per 24000-tick
// day) -- the legacy auto-fed "Time" wraps every second and is NOT used.
uniform vec2 InSize;
uniform float GameTime;

// Standardized per-effect config; values are packed per id into the
// shaders/post chain JSON by tools/gen_post_effects.py.
// ParamsA = [Speed, Strength, Scale, Aux]; ParamsB = [Phase, Drift, TintMix, LumaFloor].
uniform vec4 Primary;
uniform vec4 Secondary;
uniform vec4 ParamsA;
uniform vec4 ParamsB;

out vec4 fragColor;

float luma(vec3 c) {
    return dot(c, vec3(0.3, 0.59, 0.11));
}

// small-multiplier hash (Hoskins 0.1031 style): stays alive in fp32 for
// inputs up to ~1e5, unlike the fract(p * 443.8975) form which collapses
// to 0 once time-derived inputs grow past a few minutes of GameTime.
float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

// Gameplay-safety: any scene-sample displacement is bounded per axis.
// Call sites pass the TOTAL displacement (all offsets summed) so the bound
// cannot be defeated by stacking two half-size offsets.
vec2 safeOffset(vec2 off) {
    return clamp(off, vec2(-0.0200), vec2(0.0200));
}

vec3 sampleAt(vec2 uv) {
    return texture(DiffuseSampler, clamp(uv, 0.0, 1.0)).rgb;
}

void main() {
    // Undisplaced scene sample: the gameplay-safety floor references this.
    vec3 base = texture(DiffuseSampler, texCoord).rgb;
    float baseLuma = luma(base);
    // InSize is driver-fed; guard it so no divide below can hit zero.
    vec2 safeInSize = max(InSize, vec2(1.0));
    vec2 centered = texCoord - vec2(0.5);
    vec2 aspectCentered = centered * vec2(safeInSize.x / safeInSize.y, 1.0);
    float centerDist = length(aspectCentered);
    // GameTime wraps once per day cycle (24000 ticks); scale to roughly seconds.
    float anim = GameTime * 1200.0 * ParamsA.x + ParamsB.x * 61.8;
    float surge = 0.5 + 0.5 * sin(anim * 0.4517 + ParamsB.x * 3.1416);
    float animAmp = 0.7 + 0.3 * surge * surge * surge;
    float strength = ParamsA.y * animAmp;

    float glitchK = min(ParamsA.y, 1.0);
    float flashK = 1.0 - baseLuma;
    // Scanband tears: a few rows shear sideways each glitch frame.
    // The frame counter wraps at 1024 so the hash input stays small enough
    // for fp32 (an unbounded counter would freeze the glitch within minutes).
    float frame = mod(floor(anim * 7.3468), 1024.0);
    float band = floor(texCoord.y * 19.7104);
    float tearRoll = hash11(band * 7.31 + frame * 13.7);
    float tear = (tearRoll > 0.85 ? (tearRoll - 0.85) / 0.15 - 0.5 : 0.0) * 0.0617 * glitchK * animAmp;
    vec2 baseOff = vec2(tear, 0.0);
    float split = (0.004 + abs(tear) * 0.5) * glitchK;
    float red = sampleAt(texCoord + safeOffset(baseOff + vec2(split, 0.0))).r;
    float green = sampleAt(texCoord + safeOffset(baseOff)).g;
    float blue = sampleAt(texCoord + safeOffset(baseOff - vec2(split, 0.0))).b;
    vec3 torn = vec3(red, green, blue);
    float flash = abs(tear) > 0.0001 ? ParamsB.z * flashK : 0.0;
    vec3 outColor = mix(torn, torn * Primary.rgb, flash);

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1431);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.1300), 0.0, 1.5);

    // Gameplay-safety floor: never crush the world below ParamsB.w (~0.35x),
    // and always output an opaque frame.
    outColor = max(outColor, base * ParamsB.w);
    // Keep-alive: every uniform the post chain JSON sets MUST stay linker-active
    // in every family/variant/motion combination -- the legacy PostPass THROWS
    // (ChainedJsonException "Uniform 'X' does not exist") on a chain uniform the
    // GL linker dead-code-eliminated, and which uniforms survive elimination
    // varies per composition (e.g. a steady-motion ripple never reads Secondary).
    // The term is <= ~1e-23 (far below 8-bit output precision, alpha stays 1.0)
    // but not constant-foldable, so no config uniform can ever drop out.
    float uniformKeepAlive = 1e-27 * (Primary.w + Secondary.w + ParamsA.w + ParamsB.w + GameTime + InSize.x);
    fragColor = vec4(outColor, 1.0 + uniformKeepAlive);
}
