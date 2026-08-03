#version 150

#moj_import <fog.glsl>

in vec3 Position;
in vec2 UV0;
in vec4 Color;

uniform mat4 ModelViewMat;
uniform mat4 ProjMat;

out vec2 texCoord0;
out vec4 vertexColor;
// Both vanilla fog metrics are precomputed here (fog_distance shape 0 =
// spherical, 1 = cylindrical); the fragment shaders pick by the FogShape
// uniform AND reuse sphericalVertexDistance for the fwidth() rim estimator.
out float sphericalVertexDistance;
out float cylindricalVertexDistance;
// Camera-relative world-space position (Position is already pose-transformed
// CPU-side, with the pose translated by shieldCenter - cameraPos; the view
// ROTATION lives in ModelViewMat): the camera sits at the origin of this
// space, so a fragment's view direction is -normalize(worldPos) and its
// camera distance is length(worldPos). Consumed by the fx volumetric layers;
// harmlessly unused by the beam shaders.
out vec3 worldPos;

void main() {
    gl_Position = ProjMat * ModelViewMat * vec4(Position, 1.0);

    texCoord0 = UV0;
    vertexColor = Color;
    sphericalVertexDistance = fog_distance(Position, 0);
    cylindricalVertexDistance = fog_distance(Position, 1);
    worldPos = Position;
}
