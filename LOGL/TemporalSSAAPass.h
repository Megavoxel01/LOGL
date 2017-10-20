#pragma once

#include <RenderPass.h>

class TemporalSsaaPass : public RenderPass{
public:
	TemporalSsaaPass(float width, float height, Scene* scene);
	~TemporalSsaaPass();
	void init();
	void update(
		const glm::mat4& view,
		const glm::mat4& projection,
		const glm::mat4& previousProjection,
		const glm::mat4& previousView,
		const glm::vec3& viewPos,
		float TAAscale,
		float TAAresponse,
		const bool& flagTemporal);
	void execute();
private:
	float mWidth;
	float mHeight;
	Scene* scene;
	Framebuffer linearFBO;
	Shader TAA;
	TextureMap *linearColorBuffer;
	TextureMap *prevColorFrame1;
	TextureMap *gSpecular;
	TextureMap *gNormal;
	TextureMap *BRDFLut;
	TextureMap *rboDepth;
};