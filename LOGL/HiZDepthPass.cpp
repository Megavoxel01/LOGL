#include <HiZDepthPass.h>

HiZDepthPass::HiZDepthPass(float width, float height, const TextureMap& depth) :
	mWidth(width),
	mHeight(height),
	hiZ("shader/HiZ.vert", "shader/HiZ.frag")
{
	rboDepth = depth;
}

HiZDepthPass::~HiZDepthPass() {

}

void HiZDepthPass::init() {
	hiZ.Use();
	glUniform1i(glGetUniformLocation(hiZ.Program, "LastMip"), 0);

	hizFBO.Bind();
	hizFBO.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth.textureID);
	hizFBO.Unbind();
}

void HiZDepthPass::update() {
	hizFBO.Bind();
	hiZ.Use();
	glDepthFunc(GL_ALWAYS);
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, rboDepth.textureID);
}

void HiZDepthPass::execute() {
	int numLevels = 1 + (int)floorf(log2f(fmaxf(mWidth, mHeight)));
	int currentWidth = mWidth;
	int currentHeight = mHeight;
	for (int i = 1; i<numLevels; i++) {
		hiZ.SetUniform("LastMipSize", glm::ivec2(currentWidth, currentHeight));
		hiZ.SetUniform("level", i);
		glm::vec2 offsets;
		offsets.x = (currentWidth % 2 == 0 ? 1 : 2);
		offsets.y = (currentHeight % 2 == 0 ? 1 : 2);
		hiZ.SetUniform("offsets", offsets);
		currentWidth /= 2;
		currentHeight /= 2;
		currentWidth = currentWidth > 0 ? currentWidth : 1;
		currentHeight = currentHeight > 0 ? currentHeight : 1;
		glViewport(0, 0, currentWidth, currentHeight);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, i - 1);
		glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, i - 1);
		glFramebufferTexture2D(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth.textureID, i);
		RenderBufferQuad();
	}
	numLevels = std::min(numLevels, 7);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_BASE_LEVEL, 0);
	glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAX_LEVEL, numLevels - 1);
	glViewport(0, 0, mWidth, mHeight);
}
