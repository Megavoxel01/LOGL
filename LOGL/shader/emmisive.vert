#version 330 core
layout (location = 0) in vec3 position;
layout (location = 1) in vec3 normal;
layout (location = 2) in vec2 texCoords;
layout (location = 3) in vec3 tangent;
layout (location = 4) in vec3 bitangent;

out vec3 FragPos;
out vec2 TexCoords;


uniform mat4 model;
uniform mat4 view;
uniform mat4 fov2projection;

void main()
{
    vec4 worldPos = model * vec4(position, 1.0f);
    FragPos = worldPos.xyz; 
    gl_Position = fov2projection * view * worldPos;
    TexCoords = texCoords;


}