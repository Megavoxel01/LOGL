#pragma once
#include <RenderPass.h>
#include <random>

class ScreenSpaceAO : public RenderPass {
public:
	ScreenSpaceAO(float width, float height, Scene *scene);
	~ScreenSpaceAO();
	void init();
	void execute();
	void update(const glm::mat4& projection,
		const glm::mat4& previousProjection,
		const glm::mat4& view,
		const glm::mat4& previousView,
		const float& zoom,
		const float& frameIndex,
		const bool& flagTemporal,
		const float& TAAScale,
		const float& TAAresponse);
	
private:
	float mWidth;
	float mHeight;
	std::vector<glm::vec3> objectPositions;
	Shader shaderSsao;
	Shader shaderGTAOBlur;
	Shader shaderGTAOTemporal;
	Scene *scene;
	Framebuffer ssaoFBO;
	Framebuffer ssaoBlurFBO1;
	Framebuffer ssaoBlurFBO2;
	TextureMap* gNormal;
	TextureMap* gAlbedoSpec;
	TextureMap* rboDepth;
	TextureMap* rboDepthPrev;
	TextureMap* ssaoColor;
	TextureMap* ssaoNormalImage;
	TextureMap* gViewPosition;
	TextureMap* gViewPositionPrev;
	TextureMap* ssaoColorPrev1;
	TextureMap* ssaoAccum;
	glm::mat4 view;
	glm::mat4 projection;
	glm::mat4 previousProjection;
	glm::mat4 previousView;
	glm::vec4 projinfo;
	glm::vec4 clip;
	//unsigned int noiseTexture;
	std::shared_ptr<TextureMap> noiseTexture;
	std::vector<glm::vec3> ssaoKernel;
	std::vector<glm::vec3> ssaoNoise;
	float TAAscale;
	float TAAresponse;
	bool flagTemporal;
	float frameIndex;
	float lerp(float a, float b, float f)
	{
		return a + f * (b - a);
	}

};