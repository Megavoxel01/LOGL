#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D currSSR;
uniform sampler2D prevSSR1;
uniform sampler2D gSpecular;
uniform sampler2D sceneDepth;
uniform sampler2D gNormal;
uniform sampler2D BRDFLut;
uniform sampler2D ssrHitpoint;


uniform mat4x4 ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;

uniform float screenWidth;
uniform float screenHeight;

uniform bool temporal;
uniform float TAAscale;
uniform float TAAresponse;

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

float LinearizeDepth(float depth)
{
	float near=0.01f;
	float far=100.0f;
    float z=depth*2.0-1.0;
    return (2.0*near)/(far+near-z*(far-near));
}

vec4 clipToAABB(vec4 color, float p, vec3 minimum, vec3 maximum)
{
    // note: only clips towards aabb center (but fast!)
    vec3 center = .5 * (maximum + minimum);
    vec3 extents = .5 * (maximum - minimum);

    // This is actually `distance`, however the keyword is reserved
    vec4 offset = color - vec4(center, p);
    vec3 repeat = abs(offset.xyz / extents);
    repeat.x = max(repeat.x, max(repeat.y, repeat.z));

    if (repeat.x > 1.)
    {
        // `color` is not intersecting (nor inside) the AABB; it's clipped to the closest extent
        return vec4(center, p) + offset / repeat.x;
    }
    else
    {
        // `color` is intersecting (or inside) the AABB.
        // Note: for whatever reason moving this return statement from this else into a higher
        // scope makes the NVIDIA drivers go beyond bonkers
        return color;
    }
}

float IntersectAABB(vec3 rayDir, vec3 rayOrg, vec3 boxExt)
{
    if (length(rayDir) < 1e-6) return 1;

    // Intersection using slabs
    //vec3 rcpDir = rcp(rayDir);
    vec3 rcpDir = 1.0f / rayDir;
    vec3 tNeg = ( boxExt - rayOrg) * rcpDir;
    vec3 tPos = (-boxExt - rayOrg) * rcpDir;
    return max(max(min(tNeg.x, tPos.x), min(tNeg.y, tPos.y)), min(tNeg.z, tPos.z));
}

float ClipHistory(vec3 cHistory, vec3 cM, vec3 cMin, vec3 cMax)
{
    // Clip color difference against neighborhood min/max AABB
    // Clipped color is cHistory + rayDir * result
    
    vec3 boxCenter = (cMax + cMin) * 0.5;
    vec3 boxExtents = cMax - boxCenter;
    
    vec3 rayDir = cM - cHistory;
    vec3 rayOrg = cHistory - boxCenter;
    
    return clamp(IntersectAABB(rayDir, rayOrg, boxExtents), 0.0f, 1.0f);
}

