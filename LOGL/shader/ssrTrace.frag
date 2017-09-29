#version 450 core

in vec2 TexCoords;
out vec4 SSRHitPoint;


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
uniform float mipLevel;
uniform bool flagHiZ;



//uniform float tempRoughness;

layout (std430, binding=1) buffer shader_data
{ 
    float haltonNum[200];
};

uniform vec3 viewPos;
uniform vec3 lightPos;
uniform mat4 LightSpaceMatrix;
uniform mat4x4 ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;
uniform mat4x4 inverseProjectionMatrix;

uniform float frameIndex;
uniform float screenWidth;
uniform float screenHeight;
uniform float initStep;
uniform float sampleBias;
//float screenWidth=1900;
//float screenHeight=1000;
float near=0.01f;
float far=100.0f;
vec4 reflectionV;
#define PI 3.1415926535f

vec2 offset[4]=vec2[](
vec2(0, 0),
vec2(1, -1),
vec2(-1, -1),
vec2(0, 1)
    );

float radicalInverse_VdC(uint bits) 
{
bits = (bits << 16u) | (bits >> 16u);
bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);

return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(uint i, uint n)
{ 
return vec2(i/n, radicalInverse_VdC(i));
}


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
        float denom = NdotH * NdotH *(alpha-1.0) + 1.0f;
        float D = alphaSqr/(PI * denom * denom);
        float specular=D;

        
        vec3 F0=specStrength;
        vec3 F = F0 + (vec3(1.0f)-F0)*pow(1.0f-LdotH,5);



// Caution : the " NdotL *" and " NdotV *" are explicitely inversed , this is not a mistake .
        float Lambda_GGXV = NdotL*sqrt((-NdotV*alpha+NdotV)*NdotV+alpha);
        float Lambda_GGXL = NdotV*sqrt((-NdotL*alpha+NdotL)*NdotL+alpha);



        float pdfD=alpha/max((PI*denom * denom), 1e-6);
        PDF=pdfD*NdotH/(4*VdotH);
        //IL=NdotL;
        return D*F*Lambda_GGXV*Lambda_GGXL/(4*NdotV);
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
                 
    float CosTheta = sqrt((1.0 - Xi.y) / max((1.0 + (m2 - 1.0) * Xi.y), 4e-5));
    float SinTheta = sqrt(1.0 - CosTheta * CosTheta);
                 
    vec3 H;
    H.x = SinTheta * cos(Phi);
    H.y = SinTheta * sin(Phi);
    H.z = CosTheta;
        
    float d = (CosTheta * m2 - CosTheta) * CosTheta + 1;
    float D = m2 / max((PI * d * d), 4e-5);
    float pdf = D * CosTheta;

    return vec4(H, pdf); 
}

vec3 sampleGGXVNDF(vec3 V_, float alpha_x, float alpha_y, float U1, float U2)
{
// stretch view
    vec3 V = normalize(vec3(alpha_x * V_.x, alpha_y * V_.y, V_.z));
// orthonormal basis
    vec3 T1 = (V.z < 0.9999) ? normalize(cross(V, vec3(0,0,1))) : vec3(1,0,0);
    vec3 T2 = cross(T1, V);
// sample point with polar coordinates (r, phi)
    float a = 1.0 / (1.0 + V.z);
    float r = sqrt(U1);
    float phi = (U2<a) ? U2/a * PI : PI + (U2-a)/(1.0-a) * PI;
    float P1 = r*cos(phi);
    float P2 = r*sin(phi)*((U2<a) ? 1.0 : V.z);
// compute normal
    vec3 N = P1*T1 + P2*T2 + sqrt(1.0 - P1*P1 - P2*P2)*V;
// unstretch
    N = normalize(vec3(alpha_x*N.x, alpha_y*N.y, N.z));
    return N;
} 

void swapIfBigger (inout float aa, inout float bb) {
    if( aa > bb) {
        float tmp = aa;
        aa = bb;
        bb = tmp;
    }
}

float distanceSquared(vec2 a,vec2 b) {
    a -= b;
    return dot(a, a);
}

bool rayIntersectsDepthBF( float zA, float zB, vec2 uv, float zThickness)
{
    //VEC4 uv4 = float4( uv, 0.0, 0.0);
    float cameraZ = -LinearizeDepth( textureLod(sceneDepth, uv,mipLevel).r) * far;   
    //float backZ = tex2Dlod( _BackFaceDepthTex, uv4).r * -_ProjectionParams.z;
                
    return zB <= cameraZ&&zA >= cameraZ-zThickness ;
}

bool rayIntersectsDepthBF1( float zA, float zB, vec2 uv, float zThickness)
{
    //VEC4 uv4 = float4( uv, 0.0, 0.0);
    float cameraZ = -LinearizeDepth( textureLod(sceneDepth, uv,0).r) * far;   
    //float backZ = tex2Dlod( _BackFaceDepthTex, uv4).r * -_ProjectionParams.z;
                
    return zB <= cameraZ && zA >= cameraZ-zThickness;
}

            


