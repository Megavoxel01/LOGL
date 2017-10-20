#include <SsrResolvePass.h>

SsrResolvePass::SsrResolvePass(float width, float height, Scene* scene):
mWidth(width), mHeight(height),
ssrResolve("shader/ssrresolve.vert", "shader/ssrresolve.frag")
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
	this->SSRHitPixel = scene->getTextureMap("SSRHitPixel");
	this->currSSR = scene->getTextureMap("currSSR");
}

SsrResolvePass::~SsrResolvePass(){

}

void SsrResolvePass::init(){
	SSRColorFBO.Bind();
	ssrResolve.Use();
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "gSpecular"), 0);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "gNormal"), 1);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "gAlbedoSpec"), 2);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "sceneDepth"), 3);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "currFrame"), 4);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "blueNoise"), 5);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "BRDFLut"), 6);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "ssrHitpoint"), 7);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "ssrHitpixel"), 8);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "IBL"), 9);

	SSRColorFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, currSSR->textureID);
}

void SsrResolvePass::update(
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
	const bool& flagShadowMap,
	const bool& flagEmmisive,
	const float& angle,
	const GLuint& IBL){
	SSRColorFBO.Bind();
	ssrResolve.Use();
	ssrResolve.SetUniform("flagShadowMap", flagShadowMap);
	ssrResolve.SetUniform("ProjectionMatrix", projection);
	ssrResolve.SetUniform("ViewMatrix", view);
	ssrResolve.SetUniform("preProjectionMatrix", previousProjection);
	ssrResolve.SetUniform("preViewMatrix", previousView);
	ssrResolve.SetUniform("inverseViewMatrix", glm::inverse(view));
	ssrResolve.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	ssrResolve.SetUniform("extRand1", dist(mt));
	ssrResolve.SetUniform("tempRoughness", tempRoughness);
	ssrResolve.SetUniform("frameIndex", currentFrameIndex);
	ssrResolve.SetUniform("resolve", resolve);
	ssrResolve.SetUniform("binaryIteration", binaryIteration);
	ssrResolve.SetUniform("inputStride", pixelStride);
	ssrResolve.SetUniform("screenWidth", (float)mWidth);
	ssrResolve.SetUniform("screenHeight", (float)mHeight);
	ssrResolve.SetUniform("sampleBias", sampleBias);
	ssrResolve.SetUniform("rangle", angle);
	ssrResolve.SetUniform("flagEmmisive", flagEmmisive);
	ssrResolve.SetUniform("viewPos", viewPos);

	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, gSpecular->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, gNormal->textureID);
	glActiveTexture(GL_TEXTURE2);
	glBindTexture(GL_TEXTURE_2D, gAlbedoSpec->textureID);
	glActiveTexture(GL_TEXTURE3);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
	glActiveTexture(GL_TEXTURE4);
	glBindTexture(GL_TEXTURE_2D, prevColorFrame1->textureID);
	glActiveTexture(GL_TEXTURE5);
	glBindTexture(GL_TEXTURE_2D, blueNoiseTex->textureID);
	glActiveTexture(GL_TEXTURE6);
	glBindTexture(GL_TEXTURE_2D, BRDFLut->textureID);
	glActiveTexture(GL_TEXTURE7);
	glBindTexture(GL_TEXTURE_2D, SSRHitPoint->textureID);
	glActiveTexture(GL_TEXTURE8);
	glBindTexture(GL_TEXTURE_2D, SSRHitPixel->textureID);
	glActiveTexture(GL_TEXTURE9);
	glBindTexture(GL_TEXTURE_CUBE_MAP, IBL);
}

void SsrResolvePass::execute(){
	SSRColorFBO.Bind();
	RenderBufferQuad();
}

