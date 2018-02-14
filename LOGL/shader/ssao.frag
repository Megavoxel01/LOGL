#version 430 core
out vec4 color;

in vec2 TexCoords;

uniform sampler2D sceneDepth;
uniform sampler2D gNormal;
uniform sampler2D texNoise;
//uniform sampler2D gViewPosition;

uniform float screenWidth;
uniform float screenHeight;
uniform mat4 projection;
uniform mat4 ViewMatrix;
uniform mat4 inverseProjectionMatrix;
uniform mat4 inverseViewMatrix;
uniform vec3 offsets[128];
// parameters (you'd probably want to use them as uniforms to more easily tweak the effect)
const int kernelSize = 64;
float radius = 0.5;
float bias = 0;


float rand(vec2 co){
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}



// tile noise texture over screen based on screen dimensions divided by noise size
const vec2 noiseScale = vec2(screenWidth/4.0, screenHeight/4.0); 

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

float CalcViewZ()
{
    float Depth = texture(sceneDepth, TexCoords).r;
    float ViewZ = projection[3][2] / (2 * Depth -1 - projection[2][2]);
    return -ViewZ-1;
}

void main()
{
    // get input for SSAO algorithm
    vec3 fragPos = ViewPosFromDepth();
    //vec3 fragPos = texture(gViewPosition, TexCoords).xyz;
    vec3 normal = normalize(texture(gNormal, TexCoords).rgb);
    normal = (ViewMatrix * vec4(normal.xyz, 0)).xyz;
    vec3 randomVec = normalize(texture(texNoise, TexCoords * noiseScale).xyz);
    //vec3 randomVec = offsets[int(screenWidth * TexCoords.x)%16];
    //randomVec.z = 0.0f;
    // create TBN change-of-basis matrix: from tangent-space to view-space
    vec3 tangent = normalize(randomVec - normal * dot(randomVec, normal));
    vec3 bitangent = cross(normal, tangent);
    mat3 TBN = mat3(tangent, bitangent, normal);
    // iterate over the sample kernel and calculate occlusion factor
    vec3 occlusion = vec3(0.0);
    vec4 offset;
    vec3 ssao_sample;
    vec3 ssample;
    float sampleDepth;
    for(int i = 0; i < kernelSize; ++i)
    {
        // get sample position
        ssample = TBN * offsets[i]; // from tangent to view-space
        ssample = fragPos + ssample * radius; 
        
        // project sample position (to sample texture) (to get position on screen/texture)
        vec4 offset = vec4(ssample, 1.0);
        offset = projection * offset; // from view to clip-space
        offset.xyz /= offset.w; // perspective divide
        offset.xyz = offset.xyz * 0.5 + 0.5; // transform to range 0.0 - 1.0
        
        // get sample depth
        //sampleDepth = -CalcViewZ(); // get depth value of kernel sample
        sampleDepth = ViewPosFromDepthOffset(offset.xy).z;
        if(isnan(sampleDepth)) sampleDepth = -1000;
        //sampleDepth = texture(gViewPosition, offset.xy).x;
        if(i==4)
        {
            color = vec4(vec3(sampleDepth), 1.0f);
            //return;
        }

        // range check & accumulate
        float rangeCheck = smoothstep(0.0, 1.0, radius / abs(fragPos.z - sampleDepth));
        occlusion += (sampleDepth >= ssample.z + bias ? 1.0 : 0.0) * rangeCheck;           
    }
    occlusion = vec3(1.0) - (occlusion / kernelSize);
    //occlusion = vec3(0.5);
    
    //FragColor = vec4(0.5f);
    color = vec4(occlusion, 1.0f);
}