bool traceScreenSpaceRay1(
 // Camera-space ray origin, which must be within the view volume
 point3 csOrig, 
 
 // Unit length camera-space ray direction
 vec3 csDir,
 
 // A projection matrix that maps to pixel coordinates (not [-1, +1]
 // normalized device coordinates)
 mat4x4 proj, 
 
 // The camera-space Z buffer (all negative values)
 sampler2D csZBuffer,
 
 // Dimensions of csZBuffer
 vec2 csZBufferSize,
 
 // Camera space thickness to ascribe to each pixel in the depth buffer
 float zThickness, 
 
 // (Negative number)
 float nearPlaneZ, 
 
 // Step in horizontal or vertical pixels between samples. This is a float
 // because integer math is slow on GPUs, but should be set to an integer >= 1
 float stride,
 
 // Number between 0 and 1 for how far to bump the ray in stride units
 // to conceal banding artifacts
 float jitter,
 
 // Maximum number of iterations. Higher gives better images but may be slow
 const float maxSteps, 
 
 // Maximum camera-space distance to trace before returning a miss
 float maxDistance, 
 
 // Pixel coordinates of the first intersection with the scene
 out point2 hitPixel, 
 
 // Camera space location of the ray hit
 out point3 hitPoint,
 out vec3 P00) {
 
    
    // Clip to the near plane    
    float rayLength = ((csOrig.z + csDir.z * maxDistance) >- nearPlaneZ) ?
        (0 - csOrig.z)*0.1 / csDir.z : maxDistance;
    //maxDistance: maxDistance;
    point3 csEndPoint = csOrig + csDir* rayLength;

 
    // Project into homogeneous clip space
    vec4 H0 = proj * vec4(csOrig, 1.0);
    vec4 H1 = proj * vec4(csEndPoint, 1.0);
    float k0 = 1.0f / H0.w, k1 = 1.0f / H1.w;
 
    // The interpolated homogeneous version of the camera-space points  
    point3 Q0 = csOrig / H0.w, Q1 = csEndPoint / H1.w;

    // Screen-space endpoints
    point2 P0 = H0.xy / H0.w, P1 = H1.xy / H1.w;

    P0=(P0*0.5f+vec2(0.5f))*csZBufferSize;
    P1=(P1*0.5f+vec2(0.5f))*csZBufferSize;

    
 
    // If the line is degenerate, make it cover at least one pixel
    // to avoid handling zero-pixel extent as a special case later
    P1 += vec2((distanceSquared(P0, P1) < 0.0001) ? 0.01 : 0.0);
    vec2 delta = P1 - P0;
 
    // Permute so that the primary iteration is in x to collapse
    // all quadrant-specific DDA cases later
    bool permute = false;
    if (abs(delta.x) < abs(delta.y)) { 
        // This is a more-vertical line
        permute = true; delta = delta.yx; P0 = P0.yx; P1 = P1.yx; 
    }
 
    float stepDir = sign(delta.x);
    //float stepDir=1;
    float invdx = stepDir / delta.x;
 
    // Track the derivatives of Q and k
    vec3  dQ = (Q1 - Q0) * invdx;
    float dk = (k1 - k0) * invdx;
    vec2  dP = vec2(stepDir, delta.y * invdx);
    stride=pow(2,mipLevel)*1.214f+0.05;
 
    // Scale derivatives by the desired pixel stride and then
    // offset the starting values by the jitter fraction
    dP *= stride; dQ *= stride; dk *= stride;
    P0 += dP * jitter; Q0 += dQ * jitter; k0 += dk * jitter;
 
    // Slide P from P0 to P1, (now-homogeneous) Q from Q0 to Q1, k from k0 to k1
    point3 Q = Q0;
    point2 P = P0;
    float k=k0;
    // Adjust end condition for iteration direction
    float end = P1.x * stepDir;
    
    float prevZMaxEstimate = 0;
    float rayZMin = prevZMaxEstimate, rayZMax = prevZMaxEstimate;
    float sceneZMax = rayZMax + 1000;


    //float strideScaler = 1.0 - min( 1.0, -csOrig.z / 0.03f);
    //stride = 1.0 + strideScaler * stride;



    
    vec4 pqk = vec4( P, Q.z, k);
    vec4 dPQK = vec4( dP, dQ.z, dk);
    bool intersect=false;
    float stepCount = 0.0f;
    for (; 
         ((P.x * stepDir) <= end) && (stepCount < maxSteps) &&
         !intersect &&
          (sceneZMax != 0); 
          P+= dP, Q.z += dQ.z, k += dk, pqk+=dPQK,stepCount+=1.0f) {
         
        rayZMin = rayZMax;
        rayZMax = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);
        //prevZMaxEstimate = rayZMax;
        if (rayZMax > rayZMin) { 
           float t = rayZMin; rayZMin = rayZMax; rayZMax = t;
        }
 
        hitPixel = permute ? P.yx : P.xy;
        //hitPixel=P;

        hitPixel/=csZBufferSize;
        //hitPixel.y=1-hitPixel.y;
        if(hitPixel.x>=1.0||hitPixel.y>=1.0||hitPixel.x<=0.0||hitPixel.y<=0.0) return false;
        // You may need hitPixel.y = csZBufferSize.y - hitPixel.y; here if your vertical axis
        // is different than ours in screen space
        //sceneZMax=-LinearizeDepth(texture2D(sceneDepth,hitPixel).x)*far;
        if(stepCount<=initStep)
        {
            intersect=rayIntersectsDepthBF1(rayZMin,rayZMax,hitPixel,zThickness);
        }
        else
        {
            intersect=rayIntersectsDepthBF(rayZMin,rayZMax,hitPixel,zThickness);
        }
        
        //sceneZMax = texelFetch(csZBuffer, int2(hitPixel), 0);
    }
    P00=vec3(stepCount);
    if(stepCount<=1.0f) return false;

    //intersect= rayZMax >= sceneZMax && rayZMin <= sceneZMax;

    Q.xy += dQ.xy * stepCount;
    vec2 oldP=P;
    bool newIntersect=intersect;
    if(false)
    {
        pqk -= dPQK;
        P-= dP, Q -= dQ, k -= dk;
        dPQK /= stride;
        dP/= stride, dQ/= stride, dk/= stride;
        stepCount=0;
                    
        float originalStride = stride * 0.5;
        float newStride = originalStride;
        stepCount=0;
        rayZMax = Q.z / k;
        rayZMin = rayZMax;

            for (; 
         ((P.x * stepDir) <= end) && (stepCount < maxSteps) &&
         !intersect &&
          (sceneZMax != 0); 
          P+= dP, Q.z += dQ.z, k += dk, pqk+=dPQK,stepCount+=1.0f) {
         
        rayZMin = rayZMax;
        rayZMax = (dPQK.z * 0.5 + pqk.z) / (dPQK.w * 0.5 + pqk.w);
        //prevZMaxEstimate = rayZMax;
        if (rayZMax > rayZMin) { 
           float t = rayZMin; rayZMin = rayZMax; rayZMax = t;
        }
        hitPixel = permute ? P.yx : P.xy;
        //hitPixel=P;

        hitPixel/=csZBufferSize;
        //hitPixel.y=1-hitPixel.y;
        if(hitPixel.x>=1.0||hitPixel.y>=1.0||hitPixel.x<=0.0||hitPixel.y<=0.0) return false;
        // You may need hitPixel.y = csZBufferSize.y - hitPixel.y; here if your vertical axis
        // is different than ours in screen space
        //sceneZMax=-LinearizeDepth(texture2D(sceneDepth,hitPixel).x)*far;
        newIntersect=rayIntersectsDepthBF1(rayZMin,rayZMax,hitPixel,zThickness);
        
        //sceneZMax = texelFetch(csZBuffer, int2(hitPixel), 0);
        }

    Q.xy += dQ.xy*stepCount;
    }

    if(false)
    {
        
                    //pqk -= dPQK;
                    P-= dP, Q -= dQ, k -= dk;
                    //dPQK /= stride;
                    dP/= stride, dQ/= stride, dk/= stride;
                    
                    float originalStride = stride * 0.5;
                    float newStride = originalStride;
                    
                    rayZMax = Q.z / k;
                    rayZMin = rayZMax;

                    //bool intersect;
                    //for (float iii=0;(iii<binaryIteration);iii+=1.0f) 
                    while(originalStride>1e-7)
                    {
                        P+= dP*newStride, Q += dQ*newStride, k += dk*newStride;
                        rayZMin = rayZMax;
                        rayZMax = (-dQ.z * 0.5 + Q.z) / (-dk * 0.5 + k);
                        if (rayZMax > rayZMin) { 
                            float t = rayZMin; rayZMin = rayZMax; rayZMax = t;
                        }
 
                        hitPixel = permute ? P.yx : P.xy;
                        hitPixel/=csZBufferSize;
                        originalStride *= 0.5;
                        //if(originalStride<0.01f) break;
                        //sceneZMax = LinearizeDepth( texture(sceneDepth, hitPixel).r) * far; 
                        newIntersect=rayIntersectsDepthBF1(rayZMin,rayZMax,hitPixel,zThickness); 
                        //newStride = !((rayZMax < sceneZMax - zThickness) || (rayZMin > sceneZMax))? -originalStride : originalStride;
                        newStride=newIntersect? -originalStride: originalStride;
                    }
                    //intersect=true;
    }
    
    

    //P00=vec3(stepCount);
    // Advance Q based on the number of steps
    
    //Q.z=pqk.z;
    hitPoint = Q * (1.0 / k);
    //if(stepCount>=maxSteps-80) return false;
    //return (rayZMax > sceneZMax - zThickness)&& (rayZMin < sceneZMax);
    return newIntersect;
    //return newIntersect;    

}



