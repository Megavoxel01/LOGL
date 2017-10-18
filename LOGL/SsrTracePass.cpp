#include <SsrTracePass.h>

SsrTracePass::SsrTracePass(float width, float height, Scene *scene):
	ssrTrace("shader/ssrTrace.vert", "shader/ssrTrace.frag"),
	mWidth(width),
	mHeight(height),
	mt(rd()),
	dist(1.0, 1000.0)
{
	this->scene = scene;
	this->gSpecular = scene->getTextureMap("gSpecular");
	this->gNormal = scene->getTextureMap("gNormal");
	this->gAlbedoSpec = scene->getTextureMap("gAlbedoSpec");
	this->rboDepth = scene->getTextureMap("rboDepth");
	this->depthMap = scene->getTextureMap("depthMap");
	this->prevColorFrame1 = scene->getTextureMap("prevColorFrame1");
	this->blueNoiseTex = scene->getTextureMap("blueNoiseTex");
	this->BRDFLut = scene->getTextureMap("BRDFLut");
	this->SSRHitPoint = scene->getTextureMap("SSRHitPoint");

}

SsrTracePass::~SsrTracePass(){

}

void SsrTracePass::init(){
	this->SSRHitpointFBO.Bind();
	this->SSRHitpointFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, SSRHitPoint->textureID);

	ssrTrace.Use();
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "gSpecular"), 0);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "gNormal"), 1);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "gAlbedoSpec"), 2);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "shadowMap"), 3);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "sceneDepth"), 4);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "prevFrame1"), 5);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "blueNoise"), 6);
	glUniform1i(glGetUniformLocation(ssrTrace.Program, "BRDFLut"), 7);
	SSRHitpointFBO.Unbind();
}

void SsrTracePass::update(
	const glm::mat4& view, 
	const glm::mat4& projection, 
	const glm::mat4& previousProjection,
	const glm::mat4& previousView, 
	const glm::vec3& viewPos, 
	const float& tempRoughness, 
	const float& currentFrameIndex, 
	const float& resolve, 
	const float& binaryIteration, 
	const float& pixelStride, 
	const int& depthLevel, 
	const float& initStep,
	const float& sampleBias, 
	const bool& flagHiZ
	){

	
	SSRHitpointFBO.Bind();
	ssrTrace.Use();
	ssrTrace.SetUniform("flagShadowMap", false);
	ssrTrace.SetUniform("ProjectionMatrix", projection);
	ssrTrace.SetUniform("ViewMatrix", view);
	ssrTrace.SetUniform("preProjectionMatrix", previousProjection);
	ssrTrace.SetUniform("preViewMatrix", previousView);
	ssrTrace.SetUniform("inverseViewMatrix", glm::inverse(view));
	ssrTrace.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	ssrTrace.SetUniform("extRand1", dist(mt));
	ssrTrace.SetUniform("tempRoughness", tempRoughness);
	ssrTrace.SetUniform("frameIndex", currentFrameIndex);
	ssrTrace.SetUniform("resolve", resolve);
	ssrTrace.SetUniform("binaryIteration", binaryIteration);
	ssrTrace.SetUniform("inputStride", pixelStride);
	ssrTrace.SetUniform("screenWidth", (float)mWidth);
	ssrTrace.SetUniform("screenHeight", (float)mHeight);
	ssrTrace.SetUniform("mipLevel", (float)depthLevel);
	ssrTrace.SetUniform("initStep", initStep);
	ssrTrace.SetUniform("sampleBias", sampleBias);
	ssrTrace.SetUniform("flagHiZ", flagHiZ);

	glUniform3fv(glGetUniformLocation(ssrTrace.Program, "viewPos"), 1, &viewPos[0]);
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, gSpecular->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, gNormal->textureID);
	glActiveTexture(GL_TEXTURE2);
	glBindTexture(GL_TEXTURE_2D, gAlbedoSpec->textureID);
	glActiveTexture(GL_TEXTURE3);
	glBindTexture(GL_TEXTURE_2D, depthMap->textureID);
	glActiveTexture(GL_TEXTURE4);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
	glActiveTexture(GL_TEXTURE5);
	glBindTexture(GL_TEXTURE_2D, prevColorFrame1->textureID);
	glActiveTexture(GL_TEXTURE6);
	glBindTexture(GL_TEXTURE_2D, blueNoiseTex->textureID);
	glActiveTexture(GL_TEXTURE7);
	glBindTexture(GL_TEXTURE_2D, BRDFLut->textureID);
}

void SsrTracePass::execute(){
	SSRHitpointFBO.Bind();
	ssrTrace.Use();
	RenderBufferQuad();
}