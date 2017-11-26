#pragma once

#include <RenderPass.h>
#include <random>

class DeferredShadingPass : public RenderPass{
public:	
	DeferredShadingPass(float width, float height, float workGroupsX, Scene* scene, GLuint _irradianceMap);
	~DeferredShadingPass();
	void init();
	void update(
		const glm::mat4& view,
		const glm::mat4& projection,
		const glm::mat4& previousProjection,
		const glm::mat4& previousView,
		const glm::mat4& lightSpaceMatrix,
		const glm::vec3& viewPos,
		const glm::vec3& lightPos,
		const float& tempRoughness,
		const float& currentFrameIndex,
		const float& resolve,
		const float& binaryIteration,
		const float& pixelStride,
		const int& depthLevel,
		const float& initStep,
		const float& sampleBias,
		const bool& flagShadowMap
		);
	void execute();

private:
	int mWidth;
	int mHeight;
	int mWorkGroupsX;
	GLuint irradianceMap;
	Shader shaderLightingPass;
	glm::mat4 view;
	glm::mat4 projection;
	glm::mat4 previousView;
	glm::mat4 previousProjection;

	Framebuffer linearFBO;
	TextureMap *linearColorBuffer;
	TextureMap *gSpecular;
	TextureMap *gNormal;
	TextureMap *gAlbedoSpec;
	TextureMap *depthMap;
	TextureMap *rboDepth;
	TextureMap *prevColorFrame1;
	TextureMap *blueNoiseTex;
	TextureMap *BRDFLut;
	Scene *scene;
	glm::vec3 viewPos;

	std::random_device rd;
	std::mt19937 mt;
	std::uniform_real_distribution<float> dist;
};