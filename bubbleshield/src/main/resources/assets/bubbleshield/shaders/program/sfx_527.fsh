#version 150

// GENERATED FILE -- do not edit by hand. Emitted by tools/gen_screen_shaders.py
// for effect 527. Edit the generator and regenerate instead
// (byte-stable, fixed seed).
// [screen:thermal:hotspots:drift:none]

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
    float anim = animRaw + 2.4195 * sin(animRaw * 0.1557) * ParamsB.y;
    float animAmp = 1.0;
    float strength = ParamsA.y * animAmp;

    // Drifting hotspot field biases the reading before the ramp.
    float blob = vnoise(texCoord * 5.0683 + vec2(anim * 0.0669, anim * 0.0403));
    // A second, tighter octave makes distinct wandering hot blobs.
    float blobB = vnoise(texCoord * 9.6214 - vec2(anim * 0.0341, anim * 0.0856));
    float thermalMix = clamp(strength, 0.0, 0.85);
    float heat = clamp(baseLuma + (blob * 0.6 + blobB * 0.4 - 0.5) * 0.3166 * min(strength, 1.0), 0.0, 1.0);
    // False-color ramp: cold Secondary depths through the palette to a
    // capped hot peak (never pure white -- legibility ceiling).
    vec3 coldTone = Secondary.rgb * 0.2014;
    vec3 ramped = mix(coldTone, Secondary.rgb, smoothstep(0.0, 0.4364, heat));
    ramped = mix(ramped, Primary.rgb, smoothstep(0.4111, 0.7541, heat));
    ramped = mix(ramped, vec3(0.8009), smoothstep(0.8485, 1.0, heat));
    // Luma band: keep a fixed share of the real scene, ceiling the read
    // hue-preservingly at 0.75 luma and floor it at 0.05 per channel so
    // no palette/variant can white-out or black-out the screen.
    vec3 toned = mix(base, ramped, thermalMix);
    float tonedLuma = luma(toned);
    toned *= min(tonedLuma, 0.75) / max(tonedLuma, 0.001);
    vec3 outColor = max(toned, vec3(0.05));

    // Richness pass (v3): a bounded soft-contrast curve plus a vibrance
    // lift deepen the effect's read (anti-washout). Both are bounded and
    // hue-preserving, and the luma floor below still guarantees the world
    // stays readable.
    vec3 curved = clamp(outColor, 0.0, 1.0);
    outColor = mix(outColor, curved * curved * (3.0 - 2.0 * curved), 0.1852);
    outColor = clamp(mix(vec3(luma(outColor)), outColor, 1.0620), 0.0, 1.5);

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
