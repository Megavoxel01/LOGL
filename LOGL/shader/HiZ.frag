#version 400 core

uniform sampler2D LastMip;
uniform ivec2 LastMipSize;
uniform int level;
uniform vec2 offsets;

in vec2 TexCoords;

void main()
{
  vec4 texels;
  float maxZ1;
  float maxZ2;
  texels.x = texture( LastMip, TexCoords ).x;
  texels.y = textureOffset( LastMip, TexCoords, ivec2(offsets.x, 0) ).x;
  texels.z = textureOffset( LastMip, TexCoords, ivec2(offsets.x,offsets.y) ).x;
  texels.w = textureOffset( LastMip, TexCoords, ivec2(0,offsets.y) ).x;
  //int level=0;

  //texels.x = texelFetch( LastMip, ivec2(TexCoords*LastMipSize), level-1).x;
  //texels.y = texelFetch( LastMip, ivec2(TexCoords*LastMipSize)+ivec2(1,0), level-1).x;
  //texels.z = texelFetch( LastMip, ivec2(TexCoords*LastMipSize)+ivec2(1,1), level-1).x;
  //texels.w = texelFetch( LastMip, ivec2(TexCoords*LastMipSize)+ivec2(0,1), level-1).x;


  float maxZ = min( min( texels.x, texels.y ), min( texels.z, texels.w ) );
/*
  vec3 extra;
  // if we are reducing an odd-width texture then fetch the edge texels
  if ( ( (LastMipSize.x & 1) != 0 ) && ( int(gl_FragCoord.x) == LastMipSize.x-3 ) ) {
    // if both edges are odd, fetch the top-left corner texel
    if ( ( (LastMipSize.y & 1) != 0 ) && ( int(gl_FragCoord.y) == LastMipSize.y-3 ) ) {
      extra.z = textureOffset( LastMip, TexCoords, ivec2( 1, 1) ).x;
      maxZ = min( maxZ, extra.z );
    }
    extra.x = textureOffset( LastMip, TexCoords, ivec2( 1, 0) ).x;
    extra.y = textureOffset( LastMip, TexCoords, ivec2( 1,-1) ).x;
    maxZ= min( maxZ, min( extra.x, extra.y ) );
  } else
  // if we are reducing an odd-height texture then fetch the edge texels
  if ( ( (LastMipSize.y & 1) != 0 ) && ( int(gl_FragCoord.y) == LastMipSize.y-3 ) ) {
    extra.x = textureOffset( LastMip, TexCoords, ivec2( 0, 1) ).x;
    extra.y = textureOffset( LastMip, TexCoords, ivec2(-1, 1) ).x;
    maxZ = min( maxZ, min( extra.x, extra.y ) );
  }
  */

  gl_FragDepth = maxZ;
}