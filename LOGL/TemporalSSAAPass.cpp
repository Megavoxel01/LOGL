#include <TemporalSSAAPass.h>

TemporalSsaaPass::TemporalSsaaPass(float width, float height, Scene* scene) :
	mWidth(width), mHeight(height),
	TAA("shader/TAA.vert", "shader/TAA.frag")
{
	this->scene = scene;
	this->linearColorBuffer = scene->getTextureMap("linearColorBuffer");
	this->prevColorFrame1 = scene->getTextureMap("prevColorFrame1");
	this->gSpecular = scene->getTextureMap("gSpecular");
	this->gNormal = scene->getTextureMap("gNormal");
	this->BRDFLut = scene->getTextureMap("BRDFLut");
	this->rboDepth = scene->getTextureMap("rboDepth");
}

TemporalSsaaPass::~TemporalSsaaPass(){

}

void TemporalSsaaPass::init(){
	linearFBO.Bind();
	TAA.Use();
	glUniform1i(glGetUniformLocation(TAA.Program, "hdrBuffer"), 0);
	glUniform1i(glGetUniformLocation(TAA.Program, "prevBuffer"), 1);
	glUniform1i(glGetUniformLocation(TAA.Program, "gSpecular"), 2);
	glUniform1i(glGetUniformLocation(TAA.Program, "sceneDepth"), 3);
	glUniform1i(glGetUniformLocation(TAA.Program, "gNormal"), 4);
	glUniform1i(glGetUniformLocation(TAA.Program, "BRDFLut"), 5);

	linearFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, linearColorBuffer->textureID);
	linearFBO.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth->textureID);
}

void TemporalSsaaPass::update(
	const glm::mat4& view,
	const glm::mat4& projection,
	const glm::mat4& previousProjection,
	const glm::mat4& previousView,
	const glm::vec3& viewPos,
	float TAAscale,
	float TAAresponse,
	const bool& flagTemporal){
	linearFBO.Bind();
	TAA.Use();
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, linearColorBuffer->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, prevColorFrame1->textureID);
	glActiveTexture(GL_TEXTURE2);
	glBindTexture(GL_TEXTURE_2D, gSpecular->textureID);
	glActiveTexture(GL_TEXTURE3);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
	glActiveTexture(GL_TEXTURE4);
	glBindTexture(GL_TEXTURE_2D, gNormal->textureID);
	glActiveTexture(GL_TEXTURE5);
	glBindTexture(GL_TEXTURE_2D, BRDFLut->textureID);
	TAA.SetUniform("ProjectionMatrix", projection);
	TAA.SetUniform("ViewMatrix", view);
	TAA.SetUniform("preProjectionMatrix", previousProjection);
	TAA.SetUniform("preViewMatrix", previousView);
	TAA.SetUniform("inverseViewMatrix", glm::inverse(view));
	TAA.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	TAA.SetUniform("screenWidth", (float)mWidth);
	TAA.SetUniform("screenHeight", (float)mHeight);
	TAA.SetUniform("temporal", flagTemporal);
	TAA.SetUniform("TAAscale", TAAscale);
	TAA.SetUniform("TAAresponse", TAAresponse);
	TAA.SetUniform("viewPos", viewPos);
}

void TemporalSsaaPass::execute(){
	linearFBO.Bind();
	RenderBufferQuad();
}
