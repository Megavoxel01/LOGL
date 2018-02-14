#version 450 core
layout(points) in; 
layout(points, max_vertices = 200) out; 
layout (std430, binding=4) buffer debugSsr
{ 
    vec4 samplePosition[50];
};


void main()
{
	for( int i =0 ; i < 5 ; i++)
	{
		gl_Position.xy = samplePosition[i].xy*20;
		gl_Position.zw = vec2(0, 1).xy;
		//gl_Position = vec4(0.3f + float(i)/500.0f, 0.3f, 0.1f, 1);
		EmitVertex();
		//if(i%2 == 1)
		EndPrimitive();	
	}

	
}