vec4 SSRef1(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, vec3 specStrength,vec3 Diffuse)
{

    vec3 vsPosition=(ViewMatrix*vec4(wsPosition,1.0f)).xyz;
    vec3 vsNormal=(ViewMatrix*vec4(wsNormal,0)).xyz;
    vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    //vec3 wsReflectionVector=normalize(reflect(wsPosition,wsNormal));
    vec3 BRDF=vec3(0);
    float pdf=1;
    float debug;
    vec4 hitPoint_WS=vec4(-10000);
    vec2 prevUV=vec2(-2.5,-2.5);
    

    vec4 reflectedColor = vec4(0.0);
    vec2 hitPixel;
    vec3 hitPoint;
    float stepCount=0;
    vec3 test=vec3(0);
    SSRHitPoint=vec4(0);

    const uint numSamples=uint(1);
    vec4 ssrcolor=vec4(0,0,0,1);
    vec4 ssrcolor1=vec4(0,0,0,1);
    float samplenum=numSamples;
    float coneTangent = mix(0.0, roughness*0.6, pow(dot(normalize(wsNormal),normalize(-viewDir)), 1.5) * sqrt(roughness));
    float flag=0;
    for(uint i=uint(1);i<=numSamples;i++)
    {
        float scale=30;
        uint numss=uint(3)*numSamples;
        float _random1=rand(TexCoords);
        float _random2=rand(TexCoords-0.0301f);
        int index1=int(_random1*100);
        int index2=int(_random2*100);
        //float sampleBias=0.3;
        vec2 jitter=vec2(mix(haltonNum[index1%99],1.0,sampleBias),haltonNum[index2%99]);
        //vec2 jitter=texture(blueNoise,vec2(TexCoords.x+_random1,TexCoords+_random2)).xy;
        //vec2 jitter=vec2(_random1,_random2);

        vec4 H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
        //vec4 H=TangentToWorld(normalize(vsNormal), sampleGGXVNDF());
        H.xyz=normalize(H.xyz);
        vec3 dir=normalize(reflect(normalize(vsPosition),H.xyz));
        float ii=2;
        //float CameraFacingReflectionAttenuation = 1 - smoothstep(0, 0.88, dot(vec3(0,0,1), H.xyz));
        //if (CameraFacingReflectionAttenuation <= 0)
          //  continue;

        flag=0;
        while(dot(dir,vsNormal)<=0)
        {
            _random1=rand(TexCoords*_random1);
            _random2=rand(TexCoords*_random2-0.0301f*ii);
            int num1=int(_random1*100);
            int num2=int(_random2*100);
            jitter=vec2(haltonNum[int(num1%99)],haltonNum[int(num2%99)]);
            H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
            H.xyz=normalize(H.xyz);
            dir=normalize(reflect(normalize(vsPosition),H.xyz));
            ii++;
            if(ii>=8) {flag=1;break;}
        }
        if(flag==1) 
        {
            //SSRHitPixel=vec4(-1,-1,-1,pdf);
            return vec4(vec3(-100000),pdf);
        }
        

        //float new_stride=roughness>=0.2f?inputStride:inputStride+roughness*3;
        float new_stride=inputStride;
        bool isHit=traceScreenSpaceRay1(vsPosition.xyz,
            dir,
            ProjectionMatrix,
            sceneDepth,
            vec2(screenWidth,screenHeight),
            0.000,
            near,
            new_stride,
            1.05,
            350,
            200.0f,
            hitPixel,
            hitPoint,
            test);

        vec3 refColor=vec3(0);
        //debug=float(test);
        
    //hitPixel/=vec2(screenWidth,screenHeight);
        if(isHit)
        {
            hitPoint_WS=inverse(ViewMatrix)*vec4(hitPoint,1);
            vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            prevUV=0.5f*(hitPoint_CS.xy/hitPoint_CS.w)+0.5f;
            if(prevUV.x>=1.0||prevUV.y>=1.0||prevUV.x<=0.0||prevUV.y<=0.0)
            {
                //SSRHitPixel=vec4(-1,-1,-1,pdf);
                return vec4(vec3(-100000),pdf);
            }
            pdf=1;
            float IL=0;     
            BRDF=SsrBRDF(viewDir,(inverse(ViewMatrix)*vec4(hitPoint-vsPosition.xyz,0)).xyz,wsNormal,roughness,specStrength,pdf,IL);
            pdf = H.w;
            //SSRHitPixel=vec4(vec3(-1),pdf);
            //return vec4(hitPoint_WS.xyz - wsPosition,pdf);
            return vec4(hitPoint_WS.xyz,pdf);
        }
    }
    //SSRHitPixel=vec4(vec3(-1),pdf);
    return vec4(vec3(-100000),pdf);
}

