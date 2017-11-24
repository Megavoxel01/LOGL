#include <SsrCombinePass.h>

SsrCombinePass::SsrCombinePass(Scene *scene):
ssrCombine("shader/ssrCombine.vert", "shader/ssrCombine.frag")
{
	this->scene = scene;
	this->currSSR = scene->getTextureMap("currSSR");
	this->linearColorBuffer = scene->getTextureMap("linearColorBuffer");
	this->gSpecular = scene->getTextureMap("gSpecular");
	this->gNormal = scene->getTextureMap("gNormal");
	this->BRDFLut = scene->getTextureMap("BRDFLut");
	this->rboDepth = scene->getTextureMap("rboDepth");
}

SsrCombinePass::~SsrCombinePass(){

}

void SsrCombinePass::init(){
	linearFBO.Bind();
	ssrCombine.Use();
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "ssrBuffer"), 0);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "drBuffer"), 1);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "gSpecular"), 2);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "sceneDepth"), 3);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "gNormal"), 4);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "BRDFLut"), 5);

	linearFBO.Bind();
	linearFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, linearColorBuffer->textureID);
}

void SsrCombinePass::update(glm::vec3& viewPos, glm::mat4& view, glm::mat4& projection){
	linearFBO.Bind();
	ssrCombine.Use();
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, currSSR->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, linearColorBuffer->textureID);
	glActiveTexture(GL_TEXTURE2);
	glBindTexture(GL_TEXTURE_2D, gSpecular->textureID);
	glActiveTexture(GL_TEXTURE3);
	glBindTexture(GL_TEXTURE_2D, rboDepth->textureID);
	glActiveTexture(GL_TEXTURE4);
	glBindTexture(GL_TEXTURE_2D, gNormal->textureID);
	glActiveTexture(GL_TEXTURE5);
	glBindTexture(GL_TEXTURE_2D, BRDFLut->textureID);
	ssrCombine.SetUniform("inverseViewMatrix", glm::inverse(view));
	ssrCombine.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	ssrCombine.SetUniform("viewPos", viewPos);
}

void SsrCombinePass::execute(){
	linearFBO.Bind();
	RenderBufferQuad();
}