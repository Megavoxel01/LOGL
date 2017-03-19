#version 330 core

in vec2 TexCoords;
out vec4 SSRHitPixel;


uniform sampler2D gPosition;
uniform sampler2D gNormal;
uniform sampler2D gAlbedoSpec;
uniform sampler2D shadowMap;
uniform sampler2D sceneDepth;
uniform sampler2D prevFrame1;
uniform sampler2D blueNoise;
uniform sampler2D BRDFLut;
uniform sampler2D ePosition;
uniform bool flagShadowMap;
uniform float extRand1;
uniform float resolve;
uniform float binaryIteration;
uniform float inputStride;
uniform float mipLevel;



//uniform float tempRoughness;




uniform float haltonNum[100];

uniform vec3 viewPos;
uniform vec3 lightPos;
uniform mat4 LightSpaceMatrix;
uniform mat4x4 ProjectionMatrix;
uniform mat4x4 fov2ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 prefov2ProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;

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
        (0 - csOrig.z) *0.1/ csDir.z : maxDistance;
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
    if(stepCount<=5.0f&&stepCount>=maxSteps/3) return false;

    //intersect= rayZMax >= sceneZMax && rayZMin <= sceneZMax;

    Q.xy += dQ.xy * stepCount;
    vec2 oldP=P;
    bool newIntersect=intersect;
    if(true)
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



vec4 SSRef1(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, float specStrength,vec3 Diffuse)
{

    vec3 vsPosition=(ViewMatrix*vec4(wsPosition,1.0f)).xyz;
    vec3 vsNormal=(ViewMatrix*vec4(wsNormal,0)).xyz;
    vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    vec3 wsReflectionVector=normalize(reflect(wsPosition,wsNormal));
    float BRDF=0;
    float pdf=1;
    float debug;
    vec2 prevUV=vec2(-2.5,-2.5);
    

    vec4 reflectedColor = vec4(0.0);
    vec2 hitPixel;
    vec3 hitPoint;
    float stepCount=0;
    vec3 test=vec3(0);
    //SSRHitPoint=vec4(0);

    uint numSamples=uint(1);
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
        H.xyz=normalize(H.xyz);
        vec3 dir=normalize(reflect(normalize(vsPosition),H.xyz));
        float ii=2;
        float CameraFacingReflectionAttenuation = 1 - smoothstep(0, 0.88, dot(vec3(0,0,1), H.xyz));
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
            if(ii>=10) {flag=1;break;}
        }
        if(flag==1) 
        {
            //SSRHitPixel=vec4(0,0,0,pdf);
            return vec4(prevUV,pdf,BRDF);
        }
        

        //float new_stride=roughness>=0.2f?inputStride:inputStride+roughness*3;
        float new_stride=inputStride;
        bool isHit=traceScreenSpaceRay1(vsPosition.xyz,
            dir,
            fov2ProjectionMatrix,
            sceneDepth,
            vec2(screenWidth,screenHeight),
            0.000,
            near,
            new_stride,
            1.05,
            100,
            5.0f,
            hitPixel,
            hitPoint,
            test);

        vec3 refColor=vec3(0);
        //debug=float(test);
        
    //hitPixel/=vec2(screenWidth,screenHeight);
        if(isHit)
        {
            //vec4 hitPoint_WS=inverse(ViewMatrix)*vec4(hitPoint,1);
            //vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            //vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            //prevUV=0.5f*(hitPoint_CS.xy/hitPoint_CS.w)+0.5f;
            //if(prevUV.x>=1.0||prevUV.y>=1.0||prevUV.x<=0.0||prevUV.y<=0.0)
            {
                //SSRHitPixel=vec4(0,0,0,pdf);
                //return vec4(vec3(-1),BRDF);
            }
            pdf=1;
            float IL=0;     
            BRDF=SsrBRDF(viewDir,(inverse(ViewMatrix)*vec4(hitPoint-vsPosition.xyz,0)).xyz,wsNormal,roughness,specStrength,pdf,IL);
            //SSRHitPixel=vec4(texture(prevFrame1,prevUV).rgb,pdf);
            return vec4(vec2(2),pdf,BRDF);
        }
    }
    //SSRHitPixel=vec4(0,0,0,pdf);
    //return vec4(ssrcolor.xyz/float(numSamples),0);
    return vec4(vec2(-1),pdf,BRDF);
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
    vec4 fragPosLightSpace=LightSpaceMatrix*vec4(FragPos,1.0f);
    vec3 lighting = vec3(0.0f);
    vec3 viewDir  = normalize(viewPos - FragPos);
    SSRHitPixel=vec4(-100000);
    if(Diffuse.x<1.0f&&Gloss<0.7f)
    {
        SSRHitPixel=SSRef1(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
    }
    //SSRHitPixel=vec4(mipLevel/10);
    //FragColor=texture(gPosition,TexCoords);
}
