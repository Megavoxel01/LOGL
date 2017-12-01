
#version 330 core
layout (location = 0) in vec3 position;
out vec3 WorldPos;

uniform mat4 projection;
uniform mat4 view;


void main()
{
    WorldPos = position;

	mat4 rotView = mat4(mat3(view));
	vec4 clipPos = projection * rotView * vec4(WorldPos, 1.0);

	gl_Position = clipPos.xyww;
}