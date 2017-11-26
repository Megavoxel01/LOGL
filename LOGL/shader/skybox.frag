#version 330 core
in vec3 TexCoords;
out vec4 color;

uniform samplerCube skybox;
uniform samplerCube irradianceMap;

void main()
{    
    color = texture(skybox, TexCoords);
    //color = texture(irradianceMap, TexCoords);
    //color=vec4(0);
}
