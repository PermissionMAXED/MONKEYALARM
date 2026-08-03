#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 461. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:radialblur:pulsezoom:drift:sparkle]

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
    float anim = animRaw + 1.6057 * sin(animRaw * 0.1511) * ParamsB.y;
    float animAmp = 1.0;
    float strength = ParamsA.y * animAmp;

    // 10-tap zoom streak whose reach surges on GameTime.
    float surgeK = 0.5847 + 0.3472 * sin(anim * 1.2523 + ParamsB.x * 6.2831);
    float blur = 0.0330 * ParamsA.y * animAmp * surgeK * smoothstep(0.05, 0.7, centerDist);
    vec3 accum = vec3(0.0);
    for (int i = 0; i < 10; i++) {
        float t = float(i) / 9.0000;
        accum += sampleAt(texCoord + safeOffset(-centered * blur * t));
    }
    vec3 streaked = accum / 10.0000;
    vec3 outColor = mix(streaked, streaked * Primary.rgb, smoothstep(0.4, 0.8, centerDist) * ParamsB.z);

    // Overlay: sparse twinkling motes. Photosensitivity: the twinkle
    // sine runs on an INDEPENDENT unit-rate clock (GameTime only, never
    // the paramA-scaled anim, which reaches ~3-5 Hz at these ids); the
    // baked per-id rate keeps every flash cycle under 2.4 Hz.
    vec2 oCell = floor(texCoord * safeInSize / 13.2923);
    float oTw = hash21(oCell + vec2(37.0, 91.0));
    float oClock = GameTime * 1200.0 + ParamsB.x * 61.8;
    float oTwinkle = smoothstep(0.8507, 1.0, sin(oClock * 14.2359 + oTw * 6.2831) * 0.5 + 0.5) * step(0.9756, oTw);
    outColor += Secondary.rgb * oTwinkle * 0.3139;

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1467);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.0861), 0.0, 1.5);

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