void main()
{             
    const float gamma = 2.2f;
    //vec4 positionWS=vec4(texture(gSpecular,TexCoords).rgb,1);
    //if(LinearizeDepth(texture(sceneDepth,TexCoords).x)>=0.9f)
    //if(texture(sceneDepth,TexCoords).x>=0.999999f) 
    if(true)
    {
    	color=texture(currSSR, TexCoords);
    	//color=vec4(1,0,0,1);
    	return;
    }
    		
    vec4 hitPoint_WS=vec4(texture(ssrHitpoint,TexCoords).xyz,1);
    vec4 hitPoint_VS=preViewMatrix*hitPoint_WS;
    vec4 hitPoint_CS=preProjectionMatrix*hitPoint_VS;
    vec2 prevUV=0.5f*(hitPoint_CS.xy/max(hitPoint_CS.w, 1e-5))+0.5f;

    //vec4 current = texture(currSSR, TexCoords);
	//vec4 previous = texture(prevSSR1, prevUV);

	vec2 du = vec2(1.0f / screenWidth, 0.0);
	vec2 dv = vec2(0.0, 1.0f / screenHeight);

	//vec4 currentTopLeft = texture(currSSR, TexCoords - dv - du);
	//vec4 currentTopCenter = texture(currSSR, TexCoords - dv);
	//vec4 currentTopRight = texture(currSSR, TexCoords - dv + du);
	//vec4 currentMiddleLeft = texture(currSSR, TexCoords - du);
	//vec4 currentMiddleCenter = texture(currSSR, TexCoords);
	//vec4 currentMiddleRight = texture(currSSR, TexCoords + du);
	//vec4 currentBottomLeft = texture(currSSR, TexCoords + dv - du);
	//vec4 currentBottomCenter = texture(currSSR, TexCoords + dv);
	//vec4 currentBottomRight = texture(currSSR, TexCoords + dv + du);

	//vec4 currentMin = min(currentTopLeft, min(currentTopCenter, min(currentTopRight, min(currentMiddleLeft, min(currentMiddleCenter, min(currentMiddleRight, min(currentBottomLeft, min(vec4(currentMiddleCenter), currentBottomRight))))))));
	//vec4 currentMax = max(currentTopLeft, max(currentTopCenter, max(currentTopRight, max(currentMiddleLeft, max(currentMiddleCenter, max(currentMiddleRight, max(currentBottomLeft, max(vec4(currentMiddleCenter), currentBottomRight))))))));

	//float scale = 0.5f;
    vec2 texel = 1.0f/vec2(screenWidth, screenHeight);
    

	vec3 cCenter  = texture(currSSR, TexCoords).xyz;
    if(!temporal) {
        color=vec4(cCenter, 1);
        return;
    }
    cCenter.rgb/=1+Luminance(cCenter.rgb);
    vec3 cN1 = texture(currSSR, TexCoords + texel * vec2(-1.0f, -1.0f)).xyz;
    cN1.rgb/=1+Luminance(cN1.rgb);
    vec3 cN2 = texture(currSSR, TexCoords + texel * vec2( 1.0f, -1.0f)).xyz;
    cN2.rgb/=1+Luminance(cN1.rgb);
    vec3 cN3 = texture(currSSR, TexCoords + texel * vec2(-1.0f,  1.0f)).xyz;
    cN3.rgb/=1+Luminance(cN1.rgb);
    vec3 cN4 = texture(currSSR, TexCoords + texel * vec2( 1.0f,  1.0f)).xyz;
    cN4.rgb/=1+Luminance(cN1.rgb);
    
    vec3 cN5 = texture(currSSR, TexCoords + texel * vec2(-1.0f,  0.0f)).xyz;
    cN5.rgb/=1+Luminance(cN1.rgb);
    vec3 cN6 = texture(currSSR, TexCoords + texel * vec2( 1.0f,  0.0f)).xyz;
    cN6.rgb/=1+Luminance(cN1.rgb);
    vec3 cN7 = texture(currSSR, TexCoords + texel * vec2( 0.0f, -1.0f)).xyz;
    cN7.rgb/=1+Luminance(cN1.rgb);
    vec3 cN8 = texture(currSSR, TexCoords + texel * vec2( 0.0f,  1.0f)).xyz;
    cN8.rgb/=1+Luminance(cN1.rgb);
    
    // Compute color variance
    vec3 m1 = cN1 + cN2 + cN3 + cN4 + cN5 + cN6 + cN7 + cN8 + cCenter;
    vec3 m2 = cN1*cN1 + cN2*cN2 + cN3*cN3 + cN4*cN4 + cN5*cN5 + cN6*cN6 + cN7*cN7 + cN8*cN8 + cCenter*cCenter;
    vec3 mean = m1 / 9;
    vec3 stddev = sqrt(m2 / 9 - mean * mean);
    vec3 cMin = mean - 30.5 * stddev;
    vec3 cMax = mean + 30.5 * stddev;
    
    vec4 cHistory = texture(prevSSR1, prevUV);
    cHistory.rgb/=1+Luminance(cHistory.rgb);
    //cHistory.rgb = FilterHistory(_tex5, tc + v, cbPostAA.screenSize);
    
    //bool offscreen = max(abs((tc.x + v.x) * 2 - 1), abs((tc.y + v.y) * 2 - 1)) >= 1.0;
    float clipLength = 1;
    float neighborDiff = 0;
    
    vec4 prevTL = vec4(0), prevTR = vec4(0), prevBL = vec4(0), prevBR = vec4(0);
    vec4 prevTT = vec4(0), prevBB = vec4(0), prevLL = vec4(0), prevRR = vec4(0);
    clipLength = ClipHistory(cHistory.rgb, cCenter, cMin, cMax);
    
    // Apply color clipping
    cHistory.rgb = mix(cHistory.rgb, cCenter, clipLength);
    
    //float prevBlend = (cHistory.w + prevTL.w + prevTR.w + prevBL.w + prevBR.w + prevTT.w + prevBB.w + prevLL.w + prevRR.w) / 9.0;
    float prevBlend=cHistory.w;
    float currBlend = clamp(neighborDiff * 10, 0.0f, 1.0f) * 0.10 + prevBlend * 0.90;
    //float weight = lerp(0.25, 0.08, clamp(currBlend, 0.0f, 1.0f));
    
    color.rgb = cCenter * (1.0f - TAAresponse) + cHistory.rgb * TAAresponse;
    color.rgb/=1-Luminance(color.rgb);
    //color.rgb=cHistory.rgb;
    //color.rgb=cCenter.rgb;
    color.a = 1;
}