#include "framebuffer.h"

Framebuffer::~Framebuffer()
{
	glDeleteFramebuffers(1, &bufferID);
}

void Framebuffer::DrawBuffer(const GLsizei& n, const GLenum* buffer)
{
	glDrawBuffers(n, buffer);
}

void Framebuffer::DrawBuffer()
{
	glDrawBuffer(GL_NONE);
}

void Framebuffer::Bind()const
{
	glBindBuffer(GL_FRAMEBUFFER, bufferID);
}

void Framebuffer::Unbind()const
{
	glBindBuffer(GL_FRAMEBUFFER, 0);
}

