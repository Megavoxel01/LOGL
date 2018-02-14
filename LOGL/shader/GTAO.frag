#version 450

#define PI				3.1415926535897932
#define PI_DOUBLE		6.2831853071795864
#define PI_HALF			1.5707963267948966
#define ONE_OVER_PI		0.3183098861837906

#ifndef NUM_STEPS
#define NUM_STEPS		8
#endif

#define RADIUS			2.0		// in world space

uniform sampler2D sceneDepth;
uniform sampler2D gNormal;
uniform sampler2D texNoise;

uniform vec4 projInfo;
uniform vec4 clipInfo;
uniform vec2 invRes;
uniform vec4 params;
uniform mat4 viewMatrix;
uniform mat4 projection;
uniform mat4 inverseProjectionMatrix;

in vec2 TexCoords;

out vec4 fragColor;


float FastSqrt(float x)
{
	return intBitsToFloat(
		0x1fbd1df5+
		(floatBitsToInt(x)>>1));
}

float FastAcos(float x)
{
    float res = -0.156583 * abs( x ) + PI / 2.0;
    res *= FastSqrt( 1.0 - abs( x ) );
    return x >= 0 ? res : PI - res;
}


vec3 ViewPosFromDepth(){
    float z = texture(sceneDepth, TexCoords).r;
    //if(z <= 0.0) z = 10000;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(TexCoords.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;
    return viewSpacePosition.xyz;
}

vec3 ViewPosFromDepthOffset(vec2 offset){
    float z = texture(sceneDepth, offset).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(offset.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;
    return viewSpacePosition.xyz;
}

vec4 GetViewPosition(vec2 uv)
{
	float d = texture(sceneDepth, uv * invRes).r;
	vec4 ret = vec4(0.0, 0.0, 0.0, d);

	ret.z = clipInfo.x + d * (clipInfo.y - clipInfo.x);
	ret.xy = (uv * projInfo.xy + projInfo.zw) * ret.z;

	return ret;
}

float Falloff(float dist2, float cosh)
{
#define FALLOFF_START2	0.16
#define FALLOFF_END2	4.0

#ifdef NUM_DIRECTIONS
	return 0.0;	// disable falloff for reference
#else
	return  2.0 * clamp((dist2 - FALLOFF_START2) / (FALLOFF_END2 - FALLOFF_START2), 0.0, 1.0);
#endif
}

void main()
{
	ivec2 loc = ivec2(gl_FragCoord.xy);
	vec4 vpos = GetViewPosition(gl_FragCoord.xy);
	if( vpos.z >= 50.0 ) {
		fragColor = vec4(1.0);
		return;
	}

	vec4 s;
	vec3 wnorm	= texelFetch(gNormal, loc, 0).rgb;
	vec3 vnorm = (viewMatrix *  vec4(wnorm, 0.0f)).xyz;	
	vec3 vdir	= normalize(-vpos.xyz);
	vec3 dir, ws;

	// calculation uses left handed system
	vnorm.z = -vnorm.z;

	vec2 noises	= texelFetch(texNoise, loc % 4, 0).rg;
	vec2 offset;
	vec2 horizons = vec2(-1.0, -1.0);

	float radius = (RADIUS * clipInfo.z) / vpos.z;

	radius = max(NUM_STEPS, radius);
	//radius = min(1.0 / (2.0 * invRes.y), radius);

	float stepsize	= radius / NUM_STEPS;
	float phi		= (params.x + noises.x) * PI;
	float ao		= 0.0;
	float currstep	= mod(params.y + noises.y, 1.0) * (stepsize - 1.0) + 1.0;
	float dist2, invdist, falloff, cosh;
	//fragColor = vec4(vec3(radius), 1.0f);
	//return;

#ifdef NUM_DIRECTIONS
	for( int k = 0; k < NUM_DIRECTIONS; ++k ) {
		phi = float(k) * (PI / NUM_DIRECTIONS);
		currstep = 1.0;
#endif

		dir = vec3(cos(phi), sin(phi), 0.0);
		horizons = vec2(-1.0);

		// calculate horizon angles
		for( int j = 0; j < NUM_STEPS; ++j ) {
			offset = round(dir.xy * currstep);
			currstep += stepsize;

			s = GetViewPosition(gl_FragCoord.xy + offset);
			ws = s.xyz - vpos.xyz;

			dist2 = dot(ws, ws);

			invdist = inversesqrt(dist2);
			cosh = invdist * dot(ws, vdir);
			

			falloff = Falloff(dist2, cosh);
			horizons.x = max(horizons.x, cosh - falloff);

			s = GetViewPosition(gl_FragCoord.xy - offset);
			ws = s.xyz - vpos.xyz;

			dist2 = dot(ws, ws);
			invdist = inversesqrt(dist2);
			cosh = invdist * dot(ws, vdir);

			falloff = Falloff(dist2, cosh);
			horizons.y = max(horizons.y, cosh - falloff);
		}
		
		horizons.x = FastAcos(horizons.x);
		horizons.y = FastAcos(horizons.y);

		// calculate gamma
		vec3 bitangent	= normalize(cross(dir, vdir));
		vec3 tangent	= cross(vdir, bitangent);
		vec3 nx			= vnorm - bitangent * dot(vnorm, bitangent);

		float nnx		= length(nx);
		float invnnx	= 1.0 / (nnx + 1e-6);			// to avoid division with zero
		float cosxi		= dot(nx, tangent) * invnnx;	// xi = gamma + PI_HALF
		float gamma		= FastAcos(cosxi) - PI_HALF;
		float cosgamma	= dot(nx, vdir) * invnnx;
		float singamma2	= -2.0 * cosxi;					// cos(x + PI_HALF) = -sin(x)

		// clamp to normal hemisphere
		horizons.x = gamma + max(-horizons.x - gamma, -PI_HALF);
		horizons.y = gamma + min(horizons.y - gamma, PI_HALF);

		// Riemann integral is additive
		ao += nnx * 0.25 * (
			(horizons.x * singamma2 + cosgamma - cos(2.0 * horizons.x - gamma)) +
			(horizons.y * singamma2 + cosgamma - cos(2.0 * horizons.y - gamma)));

#ifdef NUM_DIRECTIONS
	}

	// PDF = 1 / pi and must normalize with pi as of Lambert
	ao = ao / float(NUM_DIRECTIONS);
	fragColor = vec4(ao, ao, ao, 1.0);
#else
	fragColor = vec4(ao, ao, ao, 1.0f);
#endif
}