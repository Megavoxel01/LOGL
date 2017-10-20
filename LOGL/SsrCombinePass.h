#pragma once

#include <RenderPass.h>

class SsrCombinePass : public RenderPass {
public:
	SsrCombinePass(Scene *scene);
	~SsrCombinePass();
	void init();
	void update();
	void execute();
private:
	Shader ssrCombine;
	Scene *scene;
	Framebuffer linearFBO;
	TextureMap *currSSR;
	TextureMap *linearColorBuffer;

};