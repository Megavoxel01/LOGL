#version 450 core

out vec4 FragColor;
in vec2 TexCoords;


uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;
uniform sampler2D sceneDepth;
uniform sampler2D currFrame;
uniform sampler2D blueNoise;
uniform sampler2D BRDFLut;
uniform sampler2D ssrHitpoint;
uniform sampler2D ssrHitpixel;
uniform sampler2D prevSSR1;
uniform samplerCube IBL;

//layout(std430, binding = 2) buffer ssrResolveSSBO
//{    
    
//};
uniform mat4 ProjectionMatrix;
uniform mat4 ViewMatrix;
uniform mat4 preProjectionMatrix;
uniform mat4 preViewMatrix;
uniform mat4 inverseViewMatrix;
uniform vec4 viewPos;
uniform bool flagShadowMap;
uniform float extRand1;
uniform float resolve;
uniform float binaryIteration;
uniform float inputStride;
uniform float sampleBias;

//uniform float tempRoughness;

uniform float haltonNum[100];



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

float SsrBRDF(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, float specStrength,out float PDF,out float IL)
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

        
        float F0=specStrength;
        float F = F0 + (1.0f-F0)*pow(1.0f-LdotH,5);



// Caution : the " NdotL *" and " NdotV *" are explicitely inversed , this is not a mistake .
        float Lambda_GGXV = NdotL*sqrt((-NdotV*alpha+NdotV)*NdotV+alpha);
        float Lambda_GGXL = NdotV*sqrt((-NdotL*alpha+NdotL)*NdotL+alpha);



        float pdfD=alphaSqr/(PI*denom * denom);
        PDF=pdfD*NdotH/(4*VdotH);
        IL=NdotL;
        return D*F/(4*NdotV);
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


