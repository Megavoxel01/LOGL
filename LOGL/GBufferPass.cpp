#include <GBufferPass.h>


GBufferPass::GBufferPass(float width, float height, const TextureMap& gSpecular, const TextureMap& gNormal, const TextureMap& gAlbedoSpec, const TextureMap& rboDepth):
	mWidth(width), mHeight(height),
	shaderGeometryPass("shader/g_buffer.vert", "shader/g_buffer.frag")
{
	this->gSpecular = gSpecular;
	this->gNormal = gNormal;
	this->gAlbedoSpec = gAlbedoSpec;
	this->rboDepth = rboDepth;

}

GBufferPass::~GBufferPass() {

}

void GBufferPass::init() {
	gBuffer.Bind();
	gBuffer.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gSpecular.textureID);
	gBuffer.AttachTexture(1, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gNormal.textureID);
	gBuffer.AttachTexture(2, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gAlbedoSpec.textureID);
	GLuint attachments[3] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2 };
	gBuffer.DrawBuffer(3, attachments);

	gBuffer.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth.textureID);
	gBuffer.Unbind();
}

void GBufferPass::update(const glm::mat4& view, const glm::mat4& projection) {
	this->view = view;
	this->projection = projection;
}

void GBufferPass::execute() {
}
