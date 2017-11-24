#pragma once

#include <RenderPass.h>

class SsrCombinePass : public RenderPass {
public:
	SsrCombinePass(Scene *scene);
	~SsrCombinePass();
	void init();
	void update(glm::vec3& viewPos, glm::mat4& view, glm::mat4& projection);
	void execute();
private:
	Shader ssrCombine;
	Scene *scene;
	Framebuffer linearFBO;
	TextureMap *currSSR;
	TextureMap *linearColorBuffer;
	TextureMap *gSpecular;
	TextureMap *gNormal;
	TextureMap *BRDFLut;
	TextureMap *rboDepth;

};