vec4 SSRef1(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, float specStrength,vec3 Diffuse)
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
    float coneTangent = mix(0.0, roughness*(1.0-sampleBias), pow(dot(normalize(wsNormal),normalize(viewDir)), 1.5) * sqrt(roughness));
    //radius=coneTangent;
    //float coneTangent=mix(0.0f, sqrt(roughness), mix(0.0f,1.0f,2.0f*dot(normalize(wsNormal),normalize(-viewDir))) );
    float flag=0;

    vec3 refColor=vec3(0);

    float pdf=1;
    float IL=0;     
        
            
    float BRDF=0;//texture(ssrHitpoint,TexCoords).w;

    float weightSum=0;
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
    for(float k=0;k<1;k++)
    {

        for(float j=0;j<4;j++)
        {
            emmiFlag=false;
            vec2 offsetUV=offset[(int(jitter1.x*7)*4+int(j))%28];
            offsetUV+=ivec2(jitter1);
            offsetUV.x/=screenWidth;
            offsetUV.y/=screenHeight;

            //offsetUV=offsetRotationMatrix*offsetUV;

            //debug=vec3(haltonNum[num3*int(k+1)%97]);
            //debug=vec3(offsetUV,0)*100;
            vec2 neighbourUV=TexCoords+offsetUV;
            float neighbourPDF=1;
            float sign=1;
            //vec3 neighbourHitPoint=texture(ssrHitpoint,neighbourUV).xyz;
            //if(abs(neighbourHitPoint.z-currHitPoint.z)>75.0f) continue;
            neighbourPDF=texture(ssrHitpoint,neighbourUV).w;

            //float neighbourBRDF=texture(ssrHitpoint,neighbourUV).w;
            vec4 hitPoint_WS=vec4(texture(ssrHitpoint,neighbourUV).xyz,1);
            vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            vec2 prevUV=0.5f*(hitPoint_CS.xy/hitPoint_CS.w)+0.5f;
            if(hitPoint_WS.z<-60000) prevUV=vec2(-1,-1);
            //return texelFetch(currFrame,ivec2(neighbourHitUV*size),0);
            if(prevUV.x>=1.0||prevUV.y>=1.0||prevUV.x<=0.0||prevUV.y<=0.0)
            {
                //neightbourColor=vec3(0);
                emmiFlag=true;
                //continue;
            }
            float neighbourBRDF=SsrBRDF(viewDir,hitPoint_WS.xyz - wsPosition ,wsNormal,roughness,specStrength,pdf,IL);
            //return vec4(prevUV,1,1);
            //return vec4(vec3(neighbourBRDF),1);
            float intersectionCircleRadius = coneTangent * length(prevUV - TexCoords);
            radius=log2(intersectionCircleRadius * max(screenWidth,screenHeight));
            radius/=100;
            float mip = clamp(log2(intersectionCircleRadius * max(screenWidth,screenHeight)), 0.0, 8.0);
            //mip=0;
            //if(neighbourUV.x>=1.0||neighbourUV.y>=1.0||neighbourUV.x<=0||neighbourUV.y<=0)
            //{
                //continue;
            //}
            vec2 neighbourHitUV=prevUV;
            debug=vec3(neighbourHitUV,0);

            //debug=vec3((neighbourUV-TexCoords),0);
            vec2 size=vec2(textureSize(currFrame,0));
            neightbourColor=textureLod(currFrame,neighbourHitUV,mip).xyz;
            //neightbourColor=texelFetch(currFrame,ivec2(neighbourHitUV*size),0).xyz;
            vec4 emmisive=texelFetch(ssrHitpixel,ivec2(neighbourUV*size),0);
            //return emmisive;
            if(flagEmmisive&&emmiFlag&&emmisive.x>=1.0f) 
            {
                neighbourBRDF=emmisive.w;
                neighbourPDF=emmisive.z;
                neightbourColor=vec3(1);
            }
            else if(emmiFlag)
            {
                continue;
            }
            //vec3 neightbourColor=vec3(texture(ssrHitpixel,TexCoords).xy,1);
            neightbourColor.rgb/=1+Luminance(neightbourColor.rgb);
            float neighbourISPdf=neighbourBRDF/max(1e-5,neighbourPDF);
            neighcolorSum+=neightbourColor*neighbourISPdf;
            //neighcolorSum+=vec3(neighbourISPdf);
            weightSum+=neighbourISPdf;
        }
    }
    //float NdotV=max(dot(normalize(wsNormal),normalize(viewDir)),1e-5);
    //vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;
            //vec3 FG=texture2D(BRDFLut,vec2(0.5f,0.5f),0).xyz;
            //vec3 FG=EnvDFGPolynomial(vec3(specStrength),pow(1-tem pRoughness,4),NdotV);
    ssrcolor=vec4(neighcolorSum/max(weightSum,1e-5),1);
    if(ssrcolor.x<=0)
    //if(false)
    {
        //return vec4(1);
        vec3 iblRef=normalize(reflect(normalize(viewDir), normalize(wsNormal)));
        //return vec4(iblRef,1);
        float mipL=roughness*2.5;
        vec3 IBLColor=texture(IBL,-iblRef, mipL).rgb;
        IBLColor.xyz/=1+Luminance(IBLColor.rgb);
        ssrcolor.xyz=IBLColor;
    }

    ssrcolor.xyz/=1-Luminance(ssrcolor.xyz);
    //ssrcolor.xyz=vec3(texture(ssrHitpixel,TexCoords).xy,1);
    




            

    //refColor*=vec3(BRDF);
    //refColor=vec3(hitPixel,0); 
    

    //return vec4(ssrcolor.xyz/float(numSamples),0);
    //return vec4(vec2(screenWidth,screenHeight)/2000,0,1.0f);
    //return vec4(debug,1.0f);
    //return vec4(texture(ssrHitpixel,TexCoords).xy,1,1);
    return vec4(ssrcolor.xyz,1);
}


void main()
{             

    // ALL IN WORLD SPACE!!!
    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    float Gloss=texture(gNormal, TexCoords).a;
    //tempRoughness=Gloss;
    vec3 Diffuse = texture(gAlbedoSpec, TexCoords).rgb;
    //Diffuse=vec3(1,0,0);
    float Specular = texture(gAlbedoSpec, TexCoords).a;
    vec3 lighting = vec3(0.0f);
    vec3 viewDir  = normalize(viewPos.xyz - FragPos);
    if(Gloss<0.7f)
    {
        FragColor=SSRef1(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
    }
    float roughness=Gloss;
    float NdotV=max(dot(normalize(Normal),normalize(viewDir)),1e-5);
    vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;
    FragColor.xyz=(FragColor.xyz*FG.x+vec3(FG.y));
    //if(FragColor)
    //FragColor=vec4(vec3(Gloss),1);




    //FragColor=textureLod(sceneDepth,TexCoords,1.0f);
    //FragColor=vec4(texture(ssrHitpixel,TexCoords).xy,1,1);
    
}
