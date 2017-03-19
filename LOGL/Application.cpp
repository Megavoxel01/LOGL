#pragma once
#include "Application.h"


void Application::Init()
{
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
	glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);
	glfwWindowHint(GLFW_SAMPLES, 4);

	window = glfwCreateWindow(width, height, "OGLdemo", nullptr, nullptr);
	glfwMakeContextCurrent(window);


	glfwSetKeyCallback(window, ImGui_ImplGlfwGL3_KeyCallback);
	glfwSetCursorPosCallback(window, mouse_callback);
	glfwSetScrollCallback(window, scroll_callback);


	glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);


	glewExperimental = GL_TRUE;
	auto err = glewInit();
	if (GLEW_OK != err)
	{
		throw std::exception("Failed to initialize GLEW\n");
	}
}

