#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D linearBuffer;
uniform sampler2D sceneDepth;

layout(std430, binding = 1) buffer HdrSSBO
{
    bool hdr;
    bool temporal;
    float exposure;
    float screenWidth;
    float screenHeight;
    float TAAscale;
    float TAAresponse;
}hdrSSBO;


const float A=0.15;
const float B=0.50;
const float C=0.10;
const float D=0.20;
const float E=0.02;
const float F=0.30;
const float W=11.2;


vec3 FilmicToneMapping(vec3 x){
	return ((x*(A*x+C*B)+D*E)/(x*(A*x+B)+D*F))-E/F;
}

vec3 ACESToneMapping(vec3 color, float adapted_lum)
{
    float A = 2.51f;
    float B = 0.03f;
    float C = 2.43f;
    float D = 0.59f;
    float E = 0.14f;
    color *= adapted_lum;
    return (color * (A * color + B)) / (color * (C * color + D) + E);
}

void main()
{             
    const float gamma = 2.2f;
	vec3 hdrColor=texture(linearBuffer, TexCoords).rgb;
	hdrColor*=hdrSSBO.exposure;
	float exBias=2.0f;
	//vec3 curr=FilmicToneMapping(exBias*hdrColor);
	//vec3 whiteScale=1.0f/FilmicToneMapping(vec3(W));
	//curr*=whiteScale;
    vec3 curr=ACESToneMapping(hdrColor, 0.35f);

    // exposure
    //vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
    // also gamma correct while we're at it       
    //result = pow(result, vec3(1.0f / gamma));
    //color = hdr?vec4(result, 1.0f):vec4(hdrColor,1.0f);
    color= vec4(curr, 1.0f);
    //color= hdrSSBO.hdr ? vec4(curr,1.0f) : vec4(hdrColor, 1.0f);

    //color=previous;
    //color.xyz/=1-Luminance(color.xyz);
}