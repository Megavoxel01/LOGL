#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D hdrBuffer;
uniform sampler2D sceneDepth;
uniform float miplevel;

void main()
{
    color=texture(hdrBuffer, TexCoords);
    vec2 size=vec2(textureSize(sceneDepth,int(miplevel)));
    //color=vec4(texelFetch(sceneDepth, ivec2(TexCoords*size), int(miplevel)).xyz,1);
    //float depth=texelFetch(sceneDepth, ivec2(TexCoords*size), int(miplevel)).x;
    //depth=(depth-0.98f)/(1.0f-0.98f);
    //color=vec4(depth,depth,depth,1);
}