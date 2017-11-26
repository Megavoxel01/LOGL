#pragma once
#include "Utility.h"
#include "shader.h"
#include "framebuffer.h"
#include "TextureMap.h"
#include "Scene.h"

class RenderPass
{
public:
	RenderPass() {};
	virtual ~RenderPass() {};

	virtual void init()=0;
	virtual void execute()=0;

private:
};

