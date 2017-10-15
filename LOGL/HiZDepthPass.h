#pragma once
#include <RenderPass.h>

class HiZDepthPass : public RenderPass {
public:
	HiZDepthPass(float width, float height, Scene* scene);
	~HiZDepthPass();

	void init();
	void update();
	void execute();

	
private:
	Scene *scene;
	float mWidth;
	float mHeight;
	Shader hiZ;
	Framebuffer hizFBO;
	TextureMap* rboDepth;
};