#define CELL_STEP_OFFSET 0.05
vec3 StepThroughCell(vec3 RaySample, vec3 RayDir, int MipLevel)
{
    // Size of current mip 
    ivec2 MipSize = ivec2(screenWidth,screenHeight) >> MipLevel;

    // UV converted to index in the mip
    vec2 MipCellIndex = RaySample.xy * vec2(MipSize);

    //
    // Find the cell boundary UV based on the direction of the ray
    // Take floor() or ceil() depending on the sign of RayDir.xy
    //
    vec2 BoundaryUV;
    BoundaryUV.x = RayDir.x > 0 ? ceil(MipCellIndex.x) / float(MipSize.x) : 
        floor(MipCellIndex.x) / float(MipSize.x);
    BoundaryUV.y = RayDir.y > 0 ? ceil(MipCellIndex.y) / float(MipSize.y) : 
        floor(MipCellIndex.y) / float(MipSize.y);

    //
    // We can now represent the cell boundary as being formed by the intersection of 
    // two lines which can be represented by 
    //
    // x = BoundaryUV.x
    // y = BoundaryUV.y
    //
    // Intersect the parametric equation of the Ray with each of these lines
    //
    vec2 t;
    t.x = abs((BoundaryUV.x - RaySample.x) / RayDir.x);
    t.y = abs((BoundaryUV.y - RaySample.y) / RayDir.y);

    // Pick the cell intersection that is closer, and march to that cell
    if (abs(t.x) < abs(t.y))
    {
        RaySample += (t.x + CELL_STEP_OFFSET) * RayDir;
    }
    else
    {
        RaySample += (t.y + CELL_STEP_OFFSET) * RayDir;
    }
    return RaySample;
}

