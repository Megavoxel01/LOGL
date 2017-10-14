#pragma once
#include <RenderPass.h>
class GBufferPass : public RenderPass {
public:
	GBufferPass(float width, float height, const TextureMap& gSpecular, const TextureMap& gNormal, const TextureMap& gAlbedoSpec, const TextureMap& rboDepth);
	~GBufferPass();

	void init();
	void update(const glm::mat4& view, const glm::mat4& projection);
	void execute();
private:
	float mWidth;
	float mHeight;
	Shader shaderGeometryPass;
	Framebuffer gBuffer;
	TextureMap gSpecular;
	TextureMap gNormal;
	TextureMap gAlbedoSpec;
	TextureMap rboDepth;
	glm::mat4 view;
	glm::mat4 projection;

};