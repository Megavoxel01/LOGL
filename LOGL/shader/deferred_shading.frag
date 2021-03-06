#version 450
out vec4 FragColor;
in vec2 TexCoords;

uniform sampler2D gSpecular;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;
uniform sampler2DArray shadowMap;
uniform sampler2D sceneDepth;
uniform sampler2D prevFrame1;
uniform sampler2D blueNoise;
uniform sampler2D BRDFLut;
uniform samplerCube irradianceMap;
uniform sampler2D ssaoColor;
uniform bool flagShadowMap;
uniform float extRand1;
uniform float resolve;
uniform float binaryIteration;
uniform float inputStride;
uniform int numberOfTilesX;
uniform mat4 textureMatrixList[3];
uniform vec4 farbounds;


//uniform float tempRoughness;


struct Light {
    vec4 Position;
    vec4 Color;
};

struct VisibleIndex {
    int index;
};

const int NR_LIGHTS = 10;

layout(std430, binding = 2) readonly buffer LightBuffer {
    Light lights[];
};

layout(std430, binding = 3) readonly buffer VisibleLightIndicesBuffer {
    VisibleIndex visibleLightIndicesBuffer[];
};

uniform float haltonNum[100];
//uniform Light lights[NR_LIGHTS];
uniform vec3 viewPos;
uniform vec3 lightPos;
uniform mat4 LightSpaceMatrix;
uniform mat4x4 _ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;
uniform mat4x4 inverseProjectionMatrix;


uniform vec3 directionLightDir;
uniform vec4 directionLightColor;

uniform float frameIndex;



uniform float screenWidth;
uniform float screenHeight;
//float screenWidth=1900;
//float screenHeight=1000;
float near=0.01f;
float far=100.0f;
mat4x4 ProjectionMatrix;
vec4 reflectionV;
#define PI 3.1415926535f

vec2 offset[4]=vec2[](
vec2(0, 0),
vec2(1, -1),
vec2(-1, -1),
vec2(0, 1)
    );






float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

float rand_map(vec2 co)
{
    return (rand(co)-0.5f)*2;
}

float LinearizeDepth(float depth)
{
    float z=depth*2.0-1.0;
    return (2.0*near)/(far+near-z*(far-near));
}

