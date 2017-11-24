#include <SsrFilterPass.h>


SsrFilterPass::SsrFilterPass(float width, float height, Scene* scene) :
mWidth(width), mHeight(height),
ssrFilter("shader/ssrFilter.vert", "shader/ssrFilter.frag")
{
	this->scene = scene;
	this->currSSR = scene->getTextureMap("currSSR");
	this->prevSSR1 = scene->getTextureMap("prevSSR1");
	this->gSpecular = scene->getTextureMap("gSpecular");
	this->gNormal = scene->getTextureMap("gNormal");
	this->BRDFLut = scene->getTextureMap("BRDFLut");
	this->rboDepth = scene->getTextureMap("rboDepth");
	this->SSRHitPoint = scene->getTextureMap("SSRHitPoint");
}

SsrFilterPass::~SsrFilterPass(){

}

void SsrFilterPass::init(){
	SSRColorFBO.Bind();
	ssrFilter.Use();
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "currSSR"), 0);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "prevSSR1"), 1);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "gSpecular"), 2);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "sceneDepth"), 3);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "gNormal"), 4);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "BRDFLut"), 5);
	glUniform1i(glGetUniformLocation(ssrFilter.Program, "ssrHitpoint"), 6);

	SSRColorFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, currSSR->textureID);
	SSRColorFBO.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth->textureID);
}

void SsrFilterPass::update(
	const glm::mat4& view,
	const glm::mat4& projection,
	const glm::mat4& previousProjection,
	const glm::mat4& previousView,
	const glm::vec3& viewPos,
	float TAAscale,
	float TAAresponse,
	const bool& flagTemporal){
	SSRColorFBO.Bind();
	ssrFilter.Use();
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, currSSR->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, prevSSR1->textureID);
	glActiveTexture(GL_TEXTURE2);
	glBindTexture(GL_TEXTURE_2D, gSpecular->textureID);
	glActiveTexture(GL_TEXTURE3);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
	glActiveTexture(GL_TEXTURE4);
	glBindTexture(GL_TEXTURE_2D, gNormal->textureID);
	glActiveTexture(GL_TEXTURE5);
	glBindTexture(GL_TEXTURE_2D, BRDFLut->textureID);
	glActiveTexture(GL_TEXTURE6);
	glBindTexture(GL_TEXTURE_2D, SSRHitPoint->textureID);
	ssrFilter.SetUniform("ProjectionMatrix", projection);
	ssrFilter.SetUniform("ViewMatrix", view);
	ssrFilter.SetUniform("preProjectionMatrix", previousProjection);
	ssrFilter.SetUniform("preViewMatrix", previousView);
	ssrFilter.SetUniform("inverseViewMatrix", glm::inverse(view));
	ssrFilter.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	ssrFilter.SetUniform("screenWidth", (float)mWidth);
	ssrFilter.SetUniform("screenHeight", (float)mHeight);
	ssrFilter.SetUniform("temporal", flagTemporal);
	ssrFilter.SetUniform("TAAscale", TAAscale);
	ssrFilter.SetUniform("TAAresponse", TAAresponse);
	ssrFilter.SetUniform("viewPos", viewPos);
}

void SsrFilterPass::execute(){
	SSRColorFBO.Bind();
	RenderBufferQuad();
}
