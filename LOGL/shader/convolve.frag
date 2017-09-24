#version 450 core

out vec4 FragColor;

uniform sampler2D LastMip;
uniform vec2 LastMipSize;
uniform float lod;

in vec2 TexCoords;

vec2 offsets[7]=vec2[](
vec2(-3, -3),
vec2(-2, -2),
vec2(-1, -1),
vec2(0, 0),
vec2(1, 1),
vec2(2, 2),
vec2(3, 3)
    );
float weights[7] = float[](0.001f, 0.028f, 0.233f, 0.474f, 0.233f, 0.028f, 0.001f);



void main()
{
    //float2 uv = i.uv;

    int NumSamples = 7;

    vec3 result = vec3(0.0);
    for(int i = 0; i < NumSamples; i++)
    {
      vec2 offset = offsets[i]/LastMipSize;

      vec3 sampleColor = texture(LastMip, TexCoords + offset).rgb;
      //sampleColor.rgb /= 1 + Luminance(sampleColor.rgb);

      result += sampleColor * weights[i];
    }
    //result.rgb /= 1 - Luminance(result.rgb);

    FragColor = vec4(result,1.0f);
}