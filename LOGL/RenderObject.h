#pragma once
#include <model.h>
#include <memory>


class RenderObject {
public:
	RenderObject(string modelName, glm::mat4 modelMatrix):
		model(modelName),
		modelMatrix(modelMatrix)
	{
	}

	RenderObject(string modelName) :
		model(modelName)
	{
	}

	~RenderObject(){}

	void setModelMatrix(const glm::mat4& modelMatrix) {
		this->modelMatrix = modelMatrix;
	}

	glm::mat4 getModelMatrix() {
		return this->modelMatrix;
	}

	Model& getModel() {
		return model;
	}
private:
	Model model;
	glm::mat4 modelMatrix;
};