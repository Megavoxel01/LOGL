#version 430
out vec4 FragColor;
in vec2 TexCoords;

uniform sampler2D gPosition;
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
        return D*F*Lambda_GGXV*Lambda_GGXL/(4*NdotV);
}

float PhysicalBRDF(vec3 lightDir, vec3 viewDir, vec3 normal, float roughness, float specStrength)
{

        vec3 norm=normal;
        float diff=max(dot(norm,lightDir),0.0);
        vec3 halfVector=normalize(lightDir+viewDir);
        float NdotL=clamp(dot(norm,lightDir),0.0,1.0);
        float NdotV=clamp(dot(norm,viewDir),0.0,1.0);
        float NdotH=clamp(dot(norm,halfVector),0.0,1.0);
        float LdotH=clamp(dot(lightDir,halfVector),0.0,1.0);

        //float NdotL=saturate(dot(norm,lightDir));
        //float NdotV=saturate(dot(norm,viewDir));
        //float NdotH=saturate(dot(norm,halfVector));
        //float LdotH=saturate(dot(lightDir,halfVector));

        //float roughness=(255.0f-texture(material.texture_diffuse1,TexCoords).x)/800.0f;
        //float roughness=256.0f-texture(material.texture_diffuse1,TexCoords).x;
        //float roughness=1.2f-texture(material.texture_roughness1,TexCoords).r;
    
        float alpha = roughness*roughness;

        float alphaSqr = alpha*alpha;
        float pi = 3.14159f;
        float denom = NdotH * NdotH *(alphaSqr-1.0) + 1.0f;
        float D = alphaSqr/(pi * denom * denom);
        float specular=D;

        float F0=specStrength;
        float F = F0 + (1.0f-F0)*pow(1.0f-LdotH,5);



// Caution : the " NdotL *" and " NdotV *" are explicitely inversed , this is not a mistake .
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
    float rayLength = ((csOrig.z + csDir.z * maxDistance) > -nearPlaneZ) ?
        (-nearPlaneZ - csOrig.z) / csDir.z : maxDistance;
    point3 csEndPoint = csOrig + csDir* rayLength;
    //P00=csEndPoint;
 
    // Project into homogeneous clip space
    vec4 H0 = proj * vec4(csOrig, 1.0);
    vec4 H1 = proj * vec4(csEndPoint, 1.0);
    float k0 = 1.0f / H0.w, k1 = 1.0f / H1.w;
 
    // The interpolated homogeneous version of the camera-space points  
    point3 Q0 = csOrig * k0, Q1 = csEndPoint * k1;

    // Screen-space endpoints
    point2 P0 = H0.xy * k0, P1 = H1.xy * k1;
    //P00=vec3(P1,1);
    P0=(P0*0.5f+vec2(0.5f))*csZBufferSize;
    P1=(P1*0.5f+vec2(0.5f))*csZBufferSize;
    //P00=vec3(P0/csZBufferSize,0);
    
 
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
        intersect=rayIntersectsDepthBF(rayZMin,rayZMax,hitPixel,zThickness);
        //sceneZMax = texelFetch(csZBuffer, int2(hitPixel), 0);
    }


    //intersect= rayZMax >= sceneZMax && rayZMin <= sceneZMax;
    P00=vec3(0);
    Q.xy += dQ.xy * stepCount;
    vec2 oldP=P;
    P00=vec3(abs(P-oldP),0);
    if(intersect&&stride>=1.8f)
    {
                    //pqk -= dPQK;
                    P-= dP, Q.z -= dQ.z, k -= dk;
                    //dPQK /= stride;
                    dP/= stride, dQ.z/= stride, dk/= stride;
                    
                    float originalStride = stride * 0.5;
                    float newStride = originalStride;
                    
                    rayZMax = Q.z / k;
                    rayZMin = rayZMax;

                    //bool intersect;
                    P00=vec3(binaryIteration);
                    //for (float iii=0;(iii<binaryIteration);iii+=1.0f) 
                    while(originalStride<1e-6)
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
                        intersect=rayIntersectsDepthBF1(rayZMin,rayZMax,hitPixel,zThickness); 
                        //newStride = !((rayZMax < sceneZMax - zThickness) || (rayZMin > sceneZMax))? -originalStride : originalStride;
                        newStride=intersect? -originalStride: originalStride;
                        P00=vec3(abs(P-oldP),0);
                    }
                    //intersect=true;
    }
    
    

    //P00=vec3(stepCount);
    // Advance Q based on the number of steps
    
    //Q.z=pqk.z;
    hitPoint = Q * (1.0 / k);
    //if(stepCount>=maxSteps-80) return false;
    //return (rayZMax > sceneZMax - zThickness)&& (rayZMin < sceneZMax);
    return intersect;

}



