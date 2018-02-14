#include <GBufferPass.h>


GBufferPass::GBufferPass(float width, float height, Scene *scene):
	mWidth(width), mHeight(height),
	shaderGeometryPass("shader/g_buffer.vert", "shader/g_buffer.frag"),
	objectPositions(std::vector<glm::vec3>{})
{
	this->scene = scene;
	this->gSpecular = scene->getTextureMap("gSpecular");
	this->gNormal = scene->getTextureMap("gNormal");
	this->gAlbedoSpec = scene->getTextureMap("gAlbedoSpec");
	this->rboDepth = scene->getTextureMap("rboDepth");
	this->rboDepthPrev = scene->getTextureMap("rboDepthPrev");
	this->gViewPosition = scene->getTextureMap("gViewPosition");
	this->gViewPositionPrev = scene->getTextureMap("gViewPositionPrev");
}

GBufferPass::~GBufferPass() {

}

void GBufferPass::init() {
	gBuffer.Bind();
	gBuffer.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gSpecular->textureID);
	gBuffer.AttachTexture(1, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gNormal->textureID);
	gBuffer.AttachTexture(2, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gAlbedoSpec->textureID);
	gBuffer.AttachTexture(3, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, gViewPosition->textureID);
	GLuint attachments[4] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1, GL_COLOR_ATTACHMENT2, GL_COLOR_ATTACHMENT3 };
	gBuffer.DrawBuffer(4, attachments);

	gBuffer.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth->textureID);
	gBuffer.Unbind();
}

void GBufferPass::update(const glm::mat4& view, const glm::mat4& projection, std::vector<glm::vec3>& objectPositions) {
	this->view = view;
	this->projection = projection;
	this->objectPositions = objectPositions;
}

void GBufferPass::execute() {
	glCopyImageSubData(rboDepth->textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
		rboDepthPrev->textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
		mWidth, mHeight, 1);
	gBuffer.Bind();
	glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
	//previousView = view;
	glm::mat4 model;
	shaderGeometryPass.Use();
	model = glm::mat4();
	float flagGloss = 1;
	float flagMetallic = 0;
	shaderGeometryPass.SetUniform("projection", projection);
	shaderGeometryPass.SetUniform("view", view);
	shaderGeometryPass.SetUniform("model", model);
	shaderGeometryPass.SetUniform("flagGloss", flagGloss);
	shaderGeometryPass.SetUniform("flagMetallic", flagMetallic);
	shaderGeometryPass.SetUniform("hasNormal", false);
	//shaderGeometryPass.BindTexture(0, teath_d_ptr->textureID, "material.texture_diffuse1");
	//shaderGeometryPass.BindTexture(1, teath_s_ptr->textureID, "material.texture_specular1");
	//shaderGeometryPass.BindTexture(2, teath_n_ptr->textureID, "material.texture_normal1");
	//shaderGeometryPass.BindTexture(3, teath_r_ptr->textureID, "material.texture_roughness1");
	shaderGeometryPass.BindTexture(0, scene->getTextureMap("buddha_d_ptr")->textureID, "material.texture_diffuse1");
	shaderGeometryPass.BindTexture(1, scene->getTextureMap("buddha_s_ptr")->textureID, "material.texture_specular1");
	shaderGeometryPass.BindTexture(2, scene->getTextureMap("buddha_n_ptr")->textureID, "material.texture_normal1");
	shaderGeometryPass.BindTexture(3, scene->getTextureMap("buddha_r_ptr")->textureID, "material.texture_roughness1");
	RenderObject* ourModel = scene->getRenderObject("ourModel");
	for (GLuint i = 0; i < objectPositions.size(); i++)
	{
		model = glm::mat4();
		model = glm::translate(model, objectPositions[i]);
		model = glm::scale(model, glm::vec3(0.15f));
		shaderGeometryPass.SetUniform("model", model);
		ourModel->getModel().Draw(shaderGeometryPass);
	}
	model = glm::mat4();
	model = glm::translate(model, glm::vec3(3.0, -4.05, -3.0));
	model = glm::scale(model, glm::vec3(0.15f));
	shaderGeometryPass.SetUniform("model", model);
	shaderGeometryPass.SetUniform("projection", projection);
	shaderGeometryPass.SetUniform("view", view);
	shaderGeometryPass.SetUniform("model", model);
	shaderGeometryPass.SetUniform("flagGloss", flagGloss);
	shaderGeometryPass.SetUniform("flagMetallic", flagMetallic);
	shaderGeometryPass.SetUniform("hasNormal", false);
	//shaderGeometryPass.BindTexture(0, buddha_d_ptr->textureID, "material.texture_diffuse1");
	//shaderGeometryPass.BindTexture(1, buddha_s_ptr->textureID, "material.texture_specular1");
	//shaderGeometryPass.BindTexture(2, buddha_n_ptr->textureID, "material.texture_normal1");
	//shaderGeometryPass.BindTexture(3, buddha_r_ptr->textureID, "material.texture_roughness1");
	ourModel->getModel().emmisive = false;
	ourModel->getModel().Draw(shaderGeometryPass);
	ourModel->getModel().emmisive = false;

	model = glm::mat4();
	shaderGeometryPass.SetUniform("model", model);
	shaderGeometryPass.SetUniform("projection", projection);
	shaderGeometryPass.SetUniform("view", view);
	flagGloss = 1;
	flagMetallic = 0;
	shaderGeometryPass.SetUniform("flagGloss", flagGloss);
	shaderGeometryPass.SetUniform("flagMetallic", flagMetallic);
	shaderGeometryPass.SetUniform("hasNormal", true);
	//shaderGeometryPass.SetUniform("tempRoughness", tempRoughness);


	
	bool flagAniso = true;
	shaderGeometryPass.BindTexture(0, scene->getTextureMap("floor_d_ptr")->textureID, "material.texture_diffuse1");
	shaderGeometryPass.BindTexture(1, scene->getTextureMap("floor_s_ptr")->textureID, "material.texture_specular1");
	shaderGeometryPass.BindTexture(2, scene->getTextureMap("floor_n_ptr")->textureID, "material.texture_normal1");
	shaderGeometryPass.BindTexture(3, scene->getTextureMap("floor_r_ptr")->textureID, "material.texture_roughness1");

	//glCullFace(GL_FRONT);
	glDisable(GL_CULL_FACE);
	RenderQuad();
	glEnable(GL_CULL_FACE);

}