bool trace_ray(

    point3 csOrig, 
    vec3 csDir,
    mat4x4 proj, 
    sampler2D csZBuffer,
    vec2 csZBufferSize,
 float zThickness, 
 float nearPlaneZ, 
 float stride,
 float jitter,
 const float maxSteps, 
 float maxDistance, 
 out point2 hitPixel,
 out point3 hitPoint,
 out vec3 P00
    )
{

    vec4 psPosition = ProjectionMatrix * vec4(csOrig, 1.0f);
    vec3 ndcsPosition = psPosition.xyz / psPosition.w;
    vec3 ssPosition = 0.5f * ndcsPosition + 0.5f;
    //csDir=reflect()


    csDir = csOrig+csDir/10;
    vec4 psReflectionVector = ProjectionMatrix * vec4(csDir, 1.0);
    vec3 ndcEndPoint = psReflectionVector.xyz / psReflectionVector.w;
    vec3 ssEndPoint = 0.5f * ndcEndPoint + 0.5f;
    //ssReflectionVector = normalize(ssReflectionVector - ssPosition);

    vec3 ray_start=ssPosition;
    vec3 ray_end=ssEndPoint;
    vec3 ray_dir=ray_end-ray_start;
    //ray_start.z=LinearizeDepth(ray_start.z);
    
    //ray_end.z=LinearizeDepth(ray_end.z);   

    //if (ray_dir.z < 0.0) {
    //    return vec3(0);
    //}

    ray_dir = normalize(ray_dir);
    ivec2 work_size = ivec2(screenWidth, screenHeight);

    const int loop_max = 40;
    int mipmap = 0;
    int max_iter = loop_max;

    vec3 pos = ray_start;
    //float newZ = textureLod(sceneDepth, pos.xy, mipmap).x;

    // Move pos by a small bias
    pos += ray_dir * 0.002;

    float hit_bias = 0.0017;
    for(int i=0;i<7;i++){
        pos+=ray_dir/(screenWidth);
        float zd=textureLod(sceneDepth, pos.xy, 0).x;
        if(pos.z>zd && pos.z-zd<0.0001f){
            return false;
            hitPoint=pos;
            P00=vec3(i);
            return true;

        }
    }

    //return false;
    float j=0;

    while (mipmap > -1 && j<max_iter)
    {
        j++;
        P00=vec3(j);
        // Check if we are out of screen bounds, if so, return
        if (pos.x < 0.0 || pos.y < 0.0 || pos.x > 1.0 || pos.y > 1.0 || pos.z < 0.0 || pos.z > 1.0)
        {
            
            return false;
        }

        // Fetch the current minimum cell plane height
        float cell_z = textureLod(sceneDepth, pos.xy, mipmap).x;
        //mipmap=min(mipmap,6);
        //vec2 size=vec2(textureSize(sceneDepth,int(mipmap)));
        //float cell_z=texelFetch(sceneDepth,ivec2(size*pos.xy),int(mipmap)).x;
        //float cell_z = LinearizeDepth(textureLod(sceneDepth, pos.xy, mipmap).x);

        // Compute the fractional part of the coordinate (scaled by the working size)
        // so the values will be between 0.0 and 1.0
        vec2 fract_coord = mod(pos.xy * work_size, 1.0);

        // Modify fract coord based on which direction we are stepping in.
        // Fract coord now contains the percentage how far we moved already in
        // the current cell in each direction.  
        fract_coord.x = ray_dir.x > 0.0 ? fract_coord.x : 1.0 - fract_coord.x;
        fract_coord.y = ray_dir.y > 0.0 ? fract_coord.y : 1.0 - fract_coord.y;

        // Compute maximum k and minimum k for which the ray would still be
        // inside of the cell.
        vec2 max_k_v = (1.0 / abs(ray_dir.xy)) / work_size.xy;
        vec2 min_k_v = -max_k_v * fract_coord.xy;

        // Scale the maximum k by the percentage we already processed in the current cell,
        // since e.g. if we already moved 50%, we can only move another 50%.
        max_k_v *= 1.0 - fract_coord.xy;

        // The maximum k is the minimum of the both sub-k's since if one component-maximum
        // is reached, the ray is out of the cell
        float max_k = min(max_k_v.x, max_k_v.y);

        // Same applies to the min_k, but because min_k is negative we have to use max()
        float min_k = max(min_k_v.x, min_k_v.y);

        // Check if the ray intersects with the cell plane. We have the following
        // equation: 
        // pos.z + k * ray_dir.z = cell.z
        // So k is:
        float k = (cell_z - pos.z) / ray_dir.z;

        // Optional: Abort when ray didn't exactly intersect:
        if (k < min_k && mipmap <= 0 ) {
             return false;
        } 

        // Check if we intersected the cell
        if (k < max_k + hit_bias)
        {
            // Clamp k
            k = max(min_k, k);

            if (mipmap < 1) {
                if(j<=2) return false;
                pos += k * ray_dir;
                pos.xy=pos.xy*2-1;
                //vec4 temp = (inverseProjectionMatrix * vec4(pos,1));
                hitPoint=pos;
                return true;
            }

            // If we hit anything at a higher mipmap, step up to a higher detailed
            // mipmap:
            mipmap -= 2;
            work_size *= 4;
        } else {

            // If we hit nothing, move to the next cell, with a small bias
            pos += max_k * ray_dir * 1.009;
        }

        mipmap += 1;
        work_size /= 2;
    }

    return false;
}

