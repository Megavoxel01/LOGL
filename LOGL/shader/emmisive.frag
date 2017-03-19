#version 330 core
//layout (location = 0) out vec3 ePosition;

in vec2 TexCoords;
in vec3 FragPos;


struct Material
{
    
    sampler2D texture_diffuse1;
    sampler2D texture_specular1;
    sampler2D texture_normal1;
    sampler2D texture_roughness1;
    float smoothness;
};

uniform Material material;

void main()
{    

    //ePosition = FragPos;
}

