#version 450

uniform sampler2D gtao;
uniform sampler2D depth;

uniform vec2 invRes;

in vec2 tex;
out vec4 fragColor;

float BlurFunction(inout float totalweight, vec2 uv, float d0)
{
	float ao = texture(gtao, uv * invRes).r;
	float d = texture(depth, uv * invRes).r;

	float w = max(0.0, 0.1 - abs(d - d0)) * 30.0;
	totalweight += w;

	return ao * w;
}

void main()
{
	vec2 center = gl_FragCoord.xy - vec2(2.0);
	ivec2 loc = ivec2(center);

	float ao0 = texelFetch(gtao, loc, 0).r;
	float d0 = texelFetch(depth, loc, 0).r;
	float totalweight = 1.0;
	float totalao = ao0;

	totalao += BlurFunction(totalweight, center + vec2(1, 0), d0);
	totalao += BlurFunction(totalweight, center + vec2(2, 0), d0);
	totalao += BlurFunction(totalweight, center + vec2(3, 0), d0);

	totalao += BlurFunction(totalweight, center + vec2(0, 1), d0);
	totalao += BlurFunction(totalweight, center + vec2(1, 1), d0);
	totalao += BlurFunction(totalweight, center + vec2(2, 1), d0);
	totalao += BlurFunction(totalweight, center + vec2(3, 1), d0);

	totalao += BlurFunction(totalweight, center + vec2(0, 2), d0);
	totalao += BlurFunction(totalweight, center + vec2(1, 2), d0);
	totalao += BlurFunction(totalweight, center + vec2(2, 2), d0);
	totalao += BlurFunction(totalweight, center + vec2(3, 2), d0);

	totalao += BlurFunction(totalweight, center + vec2(0, 3), d0);
	totalao += BlurFunction(totalweight, center + vec2(1, 3), d0);
	totalao += BlurFunction(totalweight, center + vec2(2, 3), d0);
	totalao += BlurFunction(totalweight, center + vec2(3, 3), d0);

	fragColor = vec4(vec3(totalao / totalweight), 1.0f);
}