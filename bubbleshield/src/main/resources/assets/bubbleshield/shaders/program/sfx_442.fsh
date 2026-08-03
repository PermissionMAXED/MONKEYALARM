#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 442. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:underwater:surgewash:pulse:pulseglow]

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

// 1 - smoothstep with ASCENDING edges. Replaces every reversed-edge
// smoothstep(hi, lo, x) call: edge0 >= edge1 is undefined by the GLSL
// spec; this form is numerically identical on conforming drivers.
float invsmooth(float lo, float hi, float x) {
    return 1.0 - smoothstep(lo, hi, x);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
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
    float animAmp = 0.8 + 0.2 * sin(anim * 0.9294 + ParamsB.x * 6.2831);
    float strength = ParamsA.y * animAmp;

    // A slow swell breathes through the sway and the grade together.
    float swell = 0.5 + 0.5 * sin(anim * 0.1842 + ParamsB.x * 6.2831);
    // Caustic field (slow vnoise drift) modulates the sway amplitude.
    float caustic = vnoise(texCoord * 7.4175 + vec2(anim * 0.1451, anim * 0.0791));
    vec2 sway = vec2(
        sin(texCoord.y * 55.8284 + anim * 1.3350),
        cos(texCoord.x * 39.6504 - anim * 1.2857)
    ) * 0.0061 * min(strength, 1.0) * animAmp * (0.35 + 0.65 * caustic) * (0.7 + 0.3 * swell);
    vec3 scene = sampleAt(texCoord + safeOffset(sway));
    // Light shafts: soft diagonal bands, brightest near the surface (top).
    vec2 shaftDir = vec2(-0.7183, 0.6957);
    float shaftBand = pow(0.5 + 0.5 * sin(dot(texCoord, shaftDir) * 13.6875 + anim * 0.3646), 4.9906);
    float shaft = shaftBand * smoothstep(0.1804, 0.8097, texCoord.y) * (0.4 + 0.6 * caustic);
    // Depth grade: the scene sinks toward the palette with screen depth.
    float depthMix = invsmooth(0.1524, 0.8596, texCoord.y);
    vec3 deepTone = scene * mix(Primary.rgb, Secondary.rgb, depthMix);
    vec3 graded = mix(scene, deepTone, (0.3670 + 0.1904 * swell) * clamp(strength, 0.0, 1.0));
    vec3 outColor = graded + Primary.rgb * shaft * 0.1628 * min(strength, 1.0);

    // Overlay: a faint breathing glow of the effect color at the rim.
    float oBreath = 0.5 + 0.5 * sin(anim * 0.8745 + ParamsB.x * 6.2831);
    float oRim = smoothstep(0.4114, 1.0, centerDist);
    outColor += Primary.rgb * oRim * oBreath * 0.1527;

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1218);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.1967), 0.0, 1.5);

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
