#pragma once
#include <RenderPass.h>

class HiZDepthPass : public RenderPass {
public:
	HiZDepthPass(float width, float height, const TextureMap& depth);
	~HiZDepthPass();

	void init();
	void update();
	void execute();

	
private:
	float mWidth;
	float mHeight;
	Shader hiZ;
	Framebuffer hizFBO;
	TextureMap rboDepth;
};