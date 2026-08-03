#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 582. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:underwater:shallows:surge:sparkle]

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
    float surge = 0.5 + 0.5 * sin(anim * 0.5763 + ParamsB.x * 3.1416);
    float animAmp = 0.7 + 0.3 * surge * surge * surge;
    float strength = ParamsA.y * animAmp;

    // Caustic field (slow vnoise drift) modulates the sway amplitude.
    float caustic = vnoise(texCoord * 6.2601 + vec2(anim * 0.1525, anim * 0.0587));
    vec2 sway = vec2(
        sin(texCoord.y * 51.2752 + anim * 1.2567),
        cos(texCoord.x * 37.1511 - anim * 1.2639)
    ) * 0.0060 * min(strength, 1.0) * animAmp * (0.35 + 0.65 * caustic);
    vec3 scene = sampleAt(texCoord + safeOffset(sway));
    // Light shafts: soft diagonal bands, brightest near the surface (top).
    vec2 shaftDir = vec2(-0.3825, 0.9239);
    float shaftBand = pow(0.5 + 0.5 * sin(dot(texCoord, shaftDir) * 14.1522 + anim * 0.3798), 3.8814);
    float shaft = shaftBand * smoothstep(0.2059, 0.8691, texCoord.y) * (0.4 + 0.6 * caustic);
    // Depth grade: the scene sinks toward the palette with screen depth.
    float depthMix = invsmooth(0.1331, 0.9452, texCoord.y);
    vec3 deepTone = scene * mix(Primary.rgb, Secondary.rgb, depthMix);
    vec3 graded = mix(scene, deepTone, 0.3918 * clamp(strength, 0.0, 1.0));
    vec3 outColor = graded + Primary.rgb * shaft * 0.2100 * min(strength, 1.0);

    // Overlay: sparse twinkling motes. Photosensitivity: the twinkle
    // sine runs on an INDEPENDENT unit-rate clock (GameTime only, never
    // the paramA-scaled anim, which reaches ~3-5 Hz at these ids); the
    // baked per-id rate keeps every flash cycle under 2.4 Hz.
    vec2 oCell = floor(texCoord * safeInSize / 12.9888);
    float oTw = hash21(oCell + vec2(37.0, 91.0));
    float oClock = GameTime * 1200.0 + ParamsB.x * 61.8;
    float oTwinkle = smoothstep(0.8759, 1.0, sin(oClock * 10.1587 + oTw * 6.2831) * 0.5 + 0.5) * step(0.9752, oTw);
    outColor += Secondary.rgb * oTwinkle * 0.3411;

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1017);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.0737), 0.0, 1.5);

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
