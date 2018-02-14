#version 450

uniform sampler2D historyBuffer;
uniform sampler2D currIteration;
uniform sampler2D prevDepthBuffer;
uniform sampler2D currDepthBuffer;

in vec2 TexCoords;
out vec4 fragColor;

uniform mat4 matPrevViewInv;
uniform mat4 matCurrViewInv;
uniform mat4 matPrevView;
uniform mat4 matProj;
uniform mat4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;
uniform mat4 inversePreProjectionMatrix;
uniform mat4 preProjectionMatrix;

uniform vec4 projInfo;
uniform vec4 clipPlanes;
uniform float frameIndex;

vec3 WorldPosFromDepth(vec2 tex){
    float z = texture(currDepthBuffer, tex).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(tex.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;

    vec4 worldSpacePosition = inverseViewMatrix * viewSpacePosition;

    return worldSpacePosition.xyz;
}

vec3 WorldPosFromDepthPrev(vec2 tex){
    float z = texture(prevDepthBuffer, tex).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(tex.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inversePreProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;

    vec4 worldSpacePosition = matCurrViewInv * viewSpacePosition;

    return worldSpacePosition.xyz;
}

vec3 ViewPosFromDepth(vec2 tex){
    float z = texture(currDepthBuffer, tex).r;
    z = z * 2.0 - 1.0;

    vec4 clipSpacePosition = vec4(tex.xy * 2.0 - 1.0, z, 1.0);
    vec4 viewSpacePosition = inverseProjectionMatrix * clipSpacePosition;

    viewSpacePosition /= viewSpacePosition.w;
    return viewSpacePosition.xyz;
}

vec3 GetWorldPosition(float d, vec2 spos, mat4 viewinv)
{
    vec4 vpos = vec4(1.0);

    // NOTE: depth is linearized
    vpos.z = clipPlanes.x + d * (clipPlanes.y - clipPlanes.x);
    vpos.xy = (spos * projInfo.xy) * vpos.z;
    
    vpos.z = -vpos.z;   // by def

    vec4 wpos = (viewinv * vpos);
    return wpos.xyz;
}

vec3 GetScreenPosition(vec3 wpos, mat4 view, mat4 proj)
{
    vec4 vpos = view * vec4(wpos, 1.0);
    vec4 cpos = proj * vpos;

    float d = (-vpos.z - clipPlanes.x) / (clipPlanes.y - clipPlanes.x);
    return vec3(cpos.xy / cpos.w, d);
}

void main()
{
    vec2 spos = TexCoords * 2.0 - 1.0;

    // unproject to current frame world space
    //float currdepth = texture(currDepthBuffer, TexCoords).r;
    vec3 currpos = WorldPosFromDepth(TexCoords);
    
    

    // reproject to previous frame screen space
    vec4 positionVS=vec4(ViewPosFromDepth(TexCoords), 1.0f);
    vec4 positionCS=preProjectionMatrix*positionVS;
    vec2 prevUV=0.5*(positionCS.xy/positionCS.w)+0.5;

    // unproject to previous frame world space
    //float prevdepth = texture(prevDepthBuffer, temptex).r;
    //vec3 prevpos = GetWorldPosition(prevdepth, tempspos.xy, matPrevViewInv);
    vec3 prevpos = WorldPosFromDepthPrev(prevUV);
    //fragColor = vec4(prevpos, 1.0f);
    //return;
    

    // detect disocclusion
    float dist2 = dot(currpos - prevpos, currpos - prevpos);
    
    // fetch values
    vec2 currAO = texture(currIteration, TexCoords).rg;
    vec2 accumAO = texture(historyBuffer, prevUV).rg;

    float currn = 0.0;
    float prevn = accumAO.y * 6.0;
    float ao = currAO.x;

    if( dist2 < 1e-6 ) { // 1 mm2
        // no disocclusion, continue convergence
        currn = min(prevn + 1.0, 6.0);
        ao = mix(accumAO.x, currAO.x, 1.0 / currn);
    }
    //fragColor = vec4(vec3(currdepth), 1.0f);
    //return;
    //my_FragColor0 = vec2(dist2, 0.0);
    fragColor = vec4(vec3(ao), 1.0f / currn);
}