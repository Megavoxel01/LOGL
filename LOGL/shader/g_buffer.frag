#version 450 core
layout (location = 0) out vec3 gSpecular;
layout (location = 1) out vec4 gNormal;
layout (location = 2) out vec3 gAlbedoSpec;
layout (location = 3) out float gViewPosition;

in vec2 TexCoords;
//in vec3 FragPos;
in vec3 Normal;
in mat3 TBN;
in vec3 viewPos;

uniform bool flagMetallic;
uniform bool flagGloss;
uniform float tempRoughness;
uniform bool hasNormal;
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

    //gSpecular = FragPos;
    if (hasNormal == false){
        gNormal.rgb = normalize(Normal);
    }else{
        gNormal.rgb = (texture2D(material.texture_normal1, TexCoords).xyz * 2.0 - 1.0) * TBN;
    }
    
    float roughness=texture(material.texture_roughness1, TexCoords).r;
    if(flagGloss)    
        gNormal.a=1.0f-roughness;
    else    
        gNormal.a=roughness;

    //if(roughness<=1e-5) gNormal.a=tempRoughness;

    gAlbedoSpec.rgb = texture(material.texture_diffuse1, TexCoords).rgb;
    //gAlbedoSpec.rgb = pow(abs(gAlbedoSpec.rgb), vec3(0.454545f));

    if(flagMetallic){
        float metalness = texture(material.texture_specular1, TexCoords).r;
        gSpecular.rgb = mix(vec3(0.03), gAlbedoSpec.rgb, metalness);
        gAlbedoSpec.rgb = gAlbedoSpec.rgb*(1.0f - metalness);
    }        
    else{
        gSpecular = texture(material.texture_specular1, TexCoords).rgb;
    }

    gViewPosition = (-viewPos.z - 0.1f) / (50.0f - 0.1f );


    //gAlbedoSpec.rgb = vec3(texture(material.texture_roughness1, TexCoords).rgb);
    
}

