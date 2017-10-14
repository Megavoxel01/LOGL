#pragma once
#include <RenderPass.h>


class LightCullingPass : public RenderPass {
public:
	LightCullingPass(const float width, const float height, int workGroupX, int workGroupY, const TextureMap& depth);
	~LightCullingPass();
	void init();
	void update(const glm::mat4& view, const glm::mat4 projection, const float NR_LIGHTS);
	void execute();
private:
	Shader TBDR;
	TextureMap rboDepth;
	float mWidth;
	float mHeight;
	int workGroupsX;
	int workGroupsY;
};