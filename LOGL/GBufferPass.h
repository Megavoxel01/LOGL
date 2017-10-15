#pragma once
#include <RenderPass.h>
class GBufferPass : public RenderPass {
public:
	GBufferPass(float width, float height, Scene *scene);
	~GBufferPass();

	void init();
	void update(const glm::mat4& view, const glm::mat4& projection, std::vector<glm::vec3>& objectPositions);
	void execute();
private:
	float mWidth;
	float mHeight;
	std::vector<glm::vec3> objectPositions;
	Shader shaderGeometryPass;
	Scene *scene;
	Framebuffer gBuffer;
	TextureMap* gSpecular;
	TextureMap* gNormal;
	TextureMap* gAlbedoSpec;
	TextureMap* rboDepth;
	glm::mat4 view;
	glm::mat4 projection;

};