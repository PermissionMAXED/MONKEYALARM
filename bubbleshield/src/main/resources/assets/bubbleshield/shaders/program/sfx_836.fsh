#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 836. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:sketch:crosshatch:steady:none]

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

// Gameplay-safety: any scene-sample displacement is bounded per axis.
// Call sites pass the TOTAL displacement (all offsets summed) so the bound
// cannot be defeated by stacking two half-size offsets.
vec2 safeOffset(vec2 off) {
    return clamp(off, vec2(-0.0200), vec2(0.0200));
}

float lumaAt(vec2 uv) {
    return dot(texture(DiffuseSampler, clamp(uv, 0.0, 1.0)).rgb, vec3(0.3, 0.59, 0.11));
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
    float animAmp = 1.0;
    float strength = ParamsA.y * animAmp;

    // 4-tap cross-difference Sobel over scene luma.
    vec2 texel = 1.1046 / safeInSize;
    float gl = lumaAt(texCoord + safeOffset(vec2(-texel.x, 0.0)));
    float gr = lumaAt(texCoord + safeOffset(vec2(texel.x, 0.0)));
    float gu = lumaAt(texCoord + safeOffset(vec2(0.0, -texel.y)));
    float gd = lumaAt(texCoord + safeOffset(vec2(0.0, texel.y)));
    float edge = clamp(length(vec2(gr - gl, gd - gu)) * 3.6225, 0.0, 1.0);
    // Paper base: contrast-flattened luma with a palette paper tint.
    float flatTone = 0.5575 + 0.3051 * baseLuma;
    vec3 paper = vec3(flatTone) * mix(vec3(1.0), Secondary.rgb, ParamsB.z);
    // Shadow crosshatch: two static gratings bite where the scene is dark.
    float h1 = 0.5 + 0.5 * sin((texCoord.x * 0.5688 + texCoord.y * 0.8225) * 394.8633);
    float h2 = 0.5 + 0.5 * sin((texCoord.x * -0.8225 + texCoord.y * 0.5688) * 386.0189);
    float shadowMask = smoothstep(0.3029, 0.8932, 1.0 - baseLuma);
    float hatch = clamp(smoothstep(0.6, 1.0, h1) + smoothstep(0.65, 1.0, h2), 0.0, 1.0) * shadowMask;
    vec3 inked = mix(paper, Primary.rgb * 0.1489, clamp(edge + hatch * 0.6605, 0.0, 1.0));
    vec3 outColor = mix(base, inked, clamp(strength, 0.0, 1.0));

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1782);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.1035), 0.0, 1.5);

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