/////////////////////////////////////////
#define MAX_ITERATIONS 45
#define HIZ_START_LEVEL 1
#define HIZ_STOP_LEVEL 0
#define HIZ_MAX_LEVEL 6
vec2 cell(vec2 ray, vec2 cell_count, uint camera) {
    return floor(ray.xy * cell_count);
}

vec2 cell_count(float level) {
    return vec2(screenWidth, screenHeight) / exp2(level);
}

vec3 intersect_cell_boundary(vec3 pos, vec3 dir, vec2 cell_id, vec2 cell_count, vec2 cross_step, vec2 cross_offset, uint camera) {
    vec2 cell_size = 1.0 / cell_count;
    vec2 planes = cell_id/cell_count + cell_size * cross_step;

    vec2 solutions = (planes - pos.xy)/dir.xy;
    vec3 intersection_pos = pos + dir * min(solutions.x, solutions.y);

    intersection_pos.xy += (solutions.x < solutions.y) ? vec2(cross_offset.x, 0.0) : vec2(0.0, cross_offset.y);

    return intersection_pos;
}

bool crossed_cell_boundary(vec2 cell_id_one, vec2 cell_id_two) {
    return int(cell_id_one.x) != int(cell_id_two.x) || int(cell_id_one.y) != int(cell_id_two.y);
}

float minimum_depth_plane(vec2 ray, float level, vec2 cell_count, uint camera) {
    //return input_texture2.Load(int3(vr_stereo_to_mono(ray.xy, camera) * cell_count, level)).r;
    return textureLod(sceneDepth, ray.xy, level).r;
    //return -LinearizeDepth( textureLod(sceneDepth, ray.xy,level).r) * far; 
}



