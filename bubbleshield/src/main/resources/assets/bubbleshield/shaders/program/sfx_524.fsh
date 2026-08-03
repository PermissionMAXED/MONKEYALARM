#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 524. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:spectral:triple:drift:grain]

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

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
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
    float animRaw = GameTime * 1200.0 * ParamsA.x + ParamsB.x * 61.8;
    float anim = animRaw + 1.7188 * sin(animRaw * 0.1027) * ParamsB.y;
    float animAmp = 1.0;
    float strength = ParamsA.y * animAmp;

    // Three ghosts at 120-degree spokes, each fainter and further out.
    float echoK = clamp(strength, 0.0, 1.0);
    float spokeAng = 1.0377;
    float ghostR = 0.0098 * animAmp;
    vec3 g1 = sampleAt(texCoord + safeOffset(vec2(cos(spokeAng), sin(spokeAng)) * ghostR));
    vec3 g2 = sampleAt(texCoord + safeOffset(vec2(cos(spokeAng + 2.0944), sin(spokeAng + 2.0944)) * ghostR * 1.6589));
    vec3 g3 = sampleAt(texCoord + safeOffset(vec2(cos(spokeAng + 4.1888), sin(spokeAng + 4.1888)) * ghostR * 2.1860));
    float w1 = 0.2800 * echoK;
    float w2 = 0.1531 * echoK;
    float w3 = 0.0978 * echoK;
    vec3 haunted = base * (1.0 - w1 - w2 - w3) + g1 * w1 + g2 * w2 + g3 * w3;
    // Desaturation drift: a slow spirit-world pallor swings on GameTime.
    float pallor = 0.2727 + 0.1262 * sin(anim * 0.2644 + ParamsB.x * 6.2831);
    vec3 pale = mix(haunted, vec3(luma(haunted)), clamp(pallor * strength, 0.0, 0.8));
    vec3 outColor = mix(pale, pale * Primary.rgb, ParamsB.z);

    // Overlay: living film grain. Photosensitivity: the refresh ticks on
    // an INDEPENDENT unit-rate clock (GameTime only, never the
    // paramA-scaled anim, which would hard-refresh at up to ~100 Hz
    // here); the baked per-id rate keeps every reroll under 2.5 Hz.
    // The frame counter wraps at 256 so the hash input stays
    // fp32-friendly across the whole GameTime day.
    float grainClock = GameTime * 1200.0 + ParamsB.x * 61.8;
    float grainFrame = mod(floor(grainClock * 1.5218), 256.0);
    outColor += (hash21(floor(texCoord * safeInSize) + vec2(grainFrame, 0.0)) - 0.5) * 0.0351;

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.2147);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.2185), 0.0, 1.5);

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
