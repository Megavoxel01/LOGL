#version 430
out vec4 color;
in vec2 TexCoords;

uniform sampler2D hdrBuffer;
uniform sampler2D prevBuffer;
uniform sampler2D gPosition;
uniform sampler2D sceneDepth;
uniform sampler2D gNormal;
uniform sampler2D BRDFLut;


uniform mat4x4 ProjectionMatrix;
uniform mat4 ViewMatrix;

uniform mat4x4 preProjectionMatrix;
uniform mat4x4 preViewMatrix;
uniform mat4x4 inverseViewMatrix;

uniform float screenWidth;
uniform float screenHeight;

uniform bool temporal;
uniform float TAAscale;
uniform float TAAresponse;

uniform vec3 viewPos;

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

void main()
{             
    const float gamma = 2.2f;
    vec4 positionWS=vec4(texture(gPosition,TexCoords).rgb,1);
    //if(LinearizeDepth(texture(sceneDepth,TexCoords).x)>=0.9f)
    if(texture(sceneDepth,TexCoords).x>=0.999999f) 
    {
    	color=texture(hdrBuffer, TexCoords);
    	//color=vec4(1,0,0,1);
    	return;
    }
    		
    vec4 positionVS=preViewMatrix*positionWS;
    vec4 positionCS=preProjectionMatrix*positionVS;
    vec2 prevUV=0.5*(positionCS.xy/positionCS.w)+0.5;

    vec4 current = texture(hdrBuffer, TexCoords);
	vec4 previous = texture(prevBuffer, prevUV);

	vec2 du = vec2(1.0 / screenWidth, 0.0);
	vec2 dv = vec2(0.0, 1.0 / screenHeight);

	vec4 currentTopLeft = texture(hdrBuffer, TexCoords - dv - du);
	vec4 currentTopCenter = texture(hdrBuffer, TexCoords - dv);
	vec4 currentTopRight = texture(hdrBuffer, TexCoords - dv + du);
	vec4 currentMiddleLeft = texture(hdrBuffer, TexCoords - du);
	vec4 currentMiddleCenter = texture(hdrBuffer, TexCoords);
	vec4 currentMiddleRight = texture(hdrBuffer, TexCoords + du);
	vec4 currentBottomLeft = texture(hdrBuffer, TexCoords + dv - du);
	vec4 currentBottomCenter = texture(hdrBuffer, TexCoords + dv);
	vec4 currentBottomRight = texture(hdrBuffer, TexCoords + dv + du);

	vec4 currentMin = min(currentTopLeft, min(currentTopCenter, min(currentTopRight, min(currentMiddleLeft, min(currentMiddleCenter, min(currentMiddleRight, min(currentBottomLeft, min(vec4(currentMiddleCenter), currentBottomRight))))))));
	vec4 currentMax = max(currentTopLeft, max(currentTopCenter, max(currentTopRight, max(currentMiddleLeft, max(currentMiddleCenter, max(currentMiddleRight, max(currentBottomLeft, max(vec4(currentMiddleCenter), currentBottomRight))))))));

	//float scale = 0.5f;

	vec4 center = (currentMin + currentMax) * 0.2f;
	currentMin = (currentMin - center) * TAAscale + center;
	currentMax = (currentMax - center) * TAAscale + center;
	vec4 averageColor=1.0f/9.0f*(currentTopLeft+
		currentTopCenter+currentTopRight+
		currentMiddleLeft+
		currentMiddleCenter+
		currentMiddleRight+
		currentBottomLeft+
		currentBottomCenter+currentBottomRight);

	//previous = clamp(previous, currentMin, currentMax);
	previous = clipToAABB(previous, averageColor.w, currentMin.xyz, currentMax.xyz);
	//vec3 hdrColor;
	color=temporal ? vec4(mix(current,previous,TAAresponse).rgb,1) : texture(hdrBuffer, TexCoords);

    vec3 FragPos = texture(gPosition, TexCoords).rgb;
    vec3 Normal = texture(gNormal, TexCoords).rgb;
    vec3 viewDir  = normalize(viewPos - FragPos);
    float roughness=texture(gNormal, TexCoords).a;
    float NdotV=max(dot(normalize(Normal),normalize(viewDir)),1e-5);
    vec3 FG=texture(BRDFLut,vec2(NdotV,roughness)).xyz;
    color.xyz=(color.xyz*FG.x+vec3(FG.y));
    //color.xyz=vec3(NdotV);

	//hdrColor=temporal ? mix(current,previous,TAAresponse).rgb : texture(hdrBuffer, TexCoords).rgb;

    // reinhard
    // vec3 result = hdrColor / (hdrColor + vec3(1.0));
    // exposure
    //vec3 result = vec3(1.0) - exp(-hdrColor * exposure);
    // also gamma correct while we're at it       
    //result = pow(result, vec3(1.0f / gamma));
    //color = vec4(result, 1.0f);
    //color=previous;
    //color.xyz/=1-Luminance(color.xyz);
}