bool trace_ray_HIZ(

    point3 csOrig, 
    vec3 csDir,
    mat4x4 proj, 
    sampler2D csZBuffer,
    vec2 csZBufferSize,
 float zThickness, 
 float nearPlaneZ, 
 float stride,
 float jitter,
 const float maxSteps, 
 float maxDistance, 
 out point2 hitPixel,
 out point3 hitPoint,
 out vec3 P00
    )
{
    int hitFlag=0;

    vec4 psPosition = ProjectionMatrix * vec4(csOrig, 1.0f);
    vec3 ndcsPosition = psPosition.xyz / psPosition.w;
    vec3 ssPosition = 0.5f * ndcsPosition + 0.5f;
    //csDir=reflect()


    csDir = csOrig+csDir;
    vec4 psReflectionVector = ProjectionMatrix * vec4(csDir, 1.0);
    vec3 ndcEndPoint = psReflectionVector.xyz / max(psReflectionVector.w, 1e-5);
    vec3 ssEndPoint = 0.5f * ndcEndPoint + 0.5f;
    //ssReflectionVector = normalize(ssReflectionVector - ssPosition);

    vec3 ray_start=ssPosition;
    vec3 ray_end=ssEndPoint;
    vec3 ray_dir=ray_end-ray_start;
    //ray_start.z=LinearizeDepth(ray_start.z);
    
    //ray_end.z=LinearizeDepth(ray_end.z);   

    //if (ray_dir.z < 0.0) {
    //    return vec3(0);
    //}
    vec3 p=ssPosition;
    vec3 v=ray_dir*0.0001;
    uint camera=uint(1);

    float level = HIZ_START_LEVEL;
    vec3 v_z = v/max(v.z, 1e-8);
    vec2 hi_z_size = cell_count(level);
    vec3 ray = p;
    //P00=ray;
    ray.xy+=0.5/hi_z_size;
    float originalDepth=textureLod(sceneDepth, ray.xy, 0).r;

    vec2 cross_step = vec2(v.x >= 0.0 ? 1.0 : -1.0, v.y >= 0.0 ? 1.0 : -1.0);
    vec2 cross_offset = cross_step * 0.0001;
  //cross_step = saturate(cross_step);
    cross_step = clamp(cross_step, 0.0, 1.0);

    vec2 ray_cell = cell(ray.xy, hi_z_size.xy, camera);
    //ray_cell+=0.25/hi_z_size;
    ray = intersect_cell_boundary(ray, v_z, ray_cell, hi_z_size, cross_step, cross_offset, camera);

    int iterations = 0;
    while(level >= HIZ_STOP_LEVEL && iterations < MAX_ITERATIONS) 
    {
    // get the cell number of the current ray
        vec2 current_cell_count = cell_count(level);
        vec2 old_cell_id = cell(ray.xy, current_cell_count, camera);

    // get the minimum depth plane in which the current ray resides
        float min_z = minimum_depth_plane(ray.xy, level, current_cell_count, camera);

    // intersect only if ray depth is below the minimum depth plane
        vec3 tmp_ray = ray;
        if(v.z > 0) 
        {
            float min_minus_ray = min_z - ray.z;
            //if(abs(min_minus_ray)<1e-3) hitFlag=1;
            tmp_ray = min_minus_ray > 1e-6  ? ray + v_z*min_minus_ray : tmp_ray;
            vec2 new_cell_id = cell(tmp_ray.xy, current_cell_count, camera);
            if(crossed_cell_boundary(old_cell_id, new_cell_id)) 
            //if(false) 
            {
                tmp_ray = intersect_cell_boundary(ray, v, old_cell_id, current_cell_count, cross_step, cross_offset, camera);
                level = min(HIZ_MAX_LEVEL, level + 2.0f);
            }else{

                if(level == 0 && abs(min_minus_ray) < 1e-4)
                //if(false) 
                {
                    hitFlag=1;
                    break;
                    tmp_ray = intersect_cell_boundary(ray, v, old_cell_id, current_cell_count, cross_step, cross_offset, camera);
                    level = 0;
                }
            }
        }
        else if(ray.z < min_z)
        //else if(false) 
        {
            tmp_ray = intersect_cell_boundary(ray, v, old_cell_id, current_cell_count, cross_step, cross_offset, camera);
            level = min(HIZ_MAX_LEVEL, level + 2.0f);
        }

        ray.xyz = tmp_ray.xyz;
        --level;

        ++iterations;
    }
    P00=vec3(float(iterations)/float(MAX_ITERATIONS));
    //if(ray.x<0 || ray.x>1 || ray.y<0 || ray.y>1) hitFlag=0;
    ray.xy=ray.xy*2-1;
    hitPixel=ray.xy;
    //ray.z=-LinearizeDepth(-ray.z/far)*far;
    //ray.z=0;
    
    hitPoint=ray;
    if(hitFlag == 0 || iterations <=1 || iterations >= MAX_ITERATIONS-1) return false;
    return true;

}

