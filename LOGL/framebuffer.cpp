#include "framebuffer.h"

Framebuffer::~Framebuffer() {
	glDeleteFramebuffers(1, &bufferID);
}

void Framebuffer::DrawBuffer(const GLsizei& n, const GLenum* buffer) {
	glDrawBuffers(n, buffer);
}

void Framebuffer::DrawBuffer(const GLsizei& n, const std::vector<GLenum>& buffer) {
	glDrawBuffers(n, &buffer[0]);
}


void Framebuffer::DrawBuffer() {
	glDrawBuffer(GL_NONE);
}

void Framebuffer::Bind() const {
	glBindBuffer(GL_FRAMEBUFFER, bufferID);
}

void Framebuffer::Unbind() const {
	glBindBuffer(GL_FRAMEBUFFER, 0);
}

void Framebuffer::AttachTexture(const int& i, const GLenum& textureType, GLuint textureId) {
	glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, textureType, textureId, 0);
	textureAttachment.push_back(textureId);
}

