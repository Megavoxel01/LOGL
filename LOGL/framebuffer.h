#pragma once
#include "Utility.h"
#include <vector>
class Framebuffer
{
public:
	GLuint bufferID;
	std::vector<GLuint> textureAttachment;
	Framebuffer()
	{
		glBindTexture(GL_TEXTURE_2D, 0);
		glGenFramebuffers(1, &bufferID);
	}
	Framebuffer(const GLuint&) = delete;
	~Framebuffer();
	static void DrawBuffer(const GLsizei& n, const GLenum* buffer);
	static void DrawBuffer(const GLsizei& n, const std::vector<GLenum>& buffer);
	static void DrawBuffer();
	void Bind() const;
	void Unbind() const;
	void AttachTexture(const int& i, const GLenum& attachmentType, const GLenum& textureType, GLuint textureId);

};