vec3 WorldPosFromDepth(){
    float z = texture(sceneDepth, TexCoords).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(TexCoords.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;

    vec4 worldSpacePosition = inverseViewMatrix * viewSpacePosition;

    return worldSpacePosition.xyz;
}

vec3 ViewPosFromDepth(){
    float z = texture(sceneDepth, TexCoords).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(TexCoords.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;
    return viewSpacePosition.xyz;
}



float Luminance(vec3 rgb)
{
    float r=rgb.r;
    float g=rgb.g;
    float b=rgb.b;
    return sqrt(0.299*r*r + 0.587*g*g + 0.114*b*b);
}



vec4 TangentToWorld(vec3 N, vec4 H)
{
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 T = normalize( cross( UpVector, N ) );
    vec3 B = cross( N, T );
                 
    return vec4((T * H.x) + (B * H.y) + (N * H.z), H.w);
}

vec3 AoMultiBounce(float ao, vec3 albedo)
{
    vec3 x = vec3(ao);

    vec3 a = 2.0404 * albedo - vec3(0.3324);
    vec3 b = -4.7951 * albedo + vec3(0.6417);
    vec3 c = 2.7552 * albedo + vec3(0.6903);

    return max(x, ((x * a + b) * x + c) * x);
}

vec3 SchlickFresnel(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, vec3 specStrength)
{

        vec3 norm=normal;
        float diff=max(dot(norm,lightDir),0.0);
        vec3 halfVector=normalize(lightDir+viewDir);
        float NdotL=clamp(dot(norm,lightDir),0.0,1.0);
        float NdotV=clamp(dot(norm,viewDir),0.0,1.0);
        float NdotH=clamp(dot(norm,halfVector),0.0,1.0);
        float LdotH=clamp(dot(lightDir,halfVector),0.0,1.0);

        vec3 F0=specStrength;
        return F0 + (vec3(1.0f)-F0)*pow(1.0f-LdotH,5);
}


vec3 PhysicalBRDF(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, vec3 specStrength)
{

        vec3 norm=normal;
        float diff=max(dot(norm,lightDir),0.0);
        vec3 halfVector=normalize(lightDir+viewDir);
        float NdotL=clamp(dot(norm,lightDir),0.0,1.0);
        float NdotV=clamp(dot(norm,viewDir),0.0,1.0);
        float NdotH=clamp(dot(norm,halfVector),0.0,1.0);
        float LdotH=clamp(dot(lightDir,halfVector),0.0,1.0);
    
        float alpha = roughness*roughness;

        float alphaSqr = alpha*alpha;
        float pi = 3.14159f;
        float denom = NdotH * NdotH *(alphaSqr-1.0) + 1.0f;
        float D = alphaSqr/(pi * denom * denom);
        float specular=D;

        vec3 F0=specStrength;
        vec3 F = F0 + (vec3(1.0f)-F0)*pow(1.0f-LdotH,5);

        float Lambda_GGXV = NdotL*sqrt((-NdotV*alpha+NdotV)*NdotV+alpha);
        float Lambda_GGXL = NdotV*sqrt((-NdotL*alpha+NdotL)*NdotL+alpha);
        return specular*F*Lambda_GGXV*Lambda_GGXL;
}

/*float ShadowCalculation(vec4 fragPosLightSpace,vec3 FragPos,vec3 Normal)
{

    vec3 projCoords = fragPosLightSpace.xyz / fragPosLightSpace.w;
    projCoords = projCoords * 0.5 + 0.5;
    float closestDepth = texture(shadowMap, projCoords.xy).r; 
    float currentDepth = projCoords.z;    // bias
    vec3 normal = normalize(Normal);
    vec3 lightDir = normalize(lightPos - FragPos);
    float bias = max(0.05 * (1.0 - dot(normal, lightDir)), 0.003);
    //bias=0;
    // Check whether current frag pos is in shadow
    // float shadow = currentDepth - bias > closestDepth  ? 1.0 : 0.0;
    // PCF
    float shadow = 0.0;
    vec2 texelSize = 1.0 / textureSize(shadowMap, 0);
    for(int x = -1; x <= 1; ++x)
    {
        for(int y = -1; y <= 1; ++y)
        {
            float pcfDepth = texture(shadowMap, projCoords.xy + vec2(x, y) * texelSize).r; 
            shadow += currentDepth - bias > pcfDepth  ? 1.0 : 0.0;        
        }    
    }
    shadow /= 9.0;
    
    // Keep the shadow at 0.0 when outside the far_plane region of the light's frustum.
    if(projCoords.z > 1.0)
        shadow = 0.0;
    //float shadow = currentDepth-bias > closestDepth  ? 1.0 : 0.0;
    
    return shadow;
}*/


// By Morgan McGuire and Michael Mara at Williams College 2014
// Released as open source under the BSD 2-Clause License
// http://opensource.org/licenses/BSD-2-Clause
#define point2 vec2
#define point3 vec3
 
 float cameraNear=near;
 float cameraFar=far;
float fetchLinearDepth (vec2 depthUV) {
    float cameraFarPlusNear = cameraFar + cameraNear;
    float cameraFarMinusNear = cameraFar - cameraNear;
    float cameraCoef = 2.0 * cameraNear;
    return cameraCoef / (cameraFarPlusNear - texture2D( sceneDepth, depthUV ).x * cameraFarMinusNear);
}
float _zThickness=10;
float _Iterations=50;
bool rayIntersectsDepthBuffer (float minZ, float maxZ, vec2 depthUV) {
    float z = fetchLinearDepth(depthUV);
    
    /*
    * Based on how far away from the camera the depth is,
    * adding a bit of extra thickness can help improve some
    * artifacts. Driving this value up too high can cause
    * artifacts of its own.
    */

    return (maxZ >= z) && (minZ - _zThickness <= z);
}

float distanceSquared(vec2 a,vec2 b) {
    a -= b;
    return dot(a, a);
}

void swapIfBigger (inout float aa, inout float bb) {
    if( aa > bb) {
        float tmp = aa;
        aa = bb;
        bb = tmp;
    }
}


bool rayIntersectsDepthBF( float zA, float zB, vec2 uv, float zThickness)
{
    //VEC4 uv4 = float4( uv, 0.0, 0.0);
    float cameraZ = -LinearizeDepth( texture(sceneDepth, uv,1).r) * far;   
    //float backZ = tex2Dlod( _BackFaceDepthTex, uv4).r * -_ProjectionParams.z;
                
    return zB <= cameraZ&&zA >= cameraZ-zThickness ;
}

bool rayIntersectsDepthBF1( float zA, float zB, vec2 uv, float zThickness)
{
    //VEC4 uv4 = float4( uv, 0.0, 0.0);
    float cameraZ = -LinearizeDepth( texture(sceneDepth, uv,1).r) * far;   
    //float backZ = tex2Dlod( _BackFaceDepthTex, uv4).r * -_ProjectionParams.z;
                
    return zB <= cameraZ && zA >= cameraZ-zThickness;
}

float getCsm(vec4 position){
  int index = 3;
  // find the appropriate depth map to look up in based on the depth of this fragment
  if(gl_FragCoord.z < farbounds.x) {
    index = 0;
  } else if(gl_FragCoord.z < farbounds.y) {
    index = 1;
  } else if(gl_FragCoord.z < farbounds.z) {
    index = 2;
  }

  // transform this fragment's position from view space to scaled light clip space
  // such that the xy coordinates are in [0;1]
  // note there is no need to divide by w for othogonal light sources
  vec4 shadow_coord = textureMatrixList[index] * position;

  shadow_coord.w = shadow_coord.z;
  
  // tell glsl in which layer to do the look up
  shadow_coord.z = float(index);
  
  // get the stored depth
  float shadow_d = texture(shadowMap, shadow_coord.xyz).x;
  
  // get the difference of the stored depth and the distance of this fragment to the light
  float diff = shadow_d - shadow_coord.w;
  
  // smoothen the result a bit, to avoid aliasing at shadow contact point
  return clamp(diff * 250.0 + 1.0, 0.0, 1.0);
}




void main()
{             

    // ALL IN WORLD SPACE!!!
    //float rand1=rand(TexCoords+vec2(frameIndex/200.0f));
    //float rand2=rand(TexCoords+vec2(0.03f+frameIndex/200.0f));
    ProjectionMatrix=_ProjectionMatrix;
    //ProjectionMatrix[2][0]=haltonNum[int(rand1*99)%99]*2;
    //ProjectionMatrix[2][1]=haltonNum[int(rand2*99)%99]*2;
    ivec2 location = ivec2(gl_FragCoord.xy);
    ivec2 tileID = location / ivec2(16, 16);
    uint index = tileID.y * numberOfTilesX + tileID.x;

    vec3 FragPos = WorldPosFromDepth();
    vec3 vsFragPos = ViewPosFromDepth();
    vec3 wsNormal = texture(gNormal, TexCoords).rgb;
    vec3 vsNormal = (ViewMatrix * vec4(wsNormal.xyz, 0)).xyz;
    float Gloss=texture(gNormal, TexCoords).a;
    //tempRoughness=Gloss;
    vec3 Albedo = texture(gAlbedoSpec, TexCoords).rgb;
    //Albedo.rgb = pow(abs(Albedo.rgb), vec3(2.2f));
    //Diffuse=vec3(1,0,0);
    vec3 Specular = texture(gSpecular, TexCoords).rgb;
    vec4 fragPosLightSpace=LightSpaceMatrix*vec4(FragPos, 1.0f);
    vec3 lighting = vec3(0.0f);
    vec3 vsViewDir  = normalize((ViewMatrix * vec4(viewPos, 1.0f)).xyz - (ViewMatrix * vec4(FragPos, 1.0f)).xyz);
    float shadow=0.0f;
    shadow = getCsm(ViewMatrix * vec4(FragPos, 1.0f));
    //lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;
    vec3 specular;
    vec3 diffuse;
    vec3 BRDF;
    uint offset = index * 1024;
    uint i=0;
    uint lightIndex = 0;
    for(i=0; i<NR_LIGHTS && visibleLightIndicesBuffer[offset + i].index != -1; i++)
    //for(int i = 0; i < NR_LIGHTS; ++i)
    {
        lightIndex = visibleLightIndicesBuffer[offset + i].index;
        Light light = lights[lightIndex];
        //Light light = lights[i];
        vec3 vsLightDir = normalize((ViewMatrix * vec4(light.Position.xyz, 1)).xyz - vsFragPos);
        diffuse = max(dot(vsNormal, vsLightDir), 0.0) * Albedo * light.Color.xyz;
        BRDF=PhysicalBRDF(vsLightDir,vsViewDir, vsNormal, Gloss, Specular);
        specular = light.Color.xyz * BRDF;
        float distance = length(light.Position.xyz - FragPos);
        float attenuation = 1.0 / (1.0 + distance*4);
        diffuse *= attenuation;
        diffuse*=vec3(1.0) - SchlickFresnel(vsLightDir,vsViewDir, vsNormal, Gloss, Specular);
        //specular *= attenuation;
        lighting += diffuse + specular;
    }
    //direction light
    vec3 vsLDir = (ViewMatrix *vec4(directionLightDir, 0)).xyz;
    diffuse = max(dot(vsNormal, vsLDir), 0.0) * Albedo * directionLightColor.xyz;
    BRDF=PhysicalBRDF(vsLDir,vsViewDir, vsNormal, Gloss, Specular);
    specular = directionLightColor.xyz * BRDF;
    diffuse*=vec3(1.0) - SchlickFresnel(vsLDir,vsViewDir, vsNormal, Gloss, Specular);
    lighting += diffuse + specular;

    vec3 irradiance = texture(irradianceMap, wsNormal).rgb;
    irradiance *=vec3(1.0) - SchlickFresnel(vsLDir,vsViewDir, vsNormal, Gloss, Specular);
    float occlusion = texture(ssaoColor, TexCoords).x;
    float aoMultiBounce = AoMultiBounce(occlusion, Albedo).x * 1.5;
    lighting += Albedo * irradiance * aoMultiBounce;



    FragColor = vec4((shadow)*lighting, 1.0f);
    
    //FragColor = vec4((vec3(i)/float(NR_LIGHTS)), 1.0f);
    //if(Gloss<0.4f)
        //FragColor=SSR(FragPos,Normal, viewDir);
    //if(Albedo.x>=1.0f) FragColor=vec4(3,3,3,1);
}

