#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D ssrBuffer;
uniform sampler2D drBuffer;
uniform sampler2D gSpecular;
uniform sampler2D sceneDepth;
uniform sampler2D gNormal;
uniform sampler2D BRDFLut;


uniform mat4x4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;

uniform vec3 viewPos;
vec3 WorldPosFromDepth(){
    float z = texture(sceneDepth, TexCoords).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(TexCoords.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;

    vec4 worldSpacePosition = inverseViewMatrix * viewSpacePosition;

    return worldSpacePosition.xyz;
}


void main()
{   
	vec3 FragPos = WorldPosFromDepth();
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 viewDir  = normalize(viewPos - FragPos);
    vec3 Specular = texture(gSpecular, TexCoords).rgb;
    float roughness=texture(gNormal, TexCoords).a;
    float NdotV=max(dot(normalize(Normal),normalize(viewDir)),1e-9);
    vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;

    vec4 ssr = texture(ssrBuffer, TexCoords);
    //ssr.xyz=ssr.xyz*(Specular*FG.x+FG.yyy);
    vec4 dr=texture(drBuffer,TexCoords);
    //color=clamp(ssr+dr,0.0f,1.0f);
    color.xyz = ssr.xyz + dr.xyz;
    color.a=1;
}