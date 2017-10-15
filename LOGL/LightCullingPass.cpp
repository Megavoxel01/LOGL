#include <LightCullingPass.h>

LightCullingPass::LightCullingPass(const float width, const float height, int workGroupsX, int workGroupsY, Scene *scene) :
	mWidth(width),
	mHeight(height),
	workGroupsX(workGroupsX),
	workGroupsY(workGroupsY),
	TBDR("shader/TBDR.comp", Shader::Type::CS)
{
	rboDepth = scene->getTextureMap("rboDepth");
}


LightCullingPass::~LightCullingPass() {

}

void LightCullingPass::init() {
	TBDR.Use();
	glUniform1i(glGetUniformLocation(TBDR.Program, "depthMap"), 0);
}

void LightCullingPass::update(const glm::mat4& view, const glm::mat4 projection, const float NR_LIGHTS) {
	TBDR.Use();
	TBDR.SetUniform("view", view);
	TBDR.SetUniform("projection", projection);
	TBDR.SetUniform("screenSize", glm::vec2(mWidth, mHeight));
	TBDR.SetUniform("lightCount", (int)NR_LIGHTS);
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
}

void LightCullingPass::execute() {
	glDispatchCompute(workGroupsX, workGroupsY, 1);
}