vec4 SSRef1(vec3 wsPosition, vec3 wsNormal, vec3 viewDir,float roughness, float specStrength,vec3 Diffuse)
{

    //float tempRoughness=roughness;
    vec3 vsPosition=(ViewMatrix*vec4(wsPosition,1.0f)).xyz;
    vec3 vsNormal=(ViewMatrix*vec4(wsNormal,0)).xyz;
    vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    vec3 wsReflectionVector=normalize(reflect(wsPosition,wsNormal));
    

    vec4 reflectedColor = vec4(0.0);
    //vec2 pixelsize = 1.0/vec2(screenWidth, screenHeight);


    //vec4 csPosition = ProjectionMatrix * vec4(vsPosition, 1.0f);
    //vec3 ndcsPosition = csPosition.xyz / csPosition.w;
    //vec3 ssPosition = 0.5 * ndcsPosition.xyz + 0.5;

    vec2 hitPixel;
    vec3 hitPoint;
    float stepCount=0;
    vec3 test=vec3(0);
    //return vec4(vsPosition.xy,0,1);
    //csReflectionVector=normalize(csReflectionVector-csPosition);
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
        float sampleBias=0;
        vec2 jitter=vec2(mix(haltonNum[index1%99],1.0,sampleBias),haltonNum[index2%99]);
        //vec2 jitter=texture(blueNoise,vec2(TexCoords.x+_random1,TexCoords+_random2)).xy;
        //vec2 jitter=vec2(_random1,_random2);

        vec4 H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
        H.xyz=normalize(H.xyz);
        vec3 dir=normalize(reflect(normalize(vsPosition),H.xyz));
        float ii=2;
        //if(dot(dir,vsNormal)<=0)
        //{
            //samplenum--;
        //    continue;
        //}
        flag=0;
        while(dot(dir,vsNormal)<=0)
        {
            _random1=rand(TexCoords*_random1);
            _random2=rand(TexCoords*_random2-0.0301f*ii);
            int num1=int(_random1*100);
            int num2=int(_random2*100);
            jitter=vec2(haltonNum[int(num1%99)],haltonNum[int(num2%99)]);
            //jitter=vec2(_random1,_random2)*2-1;

            H=TangentToWorld(normalize(vsNormal), ImportanceSampleGGX(jitter, roughness));
            H.xyz=normalize(H.xyz);
            dir=normalize(reflect(normalize(vsPosition),H.xyz));
            ii++;
            if(ii>=10) {flag=1;break;}
        }
        if(flag==1) 
        {
            //ssrcolor=vec4(1,0,0,1);
            return vec4(0);
        }
        

        //float new_stride=roughness>=0.2f?inputStride:inputStride+roughness*3;
        float new_stride=inputStride;
        bool isHit=traceScreenSpaceRay1(vsPosition.xyz,
            dir,
            ProjectionMatrix,
            sceneDepth,
            vec2(screenWidth,screenHeight),
            0.005,
            near,
            new_stride,
            1.05,
            450,
            150.0f,
            hitPixel,
            hitPoint,
            test);
    

        vec3 refColor=vec3(0);
        
    //hitPixel/=vec2(screenWidth,screenHeight);
        if(isHit)
        {
            //return vec4(test,1);
       //refColor=texture2D(gAlbedoSpec,hitPixel).rgb;
        //refColor=vec3(P00,1);
        //refColor=vec3(test);
        //refColor=vec3(vec2(gl_FragCoord)/vec2(screenWidth,screenHeight),0);
        //vec4 hitPoint_WS=vec4(hitPoint,1)*inverseViewMatrix;
            vec4 hitPoint_WS=inverse(ViewMatrix)*vec4(hitPoint,1);
            vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
            vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
            vec2 prevUV=0.5*(hitPoint_CS.xy/hitPoint_CS.w)+0.5;
            //refColor=texture2D(prevFrame1,prevUV).xyz;
            float pdf=0;
            float IL=0;     
        
            
            float BRDF=SsrBRDF(viewDir,(inverse(ViewMatrix)*vec4(hitPoint-vsPosition.xyz,0)).xyz,wsNormal,roughness,specStrength,pdf,IL);
            pdf=max(1e-5,pdf);
            //if(pdf<=0) 
            //{
                //samplenum--;
            //    continue;
            //}
            float weightSum=0;
            vec3 neighcolorSum=vec3(0);
            float ISpdf=BRDF/pdf;
            //weightSum+=ISpdf;
            //ssrcolor1+=vec4(ISpdf*refColor,0);
            float _random3=rand(TexCoords+0.201f);
            float _random4=rand(TexCoords+0.501f);
            int num3=int(_random3*99);
            int num4=int(_random4*99);
            vec2 jitter1=vec2(haltonNum[int(num3%95)],haltonNum[int(num4%95)])*2-1;
            //vec2 jitter1=vec2(_random3,_random4)*2-1;
            mat2x2 offsetRotationMatrix = mat2x2(jitter1.x, jitter1.y, -jitter1.y, jitter1.x);

            for(float j=0;j<resolve ;j++)
            {
                vec2 offsetUV=offset[int(j)]*(1.0f/vec2(screenWidth,screenHeight));
                offsetUV=offsetRotationMatrix*offsetUV;
                vec2 neighbourUV=prevUV+offsetUV;
                float neightbourDepth=texture2D(sceneDepth,neighbourUV).x;
                vec4 neighbourHit=inverse(preProjectionMatrix)*vec4((neighbourUV*2-1),neightbourDepth*2-1,1);
                neighbourHit.xyz/=neighbourHit.w;
                neighbourHit=inverse(preViewMatrix)*vec4(neighbourHit.xyz,1);

                float neighbourPDF=1;
                float sign=1;

                //if(dot(wsNormal,normalize(neighbourHit.xyz-wsPosition.xyz))<0) 
                {
                    //continue;
                }
                float neighbourBRDF=SsrBRDF(viewDir,(neighbourHit.xyz-wsPosition.xyz),wsNormal,roughness,specStrength,neighbourPDF,IL);
                if(neighbourPDF<=0) continue;
                float intersectionCircleRadius = coneTangent * length(neighbourUV - prevUV);
                float mip = clamp(log2(intersectionCircleRadius * max(screenWidth, screenHeight)), 0.0, 3.0);
                //mip=0;
                if(neighbourUV.x>1.0||neighbourUV.y>1.0||neighbourUV.x<0||neighbourUV.y<0)
                {
                    //neighcolorSum+=vec3(1);
                    continue;
                }
                vec3 neightbourColor=texture2D(prevFrame1,neighbourUV,0).xyz;
                neightbourColor.rgb/=1+Luminance(neightbourColor.rgb);
                //if(neightbourColor!=neightbourColor) return vec4(1,0,0,1);
                //if(neightbourColor.x>1e30) neightbourColor=vec3(1,0,0);

                //if(neightbourColor.x<=0) neightbourColor=
                float neighbourISPdf=BRDF/max(1e-5,neighbourPDF);
                neighcolorSum+=neightbourColor*neighbourISPdf;
                //neighcolorSum+=vec3(neighbourISPdf);
                weightSum+=neighbourISPdf;
            }
            float NdotV=max(dot(normalize(wsNormal),normalize(viewDir)),1e-5);
            vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;
            //vec3 FG=texture2D(BRDFLut,vec2(0.5f,0.5f),0).xyz;
            //vec3 FG=EnvDFGPolynomial(vec3(specStrength),pow(1-tem pRoughness,4),NdotV);
            ssrcolor=vec4(((neighcolorSum))/max(weightSum,1e-5),1);
            ssrcolor.xyz/=1-Luminance(ssrcolor.xyz);
            //ssrcolor.xyz=0.5f*(ssrcolor.xyz*FG.x+vec3(FG.y));
            

        //refColor*=vec3(BRDF);
        //refColor=vec3(hitPixel,0); 
        }
    }

    //return vec4(ssrcolor.xyz/float(numSamples),0);
    return vec4(ssrcolor.xyz,1);
}