vec4 SSRef2(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, vec3 specStrength,vec3 Diffuse)
{
    if(roughness>0.7f){
        return vec4(vec3(-100000),-1);
    }

    vec3 vsPosition=(ViewMatrix*vec4(wsPosition,1.0f)).xyz;
    vec3 vsNormal=(ViewMatrix*vec4(wsNormal,0)).xyz;
    //vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    //vec3 wsReflectionVector=normalize(reflect(wsPosition,wsNormal));
    vec3 BRDF=vec3(0);
    float pdf=1;
    float debug;
    vec4 hitPoint_WS=vec4(-10000);
    vec2 prevUV=vec2(-2.5,-2.5);
    

    vec4 reflectedColor = vec4(0.0);
    vec2 hitPixel;
    vec3 hitPoint;
    float stepCount=0;
    vec3 test=vec3(0);
    SSRHitPoint=vec4(0);

    uint numSamples=uint(1);
    vec4 ssrcolor=vec4(0,0,0,1);
    vec4 ssrcolor1=vec4(0,0,0,1);
    float samplenum=numSamples;
    float flag=0;
    for(uint i=uint(1);i<=numSamples;i++)
    {
        float _random1=rand(TexCoords);
        float _random2=rand(TexCoords-0.0301f);
        int index1=int(_random1*100);
        int index2=int(_random2*100);
        vec2 jitter=vec2(mix(haltonNum[index1%99],1.0,sampleBias),haltonNum[index2%99]);
        //vec2 jitter;
        //jitter.x = texture(blueNoise, TexCoords).x;
        //jitter.y = texture(blueNoise, TexCoords+vec2(_random1)/vec2(screenWidth, screenHeight)).x;
        //vec2 jitter = Hammersley(uint(TexCoords.x*screenWidth+TexCoords.y*screenHeight), uint(screenWidth*screenHeight));
        //vec2 jitter=texture(blueNoise,vec2(TexCoords.x+_random1,TexCoords+_random2)).xy;
        //vec2 jitter=vec2(_random1,_random2);

        vec4 H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
        //vec4 H=TangentToWorld(normalize(vsNormal), sampleGGXVNDF());
        H.xyz=normalize(H.xyz);
        vec3 dir=normalize(reflect(normalize(vsPosition),H.xyz));
        float ii=0;

        flag=0;
        while(dot(dir,vsNormal)<1e-5)
        {
            _random1=rand(TexCoords*_random1);
            _random2=rand(TexCoords*_random2-0.0301f*ii);
            int num1=int(_random1*100);
            int num2=int(_random2*100);
            jitter=vec2(haltonNum[int(num1*(int(i)+1)%99)],haltonNum[int(num2*(int(i)+1)%99)]);
            H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
            H.xyz=normalize(H.xyz);
            dir=reflect(normalize(vsPosition),H.xyz);
            ii++;
            if(ii>=4) {return vec4(vec3(-100000),-1);}
        }
        //dir/=abs(dir.z);
        

        //float new_stride=roughness>=0.2f?inputStride:inputStride+roughness*3;
        float new_stride=inputStride;
        //return vec4(vsNormal.xyz,1);

        //dir=normalize(reflect(normalize(vsPosition.xyz),normalize(vsNormal.xyz)));
        //return vec4(normalize(dir),1);

        bool isHit=trace_ray_HIZ(vsPosition.xyz+vsNormal*0.001,
            dir,
            ProjectionMatrix,
            sceneDepth,
            vec2(screenWidth,screenHeight),
            0.000,
            near,
            new_stride,
            1.05,
            350,
            200.0f,
            hitPixel,
            hitPoint,
            test);

        vec3 refColor=vec3(0);
        //debug=float(test);
        
    //hitPixel/=vec2(screenWidth,screenHeight);
        if(isHit)
        {

            vec4 hitPointVS=inverseProjectionMatrix*vec4(hitPoint,1);
            hitPointVS.xyz/=hitPointVS.w;
            hitPoint_WS=inverseViewMatrix*vec4(hitPointVS.xyz,1); 
            vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            prevUV=0.5f*(hitPoint_CS.xy/hitPoint_CS.w)+0.5f;
            if(prevUV.x>=1.0||prevUV.y>=1.0||prevUV.x<=0.0||prevUV.y<=0.0)
            {
                //SSRHitPixel=vec4(-1,-1,-1,pdf);
                return vec4(vec3(-100000),-1);
            }
            pdf=1;
            float IL=0;     
            BRDF=SsrBRDF(viewDir,(inverseViewMatrix*vec4(hitPoint-vsPosition.xyz,0)).xyz,wsNormal,roughness,specStrength,pdf,IL);
            pdf = H.w;
            return vec4(hitPoint_WS.xyz,pdf);
        }
    }

    return vec4(vec3(-100000),-1);
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
    vec4 fragPosLightSpace=LightSpaceMatrix*vec4(FragPos,1.0f);
    vec3 lighting = vec3(0.0f);
    vec3 viewDir  = normalize(viewPos - FragPos);
    SSRHitPoint=vec4(-100000);
    if(Diffuse.x<1.0f&&Gloss<0.7f)
    {
        if(flagHiZ){
            SSRHitPoint=SSRef2(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
        }else{
            SSRHitPoint=SSRef1(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
        }
        
    }
}
