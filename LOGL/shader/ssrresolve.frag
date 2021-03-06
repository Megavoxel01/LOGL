#version 450 core

out vec4 FragColor;
in vec2 TexCoords;


uniform sampler2D gSpecular;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;
uniform sampler2D sceneDepth;
uniform sampler2D currFrame;
uniform sampler2D blueNoise;
uniform sampler2D BRDFLut;
uniform sampler2D ssrHitpoint;
uniform sampler2D ssrHitpixel;
uniform samplerCube IBL;
uniform sampler2D prevSSR1;



uniform bool flagShadowMap;
uniform float extRand1;
uniform float resolve;
uniform float binaryIteration;
uniform float inputStride;
uniform float sampleBias;

//uniform float tempRoughness;
layout (std430, binding=1) buffer shader_data
{ 
    float haltonNum[200];
};
//uniform float haltonNum[200];
uniform vec3 viewPos;
uniform vec3 lightPos;
uniform mat4 LightSpaceMatrix;
uniform mat4x4 ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;

uniform float frameIndex;
uniform float screenWidth;
uniform float screenHeight;
uniform int debugTest;
uniform float rangle;
uniform bool flagEmmisive;

//float screenWidth=1900;
//float screenHeight=1000;
const float near=0.01f;
const float far=100.0f;
//vec4 reflectionV;
#define PI 3.1415926535f
#define INF 100000.0

const vec2 offset[28]=vec2[](
vec2(0, 0),
vec2(-2.0f, 2.0f),
vec2(-2.0f, 0.0f),
vec2(0, 2.0f),

vec2(1.0f, 0.0f),
vec2(2.0f, 0.0f),
vec2(1.0f, -2.0f),
vec2(2.0f, -2.0f),

vec2(0.0f, 1.0f),
vec2(-2.0f, 1.0f),
vec2(0, -1.0f),
vec2(0, 2.0f),

vec2(-2.0f, 1.0f),
vec2(-2.0f, 0.0f),
vec2(0.0f, 1.0f),
vec2(0.0f, 0),

vec2(-1.0f, 0.0f),
vec2(0.0f, 0.0f),
vec2(0.0f, -2.0f),
vec2(-1.0f, -2.0f),

vec2(1.0f, 1.0f),
vec2(2.0f, 1.0f),
vec2(1.0f, -1.0f),
vec2(2.0f, -1.0f),

vec2(-2.0f, 0.0f),
vec2(1.0f, 0.0f),
vec2(-2.0f, -3.0f),
vec2(1.0f, -3.0f)
    );


/*const vec2 offset[28]=vec2[](
vec2(0, 0),
vec2(-1.0f, 0.0f),
vec2(1.0f, 0.0f),
vec2(0, 1.0f),

vec2(0.0f, -1.0f),
vec2(1.0f, 1.0f),
vec2(1.0f, -1.0f),
vec2(-1.0f, 1.0f),

vec2(0.0f, 1.0f),
vec2(-1.0f, 1.0f),
vec2(0, -1.0f),
vec2(0, 1.0f),

vec2(-1.0f, 1.0f),
vec2(-1.0f, 0.0f),
vec2(0.0f, 1.0f),
vec2(0.0f, 0),

vec2(-1.0f, 0.0f),
vec2(0.0f, 0.0f),
vec2(0.0f, -1.0f),
vec2(-1.0f, -1.0f),

vec2(1.0f, 1.0f),
vec2(2.0f, 1.0f),
vec2(1.0f, -1.0f),
vec2(2.0f, -1.0f),

vec2(-1.0f, 0.0f),
vec2(1.0f, 0.0f),
vec2(-1.0f, -1.0f),
vec2(1.0f, -1.0f)
    );
*/
#define point2 vec2
#define point3 vec3

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

vec2 rotate(vec2 v, float a) {
    float s = sin(a);
    float c = cos(a);
    mat2 m = mat2(c, -s, s, c);
    return m * v;
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

vec3 fresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness)
{
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
} 

