#include <SsrCombinePass.h>

SsrCombinePass::SsrCombinePass(Scene *scene):
ssrCombine("shader/ssrCombine.vert", "shader/ssrCombine.frag")
{
	this->scene = scene;
	this->currSSR = scene->getTextureMap("currSSR");
	this->linearColorBuffer = scene->getTextureMap("linearColorBuffer");
}

SsrCombinePass::~SsrCombinePass(){

}

void SsrCombinePass::init(){
	linearFBO.Bind();
	ssrCombine.Use();
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "ssrBuffer"), 0);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "drBuffer"), 1);

	linearFBO.Bind();
	linearFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, linearColorBuffer->textureID);
}

void SsrCombinePass::update(){
	linearFBO.Bind();
	ssrCombine.Use();
	glActiveTexture(GL_TEXTURE0);
	glBindTexture(GL_TEXTURE_2D, currSSR->textureID);
	glActiveTexture(GL_TEXTURE1);
	glBindTexture(GL_TEXTURE_2D, linearColorBuffer->textureID);
}

void SsrCombinePass::execute(){
	linearFBO.Bind();
	RenderBufferQuad();
}