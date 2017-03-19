#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D ssrBuffer;
uniform sampler2D drBuffer;

void main()
{             

    vec4 ssr = texture(ssrBuffer, TexCoords);
    vec4 dr=texture(drBuffer,TexCoords);
    color=clamp(ssr+dr,0.0f,1.0f);
}