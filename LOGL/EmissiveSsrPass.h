#pragma once
#include <RenderPass.h>

class EmissiveSsrPass : public RenderPass{
public:
	EmissiveSsrPass(){}
	~EmissiveSsrPass(){}

	void init();
	void update(){
		/*emmisiveFBO.Bind();
		glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
		emmisiveBuffer.Use();
		model = glm::mat4();
		emmisiveBuffer.SetUniform("fov2projection", fov2projection);
		emmisiveBuffer.SetUniform("view", view);
		emmisiveBuffer.SetUniform("model", model);
		emmisiveBuffer.BindTexture(0, teath_d_ptr->textureID, "material.texture_diffuse1");
		emmisiveBuffer.BindTexture(1, teath_s_ptr->textureID, "material.texture_specular1");
		emmisiveBuffer.BindTexture(2, teath_n_ptr->textureID, "material.texture_normal1");
		emmisiveBuffer.BindTexture(3, teath_r_ptr->textureID, "material.texture_roughness1");

		for (GLuint i = 0; i < objectPositions.size(); i++)
		{
		model = glm::mat4();
		model = glm::translate(model, objectPositions[i]);
		model = glm::scale(model, glm::vec3(0.15f));
		emmisiveBuffer.SetUniform("model", model);
		if (ourModel.emmisive)
		{
		emmisiveBuffer.SetUniform("emmisiveFlag", ourModel.emmisive);
		ourModel.Draw(emmisiveBuffer);
		}
		}
		*/
	}
	void execute(){
		//glBindFramebuffer(GL_FRAMEBUFFER, 0);
		//glBindTexture(GL_TEXTURE_2D, SSRHitPixel);
		//glGenerateMipmap(GL_TEXTURE_2D);
		//glTexParameteri(GL_TEXTURE_2D, GL_GENERATE_MIPMAP, GL_FALSE);

		//glBindFramebuffer(GL_FRAMEBUFFER, SSRHitpointFBO);




		/*
		EmmisiveColorFBO.Bind();
		emmisiveTrace.Use();
		emmisiveTrace.SetUniform("flagShadowMap", flagShadowMap);
		emmisiveTrace.SetUniform("ProjectionMatrix", projection);
		emmisiveTrace.SetUniform("fov2ProjectionMatrix", fov2projection);
		emmisiveTrace.SetUniform("ViewMatrix", view);
		emmisiveTrace.SetUniform("preProjectionMatrix", previousProjection);
		emmisiveTrace.SetUniform("prefov2ProjectionMatrix", previousfov2Projection);
		emmisiveTrace.SetUniform("preViewMatrix", previousView);
		emmisiveTrace.SetUniform("inverseViewMatrix", glm::inverse(view));
		emmisiveTrace.SetUniform("extRand1", dist(mt));
		emmisiveTrace.SetUniform("tempRoughness", tempRoughness);
		emmisiveTrace.SetUniform("frameIndex", currentFrameIndex);
		emmisiveTrace.SetUniform("resolve", resolve);
		emmisiveTrace.SetUniform("binaryIteration", binaryIteration);
		emmisiveTrace.SetUniform("inputStride", pixelStride);
		emmisiveTrace.SetUniform("screenWidth", (float)screenWidth);
		emmisiveTrace.SetUniform("screenHeight", (float)screenHeight);
		emmisiveTrace.SetUniform("mipLevel", (float)depthLevel);
		emmisiveTrace.SetUniform("initStep", initStep);
		emmisiveTrace.SetUniform("sampleBias", sampleBias);


		//for (int i = 0; i <= 99; i++)
		//{
		//	emmisiveTrace.SetUniform(("haltonNum[" + std::to_string(i) + "]").c_str(), ssrResolveUniform.haltonNum[i]);
		//}
		glUniform3fv(glGetUniformLocation(emmisiveTrace.Program, "viewPos"), 1, &camera.Position[0]);

		glActiveTexture(GL_TEXTURE0);
		glBindTexture(GL_TEXTURE_2D, gSpecular.textureID);
		glActiveTexture(GL_TEXTURE1);
		glBindTexture(GL_TEXTURE_2D, gNormal.textureID);
		glActiveTexture(GL_TEXTURE2);
		glBindTexture(GL_TEXTURE_2D, gAlbedoSpec.textureID);
		glActiveTexture(GL_TEXTURE3);
		glBindTexture(GL_TEXTURE_2D, depthMap.textureID);
		glActiveTexture(GL_TEXTURE4);
		glBindTexture(GL_TEXTURE_2D, emmisiveDepth.textureID);
		glActiveTexture(GL_TEXTURE5);
		glBindTexture(GL_TEXTURE_2D, prevColorFrame1.textureID);
		glActiveTexture(GL_TEXTURE6);
		glBindTexture(GL_TEXTURE_2D, blueNoiseTex->textureID);
		glActiveTexture(GL_TEXTURE7);
		glBindTexture(GL_TEXTURE_2D, BRDFLut.textureID);
		//glActiveTexture(GL_TEXTURE8);
		//glBindTexture(GL_TEXTURE_2D, emmisivePos);
		if (flagEmmisive){
		glQueryCounter(queryID[0], GL_TIMESTAMP);
		RenderBufferQuad();
		glQueryCounter(queryID[1], GL_TIMESTAMP);
		stopTimerAvailable = 0;
		while (!stopTimerAvailable) {
		glGetQueryObjectiv(queryID[1],
		GL_QUERY_RESULT_AVAILABLE,
		&stopTimerAvailable);
		}

		// get query results
		glGetQueryObjectui64v(queryID[0], GL_QUERY_RESULT, &startTime);
		glGetQueryObjectui64v(queryID[1], GL_QUERY_RESULT, &stopTime);

		t_emmit = (stopTime - startTime) / 1000000.0;
		}

		EmmisiveColorFBO.Unbind();*/
		//glBindTexture(GL_TEXTURE_2D, SSRHitPixel);
		//glGenerateMipmap(GL_TEXTURE_2D);
		//glTexParameteri(GL_TEXTURE_2D, GL_GENERATE_MIPMAP, GL_FALSE);
	}
};