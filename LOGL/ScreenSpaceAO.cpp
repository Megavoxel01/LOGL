#include <ScreenSpaceAO.h>
#include <camera.h>
# define M_PI           3.14159265358979323846

ScreenSpaceAO::ScreenSpaceAO(float width, float height, Scene *scene):
	mWidth(width), mHeight(height),
	shaderSsao("shader/ssao.vert", "shader/GTAO.frag"),
	shaderGTAOBlur("shader/ssao.vert", "shader/GTAOBlur.frag"),
	shaderGTAOTemporal("shader/ssao.vert", "shader/GTAOTemporal.frag")
{
	this->scene = scene;
	this->gNormal = scene->getTextureMap("gNormal");
	this->gAlbedoSpec = scene->getTextureMap("gAlbedoSpec");
	this->rboDepth = scene->getTextureMap("rboDepth");
	this->rboDepthPrev = scene->getTextureMap("rboDepthPrev");
	this->ssaoColor = scene->getTextureMap("ssaoColor");
	this->ssaoNormalImage = scene->getTextureMap("ssaoNormalImage");
	this->gViewPosition = scene->getTextureMap("gViewPosition");
	this->gViewPositionPrev = scene->getTextureMap("gViewPositionPrev");
	this->ssaoColorPrev1 = scene->getTextureMap("ssaoColorPrev1");
	this->ssaoAccum = scene->getTextureMap("ssaoAccum");
}
ScreenSpaceAO::~ScreenSpaceAO() 
{

}
void ScreenSpaceAO::init()
{
	ssaoFBO.Bind();
	ssaoFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColor->textureID);
	ssaoFBO.Unbind();

	shaderSsao.Use();
	glUniform1i(glGetUniformLocation(shaderSsao.Program, "sceneDepth"), 0);
	glUniform1i(glGetUniformLocation(shaderSsao.Program, "gNormal"), 1);
	glUniform1i(glGetUniformLocation(shaderSsao.Program, "texNoise"), 2);
	//glUniform1i(glGetUniformLocation(shaderSsao.Program, "gViewPosition"), 3);

	shaderGTAOBlur.Use();
	glUniform1i(glGetUniformLocation(shaderSsao.Program, "gtao"), 0);
	glUniform1i(glGetUniformLocation(shaderSsao.Program, "depth"), 1);

	ssaoBlurFBO1.Bind();
	ssaoBlurFBO1.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoColor->textureID);
	ssaoBlurFBO1.Unbind();

	ssaoBlurFBO2.Bind();
	ssaoBlurFBO2.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, ssaoAccum->textureID);
	ssaoBlurFBO2.Unbind();


	std::uniform_real_distribution<GLfloat> randomFloats(0.0, 1.0); // generates random floats between 0.0 and 1.0
	std::default_random_engine generator;
	
	for (unsigned int i = 0; i < 128; ++i)
	{
		glm::vec3 sample(randomFloats(generator) * 2.0 - 1.0, randomFloats(generator) * 2.0 - 1.0, randomFloats(generator));
		sample = glm::normalize(sample);
		sample *= randomFloats(generator);
		float scale = float(i) / 64.0;

		scale = lerp(0.1f, 1.0f, scale * scale);
		sample *= scale;
		ssaoKernel.push_back(sample);
	}

	unsigned char* data = new unsigned char[16 * 2];
	for (unsigned char i = 0; i < 4; ++i) {
		for (unsigned char j = 0; j < 4; ++j) {
			float dirnoise = 0.0625f * ((((i + j) & 0x3) << 2) + (i & 0x3));
			float offnoise = 0.25f * ((j - i) & 0x3);

			data[(i * 4 + j) * 2 + 0] = (unsigned char)(dirnoise * 255.0f);
			data[(i * 4 + j) * 2 + 1] = (unsigned char)(offnoise * 255.0f);
		}
	}
	noiseTexture = std::make_shared<TextureMap>(4, 4, GL_RG8, GL_RG, GL_UNSIGNED_BYTE, &data[0], GL_LINEAR, GL_LINEAR, GL_REPEAT, GL_REPEAT);
	delete[] data;


}
void ScreenSpaceAO::execute()
{
	ssaoFBO.Bind();
	RenderBufferQuad();

	ssaoBlurFBO1.Bind();
	shaderGTAOBlur.Use();
	shaderGTAOBlur.BindTexture(0, ssaoColor->textureID, "gtao");
	shaderGTAOBlur.BindTexture(1, rboDepth->textureID, "depth");
	shaderGTAOBlur.SetUniform("invRes", glm::vec2(1.0f / mWidth, 1.0f / mHeight));
	RenderBufferQuad();
	ssaoBlurFBO1.Unbind();

	ssaoBlurFBO2.Bind();
	shaderGTAOTemporal.Use();
	shaderGTAOTemporal.BindTexture(0, ssaoColorPrev1->textureID, "historyBuffer");
	shaderGTAOTemporal.BindTexture(1, ssaoColor->textureID, "currIteration");	
	shaderGTAOTemporal.BindTexture(2, rboDepth->textureID, "currDepthBuffer");
	shaderGTAOTemporal.BindTexture(3, rboDepthPrev->textureID, "prevDepthBuffer");

	shaderGTAOTemporal.SetUniform("matPrevViewInv", glm::inverse(previousView));
	shaderGTAOTemporal.SetUniform("matCurrViewInv", glm::inverse(view));
	shaderGTAOTemporal.SetUniform("matPrevView", previousView);
	shaderGTAOTemporal.SetUniform("matProj", projection);	
	shaderGTAOTemporal.SetUniform("projInfo", projinfo);
	shaderGTAOTemporal.SetUniform("inverseViewMatrix", glm::inverse(view));
	shaderGTAOTemporal.SetUniform("inverseProjectionMatrix", glm::inverse(projection));
	shaderGTAOTemporal.SetUniform("preProjectionMatrix", previousProjection);
	shaderGTAOTemporal.SetUniform("clipPlanes", clip);
	shaderGTAOTemporal.SetUniform("frameIndex", frameIndex);


	RenderBufferQuad();
	ssaoBlurFBO2.Unbind();

	glCopyImageSubData(ssaoAccum->textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
		ssaoColorPrev1->textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
		mWidth, mHeight, 1);
}
void ScreenSpaceAO::update(
	const glm::mat4& projection, 
	const glm::mat4& previousProjection, 
	const glm::mat4& view, 
	const glm::mat4& previousView, 
	const float& zoom, 
	const float& frameIndex,
	const bool& flagTemporal,
	const float& TAAScale,
	const float& TAAresponse)
{
	ssaoFBO.Bind();
	shaderSsao.Use();
	shaderSsao.BindTexture(0, gViewPosition->textureID, "sceneDepth");
	shaderSsao.BindTexture(1, gNormal->textureID, "gNormal");
	shaderSsao.BindTexture(2, noiseTexture->textureID, "texNoise");
	//shaderSsao.BindTexture(3, gViewPositiion->textureID, "gViewPosition");
	//for (unsigned int i = 0; i < 128; ++i) 
	//{
	//	shaderSsao.SetUniform(("offsets[" + std::to_string(i) + "]").c_str(), ssaoKernel[i]);
	//}
	float rotations[6] = { 60.0f, 300.0f, 180.0f, 240.0f, 120.0f, 0.0f };
	float offsets[4] = { 0.0f, 0.5f, 0.25f, 0.75f };
	glm::vec4 projinfo(2.0f / (mWidth * projection[0][0]), 2.0f / (mHeight * projection[1][1]), -1.0f / projection[0][0], -1.0f / projection[1][1]);
	glm::vec4 clip(0.1f, 50.0f, 0.5f*(mHeight/(2.0f*tanf(zoom*M_PI/180.0f))), 0.0f);
	//glm::vec4 params(rotations[(int)frameIndex % 6] / 360.0f, offsets[(int)(frameIndex/6)%4], 0.0f, 0.0f);
	glm::vec4 params(rotations[((int)frameIndex)%6] / 360.0f, offsets[((int)(frameIndex/4))%4], 0.0f, 0.0f);
	this->view = view;
	this->projection = projection;
	this->previousView = previousView;
	this->previousProjection = previousProjection;
	this->projinfo = projinfo;
	this->clip = clip;
	this->frameIndex = frameIndex;
	shaderSsao.SetUniform("projInfo", projinfo);
	shaderSsao.SetUniform("clipInfo", clip);
	shaderSsao.SetUniform("invRes", glm::vec2(1.0f/mWidth, 1.0f/mHeight));
	shaderSsao.SetUniform("params", params);
	shaderSsao.SetUniform("viewMatrix", view);
	shaderSsao.SetUniform("projection", projection);
	shaderSsao.SetUniform("inverseProjectionMatrix", glm::inverse(projection));

	ssaoFBO.Unbind();

}