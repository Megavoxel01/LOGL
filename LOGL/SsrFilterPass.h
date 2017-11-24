#pragma once

#include <RenderPass.h>

class SsrFilterPass : public RenderPass{
public:
	SsrFilterPass(float width, float height, Scene* scene);
	~SsrFilterPass();
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
	Framebuffer SSRColorFBO;
	Shader ssrFilter;
	TextureMap *currSSR;
	TextureMap *prevSSR1;
	TextureMap *gSpecular;
	TextureMap *gNormal;
	TextureMap *BRDFLut;
	TextureMap *rboDepth;
	TextureMap *SSRHitPoint;
};