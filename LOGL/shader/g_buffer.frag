#version 330 core
layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec4 gAlbedoSpec;

in vec2 TexCoords;
in vec3 FragPos;
in vec3 Normal;
in mat3 TBN;

uniform bool flagMetallic;
uniform bool flagGloss;
uniform float tempRoughness;
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

    gPosition = FragPos;
    gNormal.rgb = (texture2D(material.texture_normal1, TexCoords).xyz * 2.0 - 1.0) * TBN;
    float roughness=texture(material.texture_roughness1, TexCoords).r;
    if(flagGloss)    
        gNormal.a=1.2f-roughness;
    else    
        gNormal.a=roughness;

    if(roughness<=1e-5) gNormal.a=tempRoughness;

    gAlbedoSpec.a = texture(material.texture_specular1, TexCoords).r;
    gAlbedoSpec.rgb = texture(material.texture_diffuse1, TexCoords).rgb;

    if(flagMetallic)
        gAlbedoSpec.rgb*=vec3(1.0f-gAlbedoSpec.a);
    //else
        //gAlbedoSpec.a*=0.3f;


    //gAlbedoSpec.rgb = vec3(texture(material.texture_roughness1, TexCoords).rgb);
    
}

