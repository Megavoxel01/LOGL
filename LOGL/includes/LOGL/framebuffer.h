#pragma once
#include "Utility.h"
class Framebuffer
{
public:
	GLuint bufferID;
	Framebuffer()
	{
		glBindTexture(GL_TEXTURE_2D, 0);
		glGenFramebuffers(1, &bufferID);
	}
	Framebuffer(const GLuint&) = delete;
	~Framebuffer();
	static void DrawBuffer(const GLsizei& n, const GLenum* buffer);
	static void DrawBuffer();
	void Bind() const;
	void Unbind()const;

	void AttachTexture();




};