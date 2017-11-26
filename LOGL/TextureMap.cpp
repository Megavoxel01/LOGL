#include "TextureMap.h"

TextureMap::TextureMap(const GLchar* path)
{
	glGenTextures(1, &textureID);
	int width, height,bpp;
	//unsigned char* image = SOIL_load_image(path, &width, &height, 0, SOIL_LOAD_RGB);
	unsigned char* image = stbi_load(path, &width, &height, &bpp, 3);
	mWidth = width;
	mHeight = height;
	glBindTexture(GL_TEXTURE_2D, textureID);
	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
	glGenerateMipmap(GL_TEXTURE_2D);

	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

	//glTexParameterf(GL_TEXTURE_2D, GL_TEXTURE_MAX_ANISOTROPY_EXT, 16.0f);
	glBindTexture(GL_TEXTURE_2D, 0);

	stbi_image_free(image);
}

TextureMap::TextureMap(const int& width, const int& height, const GLenum& internalFormat, const GLenum& format, const GLenum& type, void* data,
		GLenum minFilter, GLenum maxFilter, GLenum wrapS, GLenum wrapT)
	:mWidth(width), mHeight(height), mInternel(internalFormat),mFormat(format), mType(type)
{
	glGenTextures(1, &textureID);

	glBindTexture(GL_TEXTURE_2D, textureID);
	glTexImage2D(GL_TEXTURE_2D, 0, mInternel, mWidth, mHeight, 0, format, type, data);
	glGenerateMipmap(GL_TEXTURE_2D);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, wrapS);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, wrapT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, minFilter);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, maxFilter);
	glBindTexture(GL_TEXTURE_2D, 0);
}

void TextureMap::loadTexture(GLchar* path)
{
	glGenTextures(1, &textureID);
	int width, height, bpp;
	//unsigned char* image = SOIL_load_image(path, &width, &height, 0, SOIL_LOAD_RGB);
	unsigned char* image = stbi_load(path, &width, &height, &bpp, 3);
	// Assign texture to ID
	glBindTexture(GL_TEXTURE_2D, textureID);
	glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
	glGenerateMipmap(GL_TEXTURE_2D);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glBindTexture(GL_TEXTURE_2D, 0);
	stbi_image_free(image);
}