vec4 SSRef(vec3 vsPosition, vec3 vsNormal, vec3 viewDir)
{
    vsPosition=(ViewMatrix*vec4(vsPosition,1.0f)).xyz;
    vsNormal=(ViewMatrix*vec4(vsNormal,0)).xyz;
    vec3 vsReflectionVector=normalize(reflect(vsPosition,vsNormal));
    

    vec4 reflectedColor = vec4(0.0);
    vec2 pixelsize = 1.0/vec2(screenWidth, screenHeight);


    vec4 csPosition = ProjectionMatrix * vec4(vsPosition, 1.0f);
    //return vec4(csPosition.xyz,1);
    vec3 ndcsPosition = csPosition.xyz / csPosition.w;
    //return vec4(ndcsPosition,1);
    //return vec4(ndcsPosition,1);
    vec3 ssPosition = 0.5 * ndcsPosition.xyz + 0.5;

    vsReflectionVector += vsPosition;
    vec4 csReflectionVector = ProjectionMatrix * vec4(vsReflectionVector, 1.0f);
    //return vec4(vec3(csReflectionVector.z/csReflectionVector.w),1);
    vec3 ndcsReflectionVector = csReflectionVector.xyz / csReflectionVector.w;
    //return vec4(csReflectionVector.xyz,1);
    vec3 ssReflectionVector = ndcsReflectionVector*0.5+0.5;
    return vec4(ssReflectionVector.xy,0,1);
    ssReflectionVector = normalize(ssReflectionVector - ssPosition);
    //csReflectionVector=normalize(csReflectionVector-csPosition);


    vec3 lastSamplePosition;
    vec3 currentSamplePosition;
    float initalStep;
    float pixelStepSize=2;
    float sampleCount=300;
    float count=0;

    initalStep=1.0f/screenWidth;
    float inverse;
    //ssReflectionVector*=initalStep;
    if(abs(ssReflectionVector.x)>abs(ssReflectionVector.y))
    {
        inverse=abs(1.0f/ssReflectionVector.x);
    }
    else
    {
        inverse=abs(1.0f/ssReflectionVector.y);
    }
    //ssReflectionVector*=1.0f*inverse/screenWidth*2;
    ssReflectionVector*=1.0f/length(ssReflectionVector.xy)/screenWidth*2;

    /*
    float temp;
    float portion=ssReflectionVector.x/ssReflectionVector.y;
    if(ssReflectionVector.x>ssReflectionVector.y)
    {
        temp=ssReflectionVector.x;
        ssReflectionVector.x=1.0f/screenWidth;
        ssReflectionVector.y=(1.0f/screenWidth)*(1.0f/portion)*(screenHeight/screenWidth);
        ssReflectionVector.z*=(1/screenWidth)/temp;
    }else
    {
        temp=ssReflectionVector.y;
        ssReflectionVector.y=1.0f/screenHeight;
        ssReflectionVector.x=1.0f/screenHeight*portion*screenWidth/screenHeight;
        ssReflectionVector.z*=(1.0f/screenHeight)/temp;
    }
    */

    lastSamplePosition = ssPosition+ ssReflectionVector*rand(TexCoords.xy);
    currentSamplePosition = lastSamplePosition + ssReflectionVector;

    //return vec4(currentSamplePosition,1);
    float sampledDepth;
    float currentDepth;
    while(count<sampleCount)
    {
        if(currentSamplePosition.x<0.0||currentSamplePosition.x>1.0||
           currentSamplePosition.y<0.0||currentSamplePosition.y>1.0)
        {
            break;
        }

        vec2 samplingPosition=currentSamplePosition.xy;
        sampledDepth=LinearizeDepth(texture(sceneDepth,samplingPosition).r);
        currentDepth=LinearizeDepth(currentSamplePosition.z);
        //return vec4(ssPosition.zzz,1);



        if(currentDepth>sampledDepth)
        {
            float delta = abs(currentDepth - sampledDepth);
            if(delta <= 0.0005f)
            {
                float f = currentDepth;
                float blurSize = 30 * f;
                return vec4(samplingPosition,1,1); 
                reflectedColor = vec4(texture(gAlbedoSpec, vec2(samplingPosition.x-0.5*ssReflectionVector.x, samplingPosition.y-0.5*ssReflectionVector.y)).rgb,1.0f);
                //reflectedColor=vec4(1.0f);

                //for(float i= - blurSize/2.0; i < blurSize/2.0; i+= 1.0)
                //{
                //    reflectedColor += vec4(texture(gAlbedoSpec, vec2(samplingPosition.x, samplingPosition.y + i * pixelsize.y)).rgb);
                //}
                    
                //reflectedColor /= blurSize;
                break;  
            }
        }        
        else
        {
            // Step ray
            lastSamplePosition = currentSamplePosition;
            currentSamplePosition = lastSamplePosition + ssReflectionVector * pixelStepSize;
            //currentSamplePosition.xy = lastSamplePosition.xy + ssReflectionVector.xy*pixelStepSize;
            //currentSamplePosition.z = lastSamplePosition.z + 1/currentDepth * pixelStepSize*initalStep;
        }
        
        count+=1;
    }
    float cou=count;
    float scou=sampleCount;
    //return vec4(csReflectionVector.xyz,1.0f);
    //return vec4(TexCoords.x,TexCoords.y,vsPosition.z,1.0f);
    return reflectedColor;
}



