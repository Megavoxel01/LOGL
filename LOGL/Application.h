#pragma once
#include "Utility.h"
#include "imgui_impl_glfw.h"

class Application
{
public:
	int width, height;
	explicit Application(int screenWidth,int screenHeight)
		:width(screenWidth),height(screenHeight) {};
	~Application();

	void Loop();
	void Init();

	GLFWwindow* window;

};