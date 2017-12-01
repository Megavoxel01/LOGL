#version 330 core
in vec3 WorldPos;
out vec4 color;

uniform samplerCube skybox;
uniform samplerCube irradianceMap;

void main()
{    
    vec3 envColor = textureLod(skybox, WorldPos, 0.0).rgb;
    envColor = envColor / (envColor + vec3(1.0));
    envColor = pow(envColor, vec3(1.0/2.2)); 
    color = vec4(envColor, 1.0);
    //color = texture(irradianceMap, TexCoords);
    //color=vec4(0);
}