void main()
{             

    // ALL IN WORLD SPACE!!!
    //float rand1=rand(TexCoords+vec2(frameIndex/200.0f));
    //float rand2=rand(TexCoords+vec2(0.03f+frameIndex/200.0f));
    ProjectionMatrix=_ProjectionMatrix;
    //ProjectionMatrix[2][0]=haltonNum[int(rand1*99)%99]*2;
    //ProjectionMatrix[2][1]=haltonNum[int(rand2*99)%99]*2;

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
    float shadow=0.0f;
    if(flagShadowMap)
        shadow = ShadowCalculation(fragPosLightSpace, FragPos,Normal);                      
    shadow = min(shadow, 0.75); // reduce shadow strength a little: allow some diffuse/specular light in shadowed regions
    //lighting = (ambient + (1.0 - shadow) * (diffuse + specular)) * color;
    vec3 specular;
    vec3 diffuse;
    float BRDF;
    for(int i = 0; i < NR_LIGHTS-14; ++i)
    {

        vec3 lightDir = normalize(lights[i].Position - FragPos);
        diffuse = max(dot(Normal, lightDir), 0.0) * Diffuse * lights[i].Color;
        BRDF=PhysicalBRDF(lightDir,viewDir,Normal,Gloss,Specular);
        specular = lights[i].Color * BRDF;
        // Attenuation
        float distance = length(lights[i].Position - FragPos);
        //float attenuation = 1.0 / (1.0 + lights[i].Linear * distance + lights[i].Quadratic * distance * distance);
        float attenuation = 1.0 / (1.0 + distance*4);
        diffuse *= attenuation;
        //specular *= attenuation;
        lighting += diffuse + specular;
    }    
    FragColor = vec4((1.0f-shadow)*lighting, 1.0f);
    //if(Gloss<0.4f)
        //FragColor=SSR(FragPos,Normal, viewDir);
    if(Diffuse.x>=1.0f) FragColor=vec4(3,3,3,1);
    if(frameIndex>2)
    {
        //FragColor+=SSRef1(FragPos,Normal,viewDir,Gloss,Specular,Diffuse);
    }
    
        //FragColor=vec4(Normal,1.0f);
    //if(flagShadowMap)FragColor = vec4((shadow)*lighting, 1.0f);
    //else 
    //FragColor = vec4(lighting, 1.0f);

    //FragColor = vec4(vec3(Gloss), 1.0);
    //FragColor = vec4(BRDF,BRDF,BRDF, 1.0f);
    //FragColor=vec4(Specular,Specular,Specular,1.0f);
    //FragColor=vec4(Normal,1.0f);
    //FragColor=vec4(Gloss,Gloss,Gloss,1.0f);
    //FragColor=vec4(fragPosLightSpace);
    //FragColor=vec4(vec3(texture(gAlbedoSpec, TexCoords).rgb),1.0f);
    //FragColor = vec4(lighting, 1.0);
    //FragColor=texture(shadowMap,TexCoords);
    //FragColor=vec4(vec3(texture(gNormal, TexCoords).a),1.0f);
    //FragColor=vec4(gl_FragCoord.z);
}

