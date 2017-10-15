#pragma once
#include <Utility.h>
#include <model.h>
#include <RenderObject.h>


class Scene {
public:
	std::map<string, RenderObject*> sceneModel;
	std::map<string, TextureMap*> renderTexture;
	std::map<string, Texture*> modelTexture;

	TextureMap* getTextureMap(const string& name) {
		return renderTexture.find(name)->second;
	}

	void addTextureMap(const string& name, TextureMap* texture) {
		renderTexture.insert(make_pair(const_cast<string&>(name), texture));
	}

	RenderObject* getRenderObject(const string& name) {
		return sceneModel.find(name)->second;
	}

	void addRenderObject(const string& name, const RenderObject* object) {
		sceneModel.insert(make_pair(const_cast<string&>(name), const_cast<RenderObject*>(object)));
	}
};