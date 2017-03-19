#pragma once
#include "Utility.h"


class TextureMap {
public:
	GLuint textureID;
	
	TextureMap(): textureID(0) {}
	~TextureMap() { glDeleteTextures(1, &textureID); }

	explicit TextureMap(const GLchar* path);
	TextureMap(const int& width, const int& height, 
				const GLenum& internalFormat,const GLenum& format,const GLenum& type, void* data,
				GLenum minFilter,GLenum maxFilter,GLenum wrapS, GLenum wrapT);
	TextureMap(const TextureMap&) = delete;

	void loadTexture(GLchar* path);

private:
	int mWidth;
	int mHeight;
	GLenum mFormat;
	GLenum mInternel;
	GLenum mType;
	GLenum mMinFilter;
	GLenum mMaxFilter;
	GLenum mWrapS = GL_REPEAT;
	GLenum mWrapT = GL_REPEAT;
	GLenum mWrapR = GL_REPEAT;
	

	// Convenience cast.
	/*operator GLuint() const { return textureID; }*/
};