vec3 ViewPosFromDepth(){
    float z = texture(sceneDepth, TexCoords).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(TexCoords.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;
    return viewSpacePosition.xyz;
}

vec3 SsrBRDF(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, vec3 specStrength)
{
        lightDir=normalize(lightDir);
        viewDir=normalize(viewDir);
        normal=normalize(normal);

        vec3 norm=normal;
        float eps=1e-10;
        float diff=max(dot(norm,lightDir),0.0);
        vec3 halfVector=normalize(lightDir+viewDir);
        float NdotL=clamp(dot(norm,lightDir),eps,1.0);
        float NdotV=clamp(dot(norm,viewDir),eps,1.0);
        float NdotH=clamp(dot(norm,halfVector),eps,1.0);
        float LdotH=clamp(dot(lightDir,halfVector),eps,1.0);
        float VdotH=clamp(dot(viewDir,halfVector),eps,1.0);
        //float roughness=(255.0f-texture(material.texture_diffuse1,TexCoords).x)/800.0f;
        //float roughness=256.0f-texture(material.texture_diffuse1,TexCoords).x;
        //float roughness=1.2f-texture(material.texture_roughness1,TexCoords).r;
    
        float alpha = roughness*roughness;

        float alphaSqr = alpha*alpha;
        float denom = NdotH * NdotH *(alphaSqr-1.0) + 1.0f;
        float D = alphaSqr/(PI * denom * denom);
        float specular=D;

        
        vec3 F0=specStrength;
        vec3 F = F0 + (vec3(1.0f)-F0)*pow(1.0f-LdotH,5);



// Caution : the " NdotL *" and " NdotV *" are explicitely inversed , this is not a mistake .
        float Lambda_GGXV = NdotL*sqrt((-NdotV*alpha+NdotV)*NdotV+alpha);
        float Lambda_GGXL = NdotV*sqrt((-NdotL*alpha+NdotL)*NdotL+alpha);


        return F*vec3(D*Lambda_GGXV*Lambda_GGXL/(4*NdotV));
}

float distanceSquared(vec2 a,vec2 b) {
    a -= b;
    return dot(a, a);
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


vec4 SSRef1(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, vec3 specStrength,vec3 Diffuse)
{
    float radius;
    vec3 debug=vec3(0);

    //float tempRoughness=roughness;
    //vec3 vsPosition=(ViewMatrix*vec4(wsPosition,1.0f)).xyz;
    //vec3 vsNormal=(ViewMatrix*vec4(wsNormal,0)).xyz;
    //vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    //vec3 wsReflectionVector=normalize(reflect(wsPosition,wsNormal));
    bool emmiFlag=false;
    

    vec4 reflectedColor = vec4(0.0);
    vec2 hitPixel;
    vec3 hitPoint=texture(ssrHitpoint,TexCoords).rgb;
    float stepCount=0;
    vec3 test=vec3(0);
    vec3 neightbourColor=vec3(0);

    uint numSamples=uint(1);
    vec4 ssrcolor=vec4(0,0,0,1);
    vec4 ssrcolor1=vec4(0,0,0,1);
    float samplenum=numSamples;
    //float coneTangent = mix(0.0, roughness*(1.0-sampleBias), pow(dot(normalize(wsNormal),normalize(viewDir)), 1.5) * sqrt(roughness));
    //radius=coneTangent;
    float coneTangent=mix(clamp(0.0f, 1.0f, 0.2f*dot(normalize(wsNormal),normalize(-viewDir))), 0.6f, sqrt(roughness));
    float flag=0;

    vec3 refColor=vec3(0);

    float pdf=1;
    float IL=0;     
        
            
    float BRDF=0;//texture(ssrHitpoint,TexCoords).w;

    vec3 weightSum=vec3(0);
    vec3 neighcolorSum=vec3(0);
    float _random3=rand(TexCoords+0.201f);
    float _random4=rand(TexCoords+0.501f);
    int num3=int(_random3*99);
    int num4=int(_random4*99);
    vec2 jitter1=vec2(haltonNum[int((num3*int(frameIndex))%95)],haltonNum[int((num4*int(frameIndex))%95)]);
    jitter1=(jitter1-0.5)*2.5;
    //float angle=jitter1.x*180;
            //vec2 jitter1=vec2(_random3,_random4)*2-1;
    //mat2x2 offsetRotationMatrix = mat2x2(sin(angle), cos(angle), -cos(angle), sin(angle));
    for(float k=0;k<2;k++)
    {

        for(float j=0;j<4;j++)
        {
            emmiFlag=false;
            vec2 offsetUV=offset[(int(jitter1.x*7)*4*int(k+1)+int(j))%28];
            offsetUV+=ivec2(jitter1);
            offsetUV.x/=screenWidth;
            offsetUV.y/=screenHeight;

            vec2 neighbourUV=TexCoords+offsetUV;
            float neighbourPDF=1;
            float sign=1;
            //vec3 neighbourHitPoint=texture(ssrHitpoint,neighbourUV).xyz;
            //if(abs(neighbourHitPoint.z-currHitPoint.z)>75.0f) continue;
            neighbourPDF=texture(ssrHitpoint,neighbourUV).w;
            if(neighbourPDF<0) continue;

            //float neighbourBRDF=texture(ssrHitpoint,neighbourUV).w;
            vec4 hitPoint_WS=vec4(texture(ssrHitpoint,neighbourUV).xyz,1);
            vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            vec2 prevUV=0.5f*(hitPoint_CS.xy/max(hitPoint_CS.w, 1e-5))+0.5f;
            if(hitPoint_WS.z<-60000) prevUV=vec2(-1,-1);
            //return texelFetch(currFrame,ivec2(neighbourHitUV*size),0);
            if(prevUV.x>=1.0||prevUV.y>=1.0||prevUV.x<=0.0||prevUV.y<=0.0)
            {
                //neightbourColor=vec3(0);
                //emmiFlag=true;
                continue;
            }
            vec3 neighbourBRDF=SsrBRDF(viewDir,hitPoint_WS.xyz - wsPosition ,wsNormal,roughness,specStrength);
            //return vec4(prevUV,1,1);
            //return vec4(vec3(neighbourBRDF),1);
            float intersectionCircleRadius = coneTangent * length(prevUV - TexCoords) * 5;
            float mip = clamp(log2(intersectionCircleRadius ), 0.0, 10.0);
            //mip=0;
            if(neighbourUV.x>=1.0||neighbourUV.y>=1.0||neighbourUV.x<=0||neighbourUV.y<=0)
            {
                continue;
            }
            vec2 neighbourHitUV=prevUV;
            debug=vec3(neighbourHitUV,0);

            //debug=vec3((neighbourUV-TexCoords),0);
            vec2 size=vec2(textureSize(currFrame,0));
            neightbourColor=textureLod(currFrame,neighbourHitUV,mip).xyz;

            neightbourColor.rgb/=1+Luminance(neightbourColor.rgb);
            //return vec4(neightbourColor, 1);
            vec3 neighbourISPdf= step(1e-7, neighbourPDF) * neighbourBRDF/max(1e-7,neighbourPDF);
            neighcolorSum+=min(neightbourColor*neighbourISPdf, INF);
            weightSum+=neighbourISPdf;  
        }
    }
    ssrcolor=vec4(neighcolorSum/max(weightSum,vec3(1e-7)),1);
    ssrcolor.xyz/=1-Luminance(ssrcolor.xyz);
    if(ssrcolor.x<=1e-4 || hitPoint.z<-999)
    //if(false)
    {
        vec3 iblRef=normalize(reflect(normalize(viewDir), normalize(wsNormal)));
        float mipL=roughness*2.5;
        vec3 IBLColor=texture(IBL,-iblRef, mipL).rgb;
        ssrcolor.xyz=IBLColor;
    }
    return vec4(ssrcolor.xyz,1);
}


void main()
{             

    // ALL IN WORLD SPACE!!!
    //vec3 FragPos = texture(gSpecular, TexCoords).rgb;
    vec3 FragPos = WorldPosFromDepth();
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    float Gloss=texture(gNormal, TexCoords).a;

    //tempRoughness=Gloss;
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    //Diffuse=vec3(1,0,0);
    vec3 Specular = texture(gSpecular, TexCoords).rgb;
    if(dot(vec3(1.0), Specular)<1e-6){
        FragColor.xyzw = vec4(0, 0, 0, 1);
        return;
    }
    vec4 fragPosLightSpace=LightSpaceMatrix*vec4(FragPos,1.0f);
    vec3 lighting = vec3(0.0f);
    vec3 viewDir  = normalize(viewPos - FragPos);

    vec3 iblRef=normalize(reflect(viewDir, Normal));
    //return vec4(iblRef,1);
    float mipL=Gloss*2.5;
    vec3 IBLColor=texture(IBL,-iblRef, mipL).rgb;
    //IBLColor.xyz/=1+Luminance(IBLColor.rgb);
    //FragColor=vec4(iblRef, 1.0f);
    //if(IBLColor.x<1e-4) IBLColor = vec3(0);
    FragColor=vec4(IBLColor, 1.0f);
    //FragColor = vec4(0.5,0,0,1);

    if(Gloss<0.5f)
    //if(false)
    {
        FragColor=SSRef1(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
    }
    float roughness=Gloss;
    float NdotV=max(dot(normalize(Normal),normalize(viewDir)),1e-5);
    vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;
    FragColor.xyz=FragColor.xyz*(Specular*FG.x+FG.yyy);
    
    //if(FragColor)
    //FragColor=vec4(vec3(Gloss),1);




    //FragColor=textureLod(sceneDepth,TexCoords,1.0f);
    //FragColor=vec4(texture(ssrHitpixel,TexCoords).xy,1,1);
    
}
