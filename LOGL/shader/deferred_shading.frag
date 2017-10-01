#version 430
out vec4 FragColor;
in vec2 TexCoords;

uniform sampler2D gSpecular;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;
uniform sampler2D shadowMap;
uniform sampler2D sceneDepth;
uniform sampler2D prevFrame1;
uniform sampler2D blueNoise;
uniform sampler2D BRDFLut;
uniform bool flagShadowMap;
uniform float extRand1;
uniform float resolve;
uniform float binaryIteration;
uniform float inputStride;


//uniform float tempRoughness;


struct Light {
    vec3 Position;
    vec3 Color;
    
    float Linear;
    float Quadratic;
};
const int NR_LIGHTS = 32;

uniform float haltonNum[100];
uniform Light lights[NR_LIGHTS];
uniform vec3 viewPos;
uniform vec3 lightPos;
uniform mat4 LightSpaceMatrix;
uniform mat4x4 _ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;
uniform mat4x4 inverseProjectionMatrix;

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


vec4 ImportanceSampleGGX(vec2 Xi, float Roughness)
{
    float m = Roughness * Roughness;
    float m2 = m * m;
    //Xi=normalize(Xi);
    float Phi = 2 * PI * Xi.x;
                 
    float CosTheta = sqrt((1.0 - Xi.y) / (1.0 + (m2 - 1.0) * Xi.y));
    float SinTheta = sqrt(max(1e-5, 1.0 - CosTheta * CosTheta));
                 
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;
        
    float d = (CosTheta * m2 - CosTheta) * CosTheta + 1;
    float D = m2 / (PI * d * d);
    float pdf = D * CosTheta;

    return vec4(H, pdf); 
}


vec3 EnvDFGPolynomial(vec3 specularColor, float gloss, float ndotv)
{
    float x = gloss;
    float y = ndotv;
 
    float b1 = -0.1688;
    float b2 = 1.895;
    float b3 = 0.9903;
    float b4 = -4.853;
    float b5 = 8.404;
    float b6 = -5.069;
    float bias = clamp(( min( b1 * x + b2 * x * x, b3 + b4 * y + b5 * y * y + b6 * y * y * y ) ),1e-8,1.0);
 
    float d0 = 0.6045;
    float d1 = 1.699;
    float d2 = -0.5228;
    float d3 = -3.603;
    float d4 = 1.404;
    float d5 = 0.1939;
    float d6 = 2.661;
    float delta = clamp(( d0 + d1 * x + d2 * y + d3 * x * x + d4 * x * y + d5 * y * y + d6 * x * x * x ),1e-8,1.0);
    float scale = delta - bias;
 
    bias *= clamp(( 50.0 * specularColor.y ),1e-8,1.0);
    return specularColor * scale + bias;
}



vec3 SsrBRDF(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, vec3 specStrength,out float PDF,out float IL)
{
        lightDir=normalize(lightDir);
        viewDir=normalize(viewDir);
        normal=normalize(normal);

        vec3 norm=normal;
        float inf=1e-10;
        float diff=max(dot(norm,lightDir),0.0);
        vec3 halfVector=normalize(lightDir+viewDir);
        float NdotL=clamp(dot(norm,lightDir),inf,1.0);
        float NdotV=clamp(dot(norm,viewDir),inf,1.0);
        float NdotH=clamp(dot(norm,halfVector),inf,1.0);
        float LdotH=clamp(dot(lightDir,halfVector),inf,1.0);
        float VdotH=clamp(dot(viewDir,halfVector),inf,1.0);
        //float roughness=(255.0f-texture(material.texture_diffuse1,TexCoords).x)/800.0f;
        //float roughness=256.0f-texture(material.texture_diffuse1,TexCoords).x;
        //float roughness=1.2f-texture(material.texture_roughness1,TexCoords).r;
    
        float alpha = roughness*roughness;

        float alphaSqr = alpha*alpha;
        float denom = NdotH * NdotH *(alphaSqr-1.0) + 1.0f;
        float D = alphaSqr/(PI * denom * denom);
        float specular=D;

        
        vec3 F0=specStrength;
        vec3 F = F0 + (1.0f-F0)*pow(1.0f-LdotH,5);



// Caution : the " NdotL *" and " NdotV *" are explicitely inversed , this is not a mistake .
        float Lambda_GGXV = NdotL*sqrt((-NdotV*alpha+NdotV)*NdotV+alpha);
        float Lambda_GGXL = NdotV*sqrt((-NdotL*alpha+NdotL)*NdotL+alpha);



        float pdfD=alphaSqr/(PI*denom * denom);
        PDF=pdfD*NdotH/(4*VdotH);
        IL=NdotL;
        return D*F*Lambda_GGXV*Lambda_GGXL/(4*NdotV);
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

float ShadowCalculation(vec4 fragPosLightSpace,vec3 FragPos,vec3 Normal)
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
}


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




void main()
{             

    // ALL IN WORLD SPACE!!!
    //float rand1=rand(TexCoords+vec2(frameIndex/200.0f));
    //float rand2=rand(TexCoords+vec2(0.03f+frameIndex/200.0f));
    ProjectionMatrix=_ProjectionMatrix;
    //ProjectionMatrix[2][0]=haltonNum[int(rand1*99)%99]*2;
    //ProjectionMatrix[2][1]=haltonNum[int(rand2*99)%99]*2;

    vec3 FragPos = WorldPosFromDepth();
    vec3 vsFragPos = ViewPosFromDepth();
    vec3 vsNormal = (ViewMatrix * vec4(texture(gNormal, TexCoords).rgb, 0)).xyz;
    float Gloss=texture(gNormal, TexCoords).a;
    //tempRoughness=Gloss;
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    //Diffuse=vec3(1,0,0);
    vec3 Specular = texture(gSpecular, TexCoords).rgb;
    vec4 fragPosLightSpace=LightSpaceMatrix*vec4(FragPos, 1.0f);
    vec3 lighting = vec3(0.0f);
    vec3 vsViewDir  = normalize((ViewMatrix * vec4(viewPos, 1.0f)).xyz - (ViewMatrix * vec4(FragPos, 1.0f)).xyz);
    float shadow=0.0f;
    if(flagShadowMap)
        shadow = ShadowCalculation(fragPosLightSpace, vsFragPos,vsNormal);                      
    shadow = min(shadow, 0.75); // reduce shadow strength a little: allow some diffuse/specular light in shadowed regions
    //lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;
    vec3 specular;
    vec3 diffuse;
    vec3 BRDF;
    for(int i = 0; i < NR_LIGHTS-14; ++i)
    {

        vec3 vsLightDir = normalize((ViewMatrix * vec4(lights[i].Position, 1)).xyz - vsFragPos);
        diffuse = max(dot(vsNormal, vsLightDir), 0.0) * Diffuse * lights[i].Color;
        BRDF=PhysicalBRDF(vsLightDir,vsViewDir, vsNormal, Gloss, Specular);
        specular = lights[i].Color * BRDF;
        float distance = length(lights[i].Position - FragPos);
        float attenuation = 1.0 / (1.0 + distance*4);
        diffuse *= attenuation;
        //specular *= attenuation;
        lighting += diffuse + specular;
    }    
    FragColor = vec4((1.0f-shadow)*lighting, 1.0f);
    //if(Gloss<0.4f)
        //FragColor=SSR(FragPos,Normal, viewDir);
    if(Diffuse.x>=1.0f) FragColor=vec4(3,3,3,1);
}

