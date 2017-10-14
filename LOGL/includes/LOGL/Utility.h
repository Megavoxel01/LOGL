#pragma once
#include <GL/glew.h>
#include <assert.h>
#include <string>
#include <algorithm>
#include <GLFW/glfw3.h>
#include <SOIL.h>
#include <stb_image.h>
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>


GLuint loadTexture(GLchar* path);

void RenderBufferQuad();
void RenderQuad();
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
