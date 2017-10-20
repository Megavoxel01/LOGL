#define _CRT_SECURE_NO_WARNINGS
#include <string>
#define GLEW_STATIC
//#include <GL/glew.h>
#include "Shader.h"
#include <imgui.h>
#include "imgui_impl_glfw.h"
#include <GLFW/glfw3.h>

#include "Camera.h"
#include "framebuffer.h"
#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>
#include <glm/gtc/type_ptr.hpp>

#include <model.h>
#include <SOIL.h>
#include <stb_image.h>
#include <TextureMap.h>
#include <memory>
#include <random>
#include <GBufferPass.h>
#include <HiZDepthPass.h>
#include <LightCullingPass.h>
#include <SsrTracePass.h>
#include <DeferredShadingPass.h>
#include <SsrResolvePass.h>
#include <SsrCombinePass.h>
#include <TemporalSSAAPass.h>






const GLuint screenWidth = 1600, screenHeight = 900;

GLboolean shadows = true;
void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode);
void scroll_callback(GLFWwindow* window, double xoffset, double yoffset);
void mouse_callback(GLFWwindow* window, double xpos, double ypos);
void RenderScene(Shader &shader);
void Do_Movement();

double halton(int index, int base)
{
	double frac = 1.0 / (double)base;
	double result = 0.0;
	while (index > 0)
	{
		result += frac * (index % base);
		index = (int)((double)index / (double)base);
		frac /= (double)base;
	}
	return result;
}
GLuint loadCubemap(const std::vector<const GLchar*>& faces)
{
	GLuint textureID;
	glGenTextures(1, &textureID);

	int width, height, bpp;
	unsigned char* image;

	glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);
	for (GLuint i = 0; i < faces.size(); i++)
	{
		//image = SOIL_load_image(faces[i], &width, &height, 0, SOIL_LOAD_RGB);
		image = stbi_load(faces[i], &width, &height, &bpp, 3);
		glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
		stbi_image_free(image);
	}
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
	glGenerateMipmap(textureID);
	glBindTexture(GL_TEXTURE_CUBE_MAP, 0);

	return textureID;
}

GLuint loadIBL(const std::vector<const GLchar*>& faces)
{
	GLuint textureID;
	glGenTextures(1, &textureID);

	int width, height, bpp;
	unsigned char* image;

	glBindTexture(GL_TEXTURE_CUBE_MAP, textureID);

	int size = faces.size();

	for (GLuint i = 0; i < size / 6; i++)
	{
		for (GLuint j = 0; j < 6; j++)
		{
			image = stbi_load(faces[i * 6 + j], &width, &height, &bpp, 3);
			glTexImage2D(GL_TEXTURE_CUBE_MAP_POSITIVE_X + j, i, GL_RGB, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
			stbi_image_free(image);
		}

	}
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_WRAP_R, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_BASE_LEVEL, 0);
	glTexParameteri(GL_TEXTURE_CUBE_MAP, GL_TEXTURE_MAX_LEVEL, 5);
	glBindTexture(GL_TEXTURE_CUBE_MAP, 0);

	return textureID;
}

GLuint cubeVAO = 0;
GLuint cubeVBO = 0;
void RenderCube()
{
	// Initialize (if necessary)
	if (cubeVAO == 0)
	{
		GLfloat vertices[] = {
			// Back face
			-0.5f, -0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 0.0f, 0.0f, // Bottom-left
			0.5f, 0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 1.0f, 1.0f, // top-right
			0.5f, -0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 1.0f, 0.0f, // bottom-right         
			0.5f, 0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 1.0f, 1.0f,  // top-right
			-0.5f, -0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 0.0f, 0.0f,  // bottom-left
			-0.5f, 0.5f, -0.5f, 0.0f, 0.0f, -1.0f, 0.0f, 1.0f,// top-left
			// Front face
			-0.5f, -0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f, // bottom-left
			0.5f, -0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 1.0f, 0.0f,  // bottom-right
			0.5f, 0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 1.0f, 1.0f,  // top-right
			0.5f, 0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 1.0f, 1.0f, // top-right
			-0.5f, 0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 0.0f, 1.0f,  // top-left
			-0.5f, -0.5f, 0.5f, 0.0f, 0.0f, 1.0f, 0.0f, 0.0f,  // bottom-left
			// Left face
			-0.5f, 0.5f, 0.5f, -1.0f, 0.0f, 0.0f, 1.0f, 0.0f, // top-right
			-0.5f, 0.5f, -0.5f, -1.0f, 0.0f, 0.0f, 1.0f, 1.0f, // top-left
			-0.5f, -0.5f, -0.5f, -1.0f, 0.0f, 0.0f, 0.0f, 1.0f,  // bottom-left
			-0.5f, -0.5f, -0.5f, -1.0f, 0.0f, 0.0f, 0.0f, 1.0f, // bottom-left
			-0.5f, -0.5f, 0.5f, -1.0f, 0.0f, 0.0f, 0.0f, 0.0f,  // bottom-right
			-0.5f, 0.5f, 0.5f, -1.0f, 0.0f, 0.0f, 1.0f, 0.0f, // top-right
			// Right face
			0.5f, 0.5f, 0.5f, 1.0f, 0.0f, 0.0f, 1.0f, 0.0f, // top-left
			0.5f, -0.5f, -0.5f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f, // bottom-right
			0.5f, 0.5f, -0.5f, 1.0f, 0.0f, 0.0f, 1.0f, 1.0f, // top-right         
			0.5f, -0.5f, -0.5f, 1.0f, 0.0f, 0.0f, 0.0f, 1.0f,  // bottom-right
			0.5f, 0.5f, 0.5f, 1.0f, 0.0f, 0.0f, 1.0f, 0.0f,  // top-left
			0.5f, -0.5f, 0.5f, 1.0f, 0.0f, 0.0f, 0.0f, 0.0f, // bottom-left     
			// Bottom face
			-0.5f, -0.5f, -0.5f, 0.0f, -1.0f, 0.0f, 0.0f, 1.0f, // top-right
			0.5f, -0.5f, -0.5f, 0.0f, -1.0f, 0.0f, 1.0f, 1.0f, // top-left
			0.5f, -0.5f, 0.5f, 0.0f, -1.0f, 0.0f, 1.0f, 0.0f,// bottom-left
			0.5f, -0.5f, 0.5f, 0.0f, -1.0f, 0.0f, 1.0f, 0.0f, // bottom-left
			-0.5f, -0.5f, 0.5f, 0.0f, -1.0f, 0.0f, 0.0f, 0.0f, // bottom-right
			-0.5f, -0.5f, -0.5f, 0.0f, -1.0f, 0.0f, 0.0f, 1.0f, // top-right
			// Top face
			-0.5f, 0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 1.0f,// top-left
			0.5f, 0.5f, 0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f, // bottom-right
			0.5f, 0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 1.0f, // top-right     
			0.5f, 0.5f, 0.5f, 0.0f, 1.0f, 0.0f, 1.0f, 0.0f, // bottom-right
			-0.5f, 0.5f, -0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 1.0f,// top-left
			-0.5f, 0.5f, 0.5f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f // bottom-left        
		};
		glGenVertexArrays(1, &cubeVAO);
		glGenBuffers(1, &cubeVBO);
		// Fill buffer
		glBindBuffer(GL_ARRAY_BUFFER, cubeVBO);
		glBufferData(GL_ARRAY_BUFFER, sizeof(vertices), vertices, GL_STATIC_DRAW);
		// Link vertex attributes
		glBindVertexArray(cubeVAO);
		glEnableVertexAttribArray(0);
		glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)0);
		glEnableVertexAttribArray(1);
		glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)(3 * sizeof(GLfloat)));
		glEnableVertexAttribArray(2);
		glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)(6 * sizeof(GLfloat)));
		glBindBuffer(GL_ARRAY_BUFFER, 0);
		glBindVertexArray(0);
	}
	// Render Cube
	glBindVertexArray(cubeVAO);
	glDrawArrays(GL_TRIANGLES, 0, 36);
	glBindVertexArray(0);
}


GLuint planeVBO;
GLuint planeVAO;
void RenderScene(Shader &shader)
{
	RenderQuad();
}



Camera camera(glm::vec3(0.0f, -3.8f, 2.0f));
bool keys[1024];
GLfloat lastX = 400, lastY = 300;
bool firstMouse = true;

GLfloat deltaTime = 0.0f;
GLfloat lastFrame = 0.0f;


int main()
{
	int err;
	std::shared_ptr<Scene> scene(new Scene());
	glfwInit();
	glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
	glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
	glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
	glfwWindowHint(GLFW_RESIZABLE, GL_FALSE);
	glfwWindowHint(GLFW_SAMPLES, 4);

	GLFWwindow* window = glfwCreateWindow(screenWidth, screenHeight, "OGLdemo", nullptr, nullptr);
	glfwMakeContextCurrent(window);


	glfwSetKeyCallback(window, ImGui_ImplGlfwGL3_KeyCallback);
	glfwSetCursorPosCallback(window, mouse_callback);
	glfwSetScrollCallback(window, scroll_callback);


	glfwSetInputMode(window, GLFW_CURSOR, GLFW_CURSOR_DISABLED);


	glewExperimental = GL_TRUE;
	GLenum err1 = glewInit();
	if (GLEW_OK != err1)
	{
		throw std::exception("Failed to initialize GLEW\n");
	}


	glViewport(0, 0, screenWidth, screenHeight);


	glEnable(GL_DEPTH_TEST);
	//glDepthFunc(GL_ALWAYS);





	GLfloat planeVertices[] = {
		// Positions          // Normals         // Texture Coords
		25.0f, -0.5f, 25.0f, 0.0f, 1.0f, 0.0f, 25.0f, 0.0f,
		-25.0f, -0.5f, -25.0f, 0.0f, 1.0f, 0.0f, 0.0f, 25.0f,
		-25.0f, -0.5f, 25.0f, 0.0f, 1.0f, 0.0f, 0.0f, 0.0f,

		25.0f, -0.5f, 25.0f, 0.0f, 1.0f, 0.0f, 25.0f, 0.0f,
		25.0f, -0.5f, -25.0f, 0.0f, 1.0f, 0.0f, 25.0f, 25.0f,
		-25.0f, -0.5f, -25.0f, 0.0f, 1.0f, 0.0f, 0.0f, 25.0f
	};
	// Setup plane VAO
	GLuint planeVBO;
	glGenVertexArrays(1, &planeVAO);
	glGenBuffers(1, &planeVBO);
	glBindVertexArray(planeVAO);
	glBindBuffer(GL_ARRAY_BUFFER, planeVBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(planeVertices), &planeVertices, GL_STATIC_DRAW);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)0);
	glEnableVertexAttribArray(1);
	glVertexAttribPointer(1, 3, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)(3 * sizeof(GLfloat)));
	glEnableVertexAttribArray(2);
	glVertexAttribPointer(2, 2, GL_FLOAT, GL_FALSE, 8 * sizeof(GLfloat), (GLvoid*)(6 * sizeof(GLfloat)));
	glBindVertexArray(0);


	glm::vec3 cubePositions[] = {
		glm::vec3(0.0f, 0.0f, 0.0f),
		glm::vec3(2.0f, 0.0f, 0.0f),
		glm::vec3(4.0f, 0.0f, -1.0f),
		glm::vec3(-3.8f, -2.0f, -12.3f),
		glm::vec3(2.4f, -0.4f, -3.5f),
		glm::vec3(-1.7f, 3.0f, -7.5f),
		glm::vec3(1.3f, -2.0f, -2.5f),
		glm::vec3(1.5f, 2.0f, -2.5f),
		glm::vec3(1.5f, 0.2f, -1.5f),
		glm::vec3(-1.3f, 1.0f, -1.5f)
	};

	glm::vec3 pointLightPositions[] = {
		glm::vec3(0.7f, 0.2f, 2.0f),
		glm::vec3(2.3f, -3.3f, -4.0f),
		glm::vec3(-4.0f, 2.0f, -12.0f),
		glm::vec3(0.0f, 0.0f, -3.0f),
		glm::vec3(-3.0, -4.1, -3.0),
		glm::vec3(0.0, -4.1, -3.0)
	};
	



	Shader simpleDepthShader("shader/shadow.vert", "shader/shadow.frag");
	Shader shaderGeometryPass("shader/g_buffer.vert", "shader/g_buffer.frag");
	Shader shaderLightingPass("shader/deferred_shading.vert", "shader/deferred_shading.frag");
	Shader skyboxShader("shader/skybox.vert", "shader/skybox.frag");
	//Shader debugDepthQuad("quad.vert", "quad.frag");
	Shader hdr("shader/hdr.vert", "shader/hdr.frag");
	Shader ssrTrace("shader/ssrTrace.vert", "shader/ssrTrace.frag");
	Shader ssrResolve("shader/ssrresolve.vert", "shader/ssrresolve.frag");
	Shader ssrCombine("shader/ssrCombine.vert", "shader/ssrCombine.frag");
	Shader toScreen("shader/screen.vert", "shader/screen.frag");
	Shader TAA("shader/TAA.vert", "shader/TAA.frag");
	Shader convolve("shader/convolve.vert", "shader/convolve.frag");
	Shader emmisiveBuffer("shader/emmisive.vert", "shader/emmisive.frag");
	Shader emmisiveTrace("shader/emmiTrace.vert", "shader/emmiTrace.frag");

	//ourShader.Use();
	//glUniform1i(glGetUniformLocation(ourShader.Program, "diffuseTexture"), 0);
	//glUniform1i(glGetUniformLocation(ourShader.Program, "shadowMap"), 1);

	float scale = 1000.0f;
	GLfloat skyboxVertices[] = {
		// Positions          
		-1.0f*scale, 1.0f*scale, -1.0f*scale,
		-1.0f*scale, -1.0f*scale, -1.0f*scale,
		1.0f*scale, -1.0f*scale, -1.0f*scale,
		1.0f*scale, -1.0f*scale, -1.0f*scale,
		1.0f*scale, 1.0f*scale, -1.0f*scale,
		-1.0f*scale, 1.0f*scale, -1.0f*scale,

		-1.0f, -1.0f, 1.0f,
		-1.0f, -1.0f, -1.0f,
		-1.0f, 1.0f, -1.0f,
		-1.0f, 1.0f, -1.0f,
		-1.0f, 1.0f, 1.0f,
		-1.0f, -1.0f, 1.0f,

		1.0f, -1.0f, -1.0f,
		1.0f, -1.0f, 1.0f,
		1.0f, 1.0f, 1.0f,
		1.0f, 1.0f, 1.0f,
		1.0f, 1.0f, -1.0f,
		1.0f, -1.0f, -1.0f,

		-1.0f, -1.0f, 1.0f,
		-1.0f, 1.0f, 1.0f,
		1.0f, 1.0f, 1.0f,
		1.0f, 1.0f, 1.0f,
		1.0f, -1.0f, 1.0f,
		-1.0f, -1.0f, 1.0f,

		-1.0f, 1.0f, -1.0f,
		1.0f, 1.0f, -1.0f,
		1.0f, 1.0f, 1.0f,
		1.0f, 1.0f, 1.0f,
		-1.0f, 1.0f, 1.0f,
		-1.0f, 1.0f, -1.0f,

		-1.0f, -1.0f, -1.0f,
		-1.0f, -1.0f, 1.0f,
		1.0f, -1.0f, -1.0f,
		1.0f, -1.0f, -1.0f,
		-1.0f, -1.0f, 1.0f,
		1.0f, -1.0f, 1.0f
	};

	GLuint skyboxVAO, skyboxVBO;
	glGenVertexArrays(1, &skyboxVAO);
	glGenBuffers(1, &skyboxVBO);
	glBindVertexArray(skyboxVAO);
	glBindBuffer(GL_ARRAY_BUFFER, skyboxVBO);
	glBufferData(GL_ARRAY_BUFFER, sizeof(skyboxVertices), &skyboxVertices, GL_STATIC_DRAW);
	glEnableVertexAttribArray(0);
	glVertexAttribPointer(0, 3, GL_FLOAT, GL_FALSE, 3 * sizeof(GLfloat), (GLvoid*)0);
	glBindVertexArray(0);

	vector<const GLchar*> faces;
	faces.push_back("skybox/right1.png");
	faces.push_back("skybox/left1.png");
	faces.push_back("skybox/top1.png");
	faces.push_back("skybox/bottom1.png");
	faces.push_back("skybox/back1.png");
	faces.push_back("skybox/front1.png");

	vector<const GLchar*> IBLs;
	IBLs.push_back("cubemap1/cubemap5.png");
	IBLs.push_back("cubemap1/cubemap4.png");
	IBLs.push_back("cubemap1/cubemap6.png");
	IBLs.push_back("cubemap1/cubemap2.png");
	IBLs.push_back("cubemap1/cubemap1.png");
	IBLs.push_back("cubemap1/cubemap3.png");
	IBLs.push_back("cubemap1/cube_m00_c05.png");
	IBLs.push_back("cubemap1/cube_m00_c04.png");
	IBLs.push_back("cubemap1/cube_m00_c02.png");
	IBLs.push_back("cubemap1/cube_m00_c03.png");
	IBLs.push_back("cubemap1/cube_m00_c00.png");
	IBLs.push_back("cubemap1/cube_m00_c01.png");
	IBLs.push_back("cubemap1/cube_m01_c05.png");
	IBLs.push_back("cubemap1/cube_m01_c04.png");
	IBLs.push_back("cubemap1/cube_m01_c02.png");
	IBLs.push_back("cubemap1/cube_m01_c03.png");
	IBLs.push_back("cubemap1/cube_m01_c00.png");
	IBLs.push_back("cubemap1/cube_m01_c01.png");
	IBLs.push_back("cubemap1/cube_m02_c05.png");
	IBLs.push_back("cubemap1/cube_m02_c04.png");
	IBLs.push_back("cubemap1/cube_m02_c02.png");
	IBLs.push_back("cubemap1/cube_m02_c03.png");
	IBLs.push_back("cubemap1/cube_m02_c00.png");
	IBLs.push_back("cubemap1/cube_m02_c01.png");
	IBLs.push_back("cubemap1/cube_m03_c05.png");
	IBLs.push_back("cubemap1/cube_m03_c04.png");
	IBLs.push_back("cubemap1/cube_m03_c02.png");
	IBLs.push_back("cubemap1/cube_m03_c03.png");
	IBLs.push_back("cubemap1/cube_m03_c00.png");
	IBLs.push_back("cubemap1/cube_m03_c01.png");
	IBLs.push_back("cubemap1/cube_m04_c05.png");
	IBLs.push_back("cubemap1/cube_m04_c04.png");
	IBLs.push_back("cubemap1/cube_m04_c02.png");
	IBLs.push_back("cubemap1/cube_m04_c03.png");
	IBLs.push_back("cubemap1/cube_m04_c00.png");
	IBLs.push_back("cubemap1/cube_m04_c01.png");
	IBLs.push_back("cubemap1/cube_m05_c05.png");
	IBLs.push_back("cubemap1/cube_m05_c04.png");
	IBLs.push_back("cubemap1/cube_m05_c02.png");
	IBLs.push_back("cubemap1/cube_m05_c03.png");
	IBLs.push_back("cubemap1/cube_m05_c00.png");
	IBLs.push_back("cubemap1/cube_m05_c01.png");

	GLuint cubemapTexture = loadCubemap(faces);
	GLuint IBL;
	//glGenTextures(GL_TEXTURE_2D, &IBL);
	IBL = loadIBL(IBLs);
	struct haltonUniform {
		float haltonNum[200];
	}haltonUniform;

	const GLuint NR_LIGHTS = 10;
	struct Light {
		float position[4];
		float color[4];
		//float linear=0.7;
		//float quadratic=1.8;
	};

	struct LightInfo {
		Light light[NR_LIGHTS];
	}lightInfo;

	//struct LightIndex {
	//	int lightIndex[NR_LIGHTS];
	//}lightIndex;
	//std::vector<glm::vec3> lightPositions;
	//std::vector<glm::vec3> lightColors;
	srand(13);
	for (GLuint i = 0; i < NR_LIGHTS; i++)
	{

		GLfloat xPos = ((rand() % 100) / 100.0) * 6.0 - 3.0;
		GLfloat yPos = ((rand() % 100) / 100.0) * 6.0 - 4.0;
		GLfloat zPos = ((rand() % 100) / 100.0) * 6.0 - 3.0;
		//lightPositions.push_back(glm::vec3(xPos, yPos, zPos));
		lightInfo.light[i].position[0] = xPos;
		lightInfo.light[i].position[1] = yPos;
		lightInfo.light[i].position[2] = zPos;
		lightInfo.light[i].position[3] = 1;


		GLfloat rColor = ((rand() % 100) / 200.0f) + 0.5; // Between 0.5 and 1.0
		GLfloat gColor = ((rand() % 100) / 200.0f) + 0.5; // Between 0.5 and 1.0
		GLfloat bColor = ((rand() % 100) / 200.0f) + 0.5; // Between 0.5 and 1.0
		lightInfo.light[i].color[0] = rColor;
		lightInfo.light[i].color[1] = gColor;
		lightInfo.light[i].color[2] = bColor;
	}

	int workGroupsX = (screenWidth + (screenWidth % 16)) / 16;
	int workGroupsY = (screenHeight + (screenHeight % 16)) / 16;

	GLuint haltonSSBO = 0;
	glGenBuffers(1, &haltonSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, haltonSSBO);
	glBufferData(GL_SHADER_STORAGE_BUFFER, sizeof(haltonUniform), &haltonUniform, GL_DYNAMIC_COPY);
	glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 1, haltonSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

	GLuint lightSSBO = 0;
	glGenBuffers(1, &lightSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, lightSSBO);
	glBufferData(GL_SHADER_STORAGE_BUFFER, sizeof(LightInfo), &lightInfo, GL_DYNAMIC_COPY);
	glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 2, lightSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

	GLuint visibleLightIndexSSBO = 0;
	glGenBuffers(1, &visibleLightIndexSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, visibleLightIndexSSBO);
	glBufferData(GL_SHADER_STORAGE_BUFFER, sizeof(int)*workGroupsX*workGroupsY*1024, 0, GL_DYNAMIC_COPY);
	glBindBufferBase(GL_SHADER_STORAGE_BUFFER, 3, visibleLightIndexSSBO);
	glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

	emmisiveTrace.Use();
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "gSpecular"), 0);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "gNormal"), 1);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "gAlbedoSpec"), 2);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "shadowMap"), 3);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "sceneDepth"), 4);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "prevFrame1"), 5);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "blueNoise"), 6);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "BRDFLut"), 7);
	glUniform1i(glGetUniformLocation(emmisiveTrace.Program, "ePosition"), 8);

	ssrCombine.Use();
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "ssrBuffer"), 0);
	glUniform1i(glGetUniformLocation(ssrCombine.Program, "drBuffer"), 1);


	TAA.Use();
	glUniform1i(glGetUniformLocation(TAA.Program, "hdrBuffer"), 0);
	glUniform1i(glGetUniformLocation(TAA.Program, "prevBuffer"), 1);
	glUniform1i(glGetUniformLocation(TAA.Program, "gSpecular"), 2);
	glUniform1i(glGetUniformLocation(TAA.Program, "sceneDepth"), 3);
	glUniform1i(glGetUniformLocation(TAA.Program, "gNormal"), 4);
	glUniform1i(glGetUniformLocation(TAA.Program, "BRDFLut"), 5);


	hdr.Use();
	glUniform1i(glGetUniformLocation(hdr.Program, "linearBuffer"), 0);
	glUniform1i(glGetUniformLocation(ssrResolve.Program, "sceneDepth"), 1);

	toScreen.Use();
	glUniform1i(glGetUniformLocation(toScreen.Program, "hdrBuffer"), 0);
	glUniform1i(glGetUniformLocation(toScreen.Program, "sceneDepth"), 1);

	convolve.Use();
	glUniform1i(glGetUniformLocation(convolve.Program, "LastMip"), 0);

	//emmisiveBuffer.Use();
	//glunform1i()

	struct texture_delete
	{
		typedef GLuint pointer;
		void operator()(GLuint texturename)
		{
			glDeleteTextures(1, &texturename);
		}
	};
	std::cout << "Start loading texture" << std::endl;
	std::unique_ptr<TextureMap> blueNoiseTex(new TextureMap("./textures/tex_BlueNoise_256x256_UNI.png"));
	scene->addTextureMap("blueNoiseTex", blueNoiseTex.get());

	//std::unique_ptr<TextureMap> texture1_ptr(new TextureMap("textures/pbr1.map"));
	//std::unique_ptr<TextureMap> texture1d_ptr(new TextureMap("textures/brickwall.jpg"));
	//std::unique_ptr<TextureMap> texture1n_ptr(new TextureMap("textures/brickwall_normal.jpg"));
	std::unique_ptr<TextureMap> teath_d_ptr(new TextureMap("./textures/teeth_and_tongue_set_COL1.png"));
	std::unique_ptr<TextureMap> teath_s_ptr(new TextureMap("./textures/teeth_and_tongue_set_SPEC.png"));
	std::unique_ptr<TextureMap> teath_r_ptr(new TextureMap("./textures/teeth_and_tongue_set_GLOSS.png"));
	//std::unique_ptr<TextureMap> teath_n_ptr(new TextureMap("teeth_and_tongue_set_NOR.png"));
	std::unique_ptr<TextureMap> teath_n_ptr(new TextureMap("./textures/Aluminum-Scuffed_normal.png"));

	/*std::unique_ptr<TextureMap> floor_d_ptr(new TextureMap("textures/rustediron-streaks_basecolor.png"));
	std::unique_ptr<TextureMap> floor_s_ptr(new TextureMap("textures/rustediron-streaks_metallic.png"));
	std::unique_ptr<TextureMap> floor_r_ptr(new TextureMap("textures/rustediron-streaks_roughness.png"));
	std::unique_ptr<TextureMap> floor_n_ptr(new TextureMap("textures/rustediron-streaks_normal.png"));*/
	/*std::unique_ptr<TextureMap> floor_d_ptr(new TextureMap("textures/Aluminum-Scuffed_basecolor.png"));
	std::unique_ptr<TextureMap> floor_s_ptr(new TextureMap("textures/Aluminum-Scuffed_metallic.png"));
	std::unique_ptr<TextureMap> floor_r_ptr(new TextureMap("textures/Aluminum-Scuffed_roughness.png"));
	std::unique_ptr<TextureMap> floor_n_ptr(new TextureMap("textures/Aluminum-Scuffed_normal.png"));*/
	std::unique_ptr<TextureMap> buddha_d_ptr(new TextureMap("./textures/number.png"));
	scene->addTextureMap("buddha_d_ptr", buddha_d_ptr.get());
	std::unique_ptr<TextureMap> buddha_s_ptr(new TextureMap("./textures/oakfloor_Metallic.png"));
	scene->addTextureMap("buddha_s_ptr", buddha_s_ptr.get());
	std::unique_ptr<TextureMap> buddha_r_ptr(new TextureMap("./textures/Aluminum-Scuffed_roughness.png"));
	scene->addTextureMap("buddha_r_ptr", buddha_r_ptr.get());
	std::unique_ptr<TextureMap> buddha_n_ptr(new TextureMap("./textures/Aluminum-Scuffed_normal.png"));
	scene->addTextureMap("buddha_n_ptr", buddha_n_ptr.get());
	//std::unique_ptr<TextureMap> floor_d_ptr(new TextureMap("./textures/BLACK.png"));
	//std::unique_ptr<TextureMap> floor_s_ptr(new TextureMap("./textures/LIGHTGREY.png"));
	//std::unique_ptr<TextureMap> floor_r_ptr(new TextureMap("./textures/greyR.png"));
	//std::unique_ptr<TextureMap> floor_n_ptr(new TextureMap("./textures/rustediron-streaks_normal.png"));
	std::unique_ptr<TextureMap> floor_d_ptr(new TextureMap("./textures/iron-rusted4-basecolor.png"));
	std::unique_ptr<TextureMap> floor_s_ptr(new TextureMap("./textures/iron-rusted4-metalness.png"));
	std::unique_ptr<TextureMap> floor_r_ptr(new TextureMap("./textures/iron-rusted4-roughness_1.png"));
	std::unique_ptr<TextureMap> floor_n_ptr(new TextureMap("./textures/iron-rusted4-normal.png"));
	//std::unique_ptr<TextureMap> floor_d_ptr(new TextureMap("./textures/oakfloor_basecolor.png"));
	//std::unique_ptr<TextureMap> floor_s_ptr(new TextureMap("./textures/oakfloor_Metallic.png"));
	//std::unique_ptr<TextureMap> floor_r_ptr(new TextureMap("./textures/oakfloor_roughness_1_1.png"));
	//std::unique_ptr<TextureMap> floor_n_ptr(new TextureMap("./textures/oakfloor_normal.png"));
	//std::unique_ptr<TextureMap> planeNormal(new TextureMap("./textures/greasy-metal-pan1-normal.png"));
	std::unique_ptr<TextureMap> planeNormal(new TextureMap("textures/Aluminum-Scuffed_normal.png"));

	scene->addTextureMap("floor_d_ptr", floor_d_ptr.get());	
	scene->addTextureMap("floor_s_ptr", floor_s_ptr.get());	
	scene->addTextureMap("floor_r_ptr", floor_r_ptr.get());	
	scene->addTextureMap("floor_n_ptr", floor_n_ptr.get());	
	scene->addTextureMap("planeNormal", planeNormal.get());
	glBindTexture(GL_TEXTURE_2D, planeNormal->textureID);
	glGenerateMipmap(GL_TEXTURE_2D);
	glBindTexture(GL_TEXTURE_2D, 0);
	//std::unique_ptr<TextureMap> BRDFLut(new TextureMap("textures/integrateDFG_RG16F.dds"));
	//std::unique_ptr<TextureMap> BRDFLut(new TextureMap("textures/PreIntegratedGF.png"));

	//GLuint BRDFLut;
	//glGenTextures(1, &BRDFLut);
	int width, height, bpp;
	unsigned char* image = stbi_load("./textures/PreIntegratedGF.png", &width, &height, &bpp, 3);
	//glBindTexture(GL_TEXTURE_2D, BRDFLut);
	//glTexImage2D(GL_TEXTURE_2D, 0, GL_RGB16F, width, height, 0, GL_RGB, GL_UNSIGNED_BYTE, image);
	//glGenerateMipmap(GL_TEXTURE_2D);
	//glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_REPEAT);
	//glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_REPEAT);
	//glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR_MIPMAP_LINEAR);
	//glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	//glBindTexture(GL_TEXTURE_2D, 0);
	TextureMap BRDFLut(width, height, GL_RGB32F, GL_RGB, GL_UNSIGNED_BYTE, image, GL_REPEAT, GL_REPEAT, GL_LINEAR_MIPMAP_LINEAR, GL_LINEAR_MIPMAP_LINEAR);
	scene->addTextureMap("BRDFLut", &BRDFLut);
	stbi_image_free(image);

	std::cout << "Loading Texture Finished\n" << std::endl;


	//Model ourModel("box.obj");
	RenderObject ourModel("box.obj");
	scene->addRenderObject("ourModel", &ourModel);
	//Model buddha("happy-buddha-webgl-sub-surface-scattering.obj");
	ourModel.getModel().emmisive = false;

	std::vector<glm::vec3> objectPositions;
	objectPositions.push_back(glm::vec3(-3.0, -3.8, -3.0));
	objectPositions.push_back(glm::vec3(0.0, -3.8, -3.0));
	//objectPositions.push_back(glm::vec3(3.0, -4.1, -3.0));
	//objectPositions.push_back(glm::vec3(-3.0, -4.1, 0.0));
	//objectPositions.push_back(glm::vec3(0.0, -4.1, 0.0));
	//objectPositions.push_back(glm::vec3(3.0, -4.1, 0.0));
	//objectPositions.push_back(glm::vec3(-3.0, -4.1, 3.0));
	//objectPositions.push_back(glm::vec3(0.0, -4.1, 3.0));
	//objectPositions.push_back(glm::vec3(3.0, -4.1, 3.0));

	
	//Framebuffer gBuffer;
	//gBuffer.Bind();

	TextureMap gSpecular(screenWidth, screenHeight, GL_RGB32F, GL_RGB, GL_FLOAT, NULL, GL_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	TextureMap gNormal(screenWidth, screenHeight, GL_RGBA32F, GL_RGBA, GL_FLOAT, NULL, GL_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	TextureMap gAlbedoSpec(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("gSpecular", &gSpecular);	
	scene->addTextureMap("gNormal", &gNormal);	
	scene->addTextureMap("gAlbedoSpec", &gAlbedoSpec);

	err = glGetError();
	//gbuffer depth

	TextureMap rboDepth(screenWidth, screenHeight, GL_DEPTH_COMPONENT32, GL_DEPTH_COMPONENT, GL_FLOAT, NULL, GL_NEAREST_MIPMAP_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("rboDepth", &rboDepth);

	//shadow
	Framebuffer depthMapFBO;
	const GLuint shadowWidth = 1024, shadowHeight = 1024;
	TextureMap depthMap(shadowWidth, shadowHeight, GL_DEPTH_COMPONENT, GL_DEPTH_COMPONENT, GL_FLOAT, NULL, GL_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("depthMap", &depthMap);
	depthMapFBO.Bind();
	depthMapFBO.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, depthMap.textureID);
	glDrawBuffer(GL_NONE);
	glReadBuffer(GL_NONE);
	depthMapFBO.Unbind();



	Framebuffer hdrFBO;
	hdrFBO.Bind();
	TextureMap hdrColorBuffer(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR, GL_LINEAR, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("hdrColorBuffer", &hdrColorBuffer);
	hdrFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, hdrColorBuffer.textureID);

	Framebuffer linearFBO;
	linearFBO.Bind();
	TextureMap linearColorBuffer(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR, GL_LINEAR, GL_CLAMP_TO_BORDER, GL_CLAMP_TO_BORDER);
	scene->addTextureMap("linearColorBuffer", &linearColorBuffer);
	linearFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, linearColorBuffer.textureID);
	linearFBO.AttachTexture(0, GL_DEPTH_ATTACHMENT, GL_TEXTURE_2D, rboDepth.textureID);

	Framebuffer SSRHitpointFBO;
	SSRHitpointFBO.Bind();
	TextureMap SSRHitPoint(screenWidth, screenHeight, GL_RGBA32F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR, GL_LINEAR, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("SSRHitPoint", &SSRHitPoint);
	SSRHitpointFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, SSRHitPoint.textureID);

	Framebuffer EmmisiveColorFBO;
	EmmisiveColorFBO.Bind();
	TextureMap SSRHitPixel(screenWidth, screenHeight, GL_RGBA32F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR, GL_LINEAR, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("SSRHitPixel", &SSRHitPixel);
	EmmisiveColorFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, SSRHitPixel.textureID);
	EmmisiveColorFBO.Unbind();

	Framebuffer SSRColorFBO;
	SSRColorFBO.Bind();
	TextureMap currSSR(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_NEAREST, GL_LINEAR, GL_CLAMP_TO_BORDER, GL_CLAMP_TO_BORDER);
	scene->addTextureMap("currSSR", &currSSR);
	SSRColorFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, currSSR.textureID);
	SSRColorFBO.Unbind();

	Framebuffer prevFrameFBO;
	prevFrameFBO.Bind();
	TextureMap prevColorFrame1(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR_MIPMAP_LINEAR, GL_LINEAR, GL_CLAMP_TO_BORDER, GL_CLAMP_TO_BORDER);
	scene->addTextureMap("prevColorFrame1", &prevColorFrame1);
	prevFrameFBO.AttachTexture(0, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, prevColorFrame1.textureID);
	prevFrameFBO.Unbind();

	Framebuffer emmisiveFBO;
	emmisiveFBO.Bind();
	TextureMap prevSSR1(screenWidth, screenHeight, GL_RGBA16F, GL_RGBA, GL_FLOAT, NULL, GL_LINEAR, GL_LINEAR, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("prevSSR1", &prevSSR1);
	TextureMap emmisiveDepth(screenWidth, screenHeight, GL_DEPTH_COMPONENT24, GL_DEPTH_COMPONENT, GL_FLOAT, NULL, GL_NEAREST, GL_NEAREST, GL_REPEAT, GL_REPEAT);
	scene->addTextureMap("emmisiveDepth", &emmisiveDepth);
	emmisiveFBO.AttachTexture(0, GL_DEPTH_COMPONENT, GL_TEXTURE_2D, emmisiveDepth.textureID);
	emmisiveFBO.Unbind();

	GBufferPass gBufferPass(screenWidth, screenHeight, scene.get());
	gBufferPass.init();

	HiZDepthPass hiZDepthPass(screenWidth, screenHeight, scene.get());
	hiZDepthPass.init();

	LightCullingPass lightCullingPass(screenWidth, screenHeight, workGroupsX, workGroupsY, scene.get());
	lightCullingPass.init();

	DeferredShadingPass deferredShadingPass(screenWidth, screenHeight, workGroupsX, scene.get());
	deferredShadingPass.init();

	SsrTracePass ssrTracePass(screenWidth, screenHeight, scene.get());
	ssrTracePass.init();

	SsrResolvePass ssrResolvePass(screenWidth, screenHeight, scene.get());
	ssrResolvePass.init();

	SsrCombinePass ssrCombinePass(scene.get());
	ssrCombinePass.init();

	TemporalSsaaPass temporalSsaaPass(screenWidth, screenHeight, scene.get());
	temporalSsaaPass.init();


	glClearColor(0.0f, 0.0f, 0.0f, 0.0f);

	ImGui_ImplGlfwGL3_Init(window, true);


	bool show_test_window = true;
	bool show_another_window = false;
	bool flagShadowMap = false;
	bool flagAniso = true;
	ImVec4 clear_color = ImColor(114, 144, 154);
	GLfloat exposure = 2.9f;
	float tempRoughness = 0.018f;
	float resolve = 5.01f;
	float binaryIteration = 30;
	float pixelStride = 6.985f;
	bool flagHDR = true;
	float currentFrameIndex = 0;
	bool flagTemporal = true;
	float TAAscale = 1.0f;
	float TAAresponse = 0.85f;
	int depthLevel = 1;
	float debugMip = 0;
	float initStep = 20.0f;
	float sampleBias = 0.7f;
	float angle = 0;
	bool flagHiZ = true;
	bool flagEmmisive = false;
	int debugTest = 1;


	float t_ssrTrace;
	float t_ssrResolve;
	float t_hiz;
	float t_taa;
	float t_emmit;

	glDisable(GL_BLEND);
	glm::mat4 previousProjection;
	glm::mat4 projection;
	glm::mat4 previousfov2Projection;
	glm::mat4 fov2projection;
	glm::mat4 view;
	glm::mat4 previousView;
	std::random_device rd;
	std::mt19937 mt(rd());
	std::uniform_real_distribution<float> dist(1.0, 1000.0);
	//float _halton[1005];
	for (int i = 1; i <= 200; i++)
	{
		haltonUniform.haltonNum[i-1] = halton(i, 3);
	}

	GLuint64 startTime, stopTime;
	unsigned int queryID[2];

	// generate two queries
	glGenQueries(2, queryID);
	while (!glfwWindowShouldClose(window))
	{
		glBindBuffer(GL_SHADER_STORAGE_BUFFER, haltonSSBO);
		GLvoid* haltonPointer = glMapBuffer(GL_SHADER_STORAGE_BUFFER, GL_WRITE_ONLY);
		memcpy(haltonPointer, &haltonUniform, sizeof(haltonUniform));
		glUnmapBuffer(GL_SHADER_STORAGE_BUFFER);
		currentFrameIndex = fmod((currentFrameIndex + 1), 65535);

		glBindBuffer(GL_SHADER_STORAGE_BUFFER, lightSSBO);
		GLvoid* lightPointer = glMapBuffer(GL_SHADER_STORAGE_BUFFER, GL_WRITE_ONLY);
		memcpy(lightPointer, &lightInfo, sizeof(lightInfo));
		glUnmapBuffer(GL_SHADER_STORAGE_BUFFER);
		glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

		//glBindBuffer(GL_SHADER_STORAGE_BUFFER, visibleLightIndexSSBO);
		//GLvoid* lightIndexPointer = glMapBuffer(GL_SHADER_STORAGE_BUFFER, GL_WRITE_ONLY);
		//memcpy(lightIndexPointer, &lightIndex, sizeof(lightIndex));
		//glUnmapBuffer(GL_SHADER_STORAGE_BUFFER);
		//glBindBuffer(GL_SHADER_STORAGE_BUFFER, 0);

		GLfloat currentFrame = glfwGetTime();
		deltaTime = currentFrame - lastFrame;
		lastFrame = currentFrame;

		glfwPollEvents();
		ImGui_ImplGlfwGL3_NewFrame();
		Do_Movement();


		glm::vec3 lightPos(1.2f, 4.0f, 10.0f);

		glm::mat4 lightProjection, lightView;
		glm::mat4 lightSpaceMatrix;

		GLfloat nearPlane = -4.0f, farPlane = 20.5f;
		lightProjection = glm::ortho(-25.0f, 25.0f, -25.0f, 25.0f, nearPlane, farPlane);
		lightView = glm::lookAt(lightPos, glm::vec3(0.0f), glm::vec3(0.0, 1.0, 0.0));
		lightSpaceMatrix = lightProjection * lightView;
		glm::vec3 model_scale = glm::vec3(1.0f, 0.75f, 0.0f);

		if (flagShadowMap)
		{
			simpleDepthShader.Use();
			glm::mat4 model11;
			//GLint aaa=glGetUniformLocation(simpleDepthShader.Program, "lightSpaceMatrix");
			//glUniformMatrix4fv(aaa, 1, GL_FALSE, glm::value_ptr(lightSpaceMatrix));
			//glUniformMatrix4fv(glGetUniformLocation(simpleDepthShader.Program, "model"), 1, GL_FALSE, glm::value_ptr(model11));
			simpleDepthShader.SetUniform("lightSpaceMatrix", lightSpaceMatrix);
			simpleDepthShader.SetUniform("model", model11);

			glViewport(0, 0, shadowWidth, shadowHeight);
			depthMapFBO.Bind();
			glClear(GL_DEPTH_BUFFER_BIT);
			glCullFace(GL_FRONT);
			RenderQuad();
			glm::mat4 model1;

			for (GLuint i = 0; i < objectPositions.size(); i++)
			{
				model1 = glm::mat4();
				model1 = glm::translate(model1, objectPositions[i]);
				model1 = glm::scale(model1, glm::vec3(0.15f));
				simpleDepthShader.SetUniform("model", model1);
				ourModel.getModel().Draw(simpleDepthShader);
			}
			glCullFace(GL_BACK);
			depthMapFBO.Unbind();
		}
		glViewport(0, 0, screenWidth, screenHeight);
		//glDepthRange(0.0, 0.999);
		glEnable(GL_CULL_FACE);
		glCullFace(GL_BACK);
		previousProjection = projection;
		previousfov2Projection = fov2projection;
		projection = glm::perspective(camera.Zoom, (GLfloat)screenWidth / (GLfloat)screenHeight, 0.01f, 100.0f);
		projection[2][0] = haltonUniform.haltonNum[(int)currentFrameIndex % 200] * 2 - 1;
		projection[2][1] = haltonUniform.haltonNum[(int)(currentFrameIndex + 15) % 200] * 2 - 1;
		projection[2][0] /= screenWidth * 64;
		projection[2][1] /= screenHeight * 64;

		fov2projection = glm::perspective(camera.Zoom * 2, (GLfloat)screenWidth / (GLfloat)screenHeight, 0.01f, 100.0f);
		fov2projection[2][0] = haltonUniform.haltonNum[(int)currentFrameIndex % 999] * 2 - 1; 
		fov2projection[2][1] = haltonUniform.haltonNum[(int)(currentFrameIndex + 15) % 999] * 2 - 1;
		fov2projection[2][0] /= screenWidth * 64;
		fov2projection[2][1] /= screenHeight * 64;


		view = camera.GetViewMatrix();
		
		gBufferPass.update(view, projection, objectPositions);
		gBufferPass.execute();

		lightCullingPass.update(view, projection, NR_LIGHTS);
		lightCullingPass.execute();




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





		glQueryCounter(queryID[0], GL_TIMESTAMP);

		hiZDepthPass.update();
		hiZDepthPass.execute();

		glQueryCounter(queryID[1], GL_TIMESTAMP);
		GLint stopTimerAvailable = 0;
		while (!stopTimerAvailable) {
			glGetQueryObjectiv(queryID[1],
				GL_QUERY_RESULT_AVAILABLE,
				&stopTimerAvailable);
		}
		glGetQueryObjectui64v(queryID[0], GL_QUERY_RESULT, &startTime);
		glGetQueryObjectui64v(queryID[1], GL_QUERY_RESULT, &stopTime);
		//if ((int)currentFrameIndex % 3 == 0) printf("HiZ: %f ms\n", (stopTime - startTime) / 1000000.0);
		t_hiz = (stopTime - startTime) / 1000000.0;

		glDepthMask(GL_FALSE);

		deferredShadingPass.update(view,
			projection,
			previousProjection,
			previousView,
			lightSpaceMatrix,
			camera.Position,
			lightPos,
			tempRoughness,
			currentFrameIndex,
			resolve,
			binaryIteration,
			pixelStride,
			depthLevel,
			initStep,
			sampleBias,
			flagShadowMap);
		deferredShadingPass.execute();

		
		ssrTracePass.update(
			view, 
			projection, 
			previousProjection, 
			previousView,
			camera.Position,
			tempRoughness,
			currentFrameIndex, 
			resolve, 
			binaryIteration, 
			pixelStride, 
			depthLevel, 
			initStep, 
			sampleBias, 
			flagHiZ);
		glQueryCounter(queryID[0], GL_TIMESTAMP);
		ssrTracePass.execute();
		//RenderBufferQuad();
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

		t_ssrTrace = (stopTime - startTime) / 1000000.0;




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

		ssrResolvePass.update(view,
						projection,
						previousProjection,
						previousView,
						camera.Position,
						tempRoughness,
						currentFrameIndex,
						resolve,
						binaryIteration,
						pixelStride,
						depthLevel,
						initStep,
						sampleBias,
						flagShadowMap,
						flagEmmisive,
						angle,
						IBL);
		

		glQueryCounter(queryID[0], GL_TIMESTAMP);
		ssrResolvePass.execute();
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

		t_ssrResolve = (stopTime - startTime) / 1000000.0;

		glBindFramebuffer(GL_FRAMEBUFFER, 0);
		glCopyImageSubData(currSSR.textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
			prevSSR1.textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
			screenWidth, screenHeight, 1);


		ssrCombinePass.update();
		ssrCombinePass.execute();


		//glBindFramebuffer(GL_FRAMEBUFFER, linearFBO);
		linearFBO.Bind();
		glDepthFunc(GL_LEQUAL);
		glDepthRange(0.999, 0.99999);
		skyboxShader.Use();
		previousView = view;
		view = glm::mat4(glm::mat3(camera.GetViewMatrix()));    // Remove any translation component of the view matrix
		glUniformMatrix4fv(glGetUniformLocation(skyboxShader.Program, "view"), 1, GL_FALSE, glm::value_ptr(view));
		//projection[2][0] = 0; projection[2][1] = 0;
		glUniformMatrix4fv(glGetUniformLocation(skyboxShader.Program, "projection"), 1, GL_FALSE, glm::value_ptr(projection));

		glBindVertexArray(skyboxVAO);
		glActiveTexture(GL_TEXTURE0);
		glUniform1i(glGetUniformLocation(skyboxShader.Program, "skybox"), 0);
		glBindTexture(GL_TEXTURE_CUBE_MAP, cubemapTexture);
		glDrawArrays(GL_TRIANGLES, 0, 36);
		glBindVertexArray(0);
		glDepthFunc(GL_LESS);
		glDepthRange(0, 1.0f);

		linearFBO.Unbind();


		temporalSsaaPass.update(
			view,
			projection,
			previousProjection,
			previousView,
			camera.Position,
			TAAscale,
			TAAresponse,
			flagTemporal
			);
		glQueryCounter(queryID[0], GL_TIMESTAMP);
		//RenderBufferQuad();
		temporalSsaaPass.execute();
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

		t_taa = (stopTime - startTime) / 1000000.0;
		glCopyImageSubData(linearColorBuffer.textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
			prevColorFrame1.textureID, GL_TEXTURE_2D, 0, 0, 0, 0,
			screenWidth, screenHeight, 1);
		glBindTexture(GL_TEXTURE_2D, prevColorFrame1.textureID);
		glGenerateMipmap(GL_TEXTURE_2D);
		glBindTexture(GL_TEXTURE_2D, 0);

		glDepthMask(GL_TRUE);


		//glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
		hdrFBO.Bind();
		//glClear(GL_COLOR_BUFFER_BIT);
		hdr.Use();
		glActiveTexture(GL_TEXTURE0);
		glBindTexture(GL_TEXTURE_2D, linearColorBuffer.textureID);
		glActiveTexture(GL_TEXTURE1);
		glBindTexture(GL_TEXTURE_2D, gSpecular.textureID);

		hdr.SetUniform("hdr", flagHDR);
		hdr.SetUniform("exposure", exposure);
		hdr.SetUniform("screenWidth", (float)screenWidth);
		hdr.SetUniform("screenHeight", (float)screenHeight);
		hdr.SetUniform("temporal", flagTemporal);
		hdr.SetUniform("TAAscale", TAAscale);
		hdr.SetUniform("TAAresponse", TAAresponse);

		RenderBufferQuad();



		glBindFramebuffer(GL_FRAMEBUFFER, 0);
		glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);
		toScreen.Use();
		glActiveTexture(GL_TEXTURE0);
		glBindTexture(GL_TEXTURE_2D, hdrColorBuffer.textureID);
		glActiveTexture(GL_TEXTURE1);
		glBindTexture(GL_TEXTURE_2D, SSRHitPoint.textureID);
		toScreen.SetUniform("miplevel", (float)debugMip);
		RenderBufferQuad();

		{
			static float f = 0.0f;
			//int depthTestint = debugTest;
			//ImGui::Text("Hello, world!");
			//ImGui::SliderFloat("float", &f, 0.0f, 1.0f);
			//ImGui::ColorEdit3("clear color", (float*)&clear_color);
			//if (ImGui::Button("Test Window")) show_test_window ^= 1;
			//if (ImGui::Button("Another Window")) show_another_window ^= 1;
			//ImGui::SliderFloat("exposure", &exposure, 0.0f, 6.0f);
			ImGui::SliderFloat("roughness", &tempRoughness, 0.014f, 0.99f);
			ImGui::SliderFloat("resolve", &resolve, 1.0f, 12.1f);
			//ImGui::SliderFloat("BinaryIter",&binaryIteration,1.0f,50.0f);
			//ImGui::SliderFloat("stride",&pixelStride,1.0f,30.0f);
			ImGui::SliderFloat("TAAWeight", &TAAresponse, 0.0f, 1.0f);
			ImGui::SliderFloat("TAAScale", &TAAscale, 0.0f, 3.0f);
			//ImGui::SliderInt("DepthLevel", &depthLevel, 0.0f, 15.0f);
			//ImGui::SliderFloat("DebugMip", &debugMip, 0.0f, 15.0f);
			//ImGui::SliderFloat("initStep", &initStep, 0.0f, 50.0f);
			//ImGui::SliderFloat("sampleBias",&sampleBias,0.0f,0.9f);
			//ImGui::SliderInt("debugTest", &debugTest, 1.0f, 6.0f);
			//ImGui::SliderFloat("rangle", &angle, 0.0f, 1.0f);
			//if (ImGui::Button("Shadow")) flagShadowMap ^= 1;
			//if (ImGui::Button("Anisotropic")) flagAniso ^= 1;
			if (ImGui::Button("TAA")) flagTemporal ^= 1;
			if (ImGui::Button("HiZ")) flagHiZ ^= 1;
			if (ImGui::Button("Emmisive")) flagEmmisive ^= 1;

			ImGui::Text(" %.1f ms/frame (%.1f FPS)", 1000.0f / ImGui::GetIO().Framerate, ImGui::GetIO().Framerate);
			ImGui::Text("HiZ:  %.4f", t_hiz);
			ImGui::Text("ssrTrace:  %.4f", t_ssrTrace);
			//ImGui::Text("emmiTrace:  %.4f", t_emmit);
			ImGui::Text("ssrResolve:  %.4f", t_ssrResolve);
			ImGui::Text("TAA:  %.4f", t_taa);
		}
		int display_w, display_h;
		glfwGetFramebufferSize(window, &display_w, &display_h);
		glViewport(0, 0, display_w, display_h);
		//glClearColor(0.0f, 0.0f, 0.0f, 1.0f);
		//glClear(GL_COLOR_BUFFER_BIT);
		ImGui::Render();

		//glViewport(0, 0, screenWidth, screenHeight);
		glfwSwapBuffers(window);
	}

	ImGui_ImplGlfwGL3_Shutdown();
	glfwTerminate();
	return 0;
}


void Do_Movement()
{
	ImGuiIO& io = ImGui::GetIO();
	if (io.KeysDown[GLFW_KEY_W])
		camera.ProcessKeyboard(FORWARD, deltaTime);
	if (io.KeysDown[GLFW_KEY_S])
		camera.ProcessKeyboard(BACKWARD, deltaTime);
	if (io.KeysDown[GLFW_KEY_A])
		camera.ProcessKeyboard(LEFT, deltaTime);
	if (io.KeysDown[GLFW_KEY_D])
		camera.ProcessKeyboard(RIGHT, deltaTime);
}


void key_callback(GLFWwindow* window, int key, int scancode, int action, int mode)
{

	if (key == GLFW_KEY_ESCAPE && action == GLFW_PRESS)
	{
		glfwSetWindowShouldClose(window, GL_TRUE);
	}

	if (action == GLFW_PRESS)
	{
		keys[key] = true;
	}
	if (action == GLFW_RELEASE)
	{
		keys[key] = false;
	}


}


void mouse_callback(GLFWwindow* window, double xpos, double ypos)
{
	ImGuiIO& io = ImGui::GetIO();

	if (firstMouse)
	{
		lastX = xpos;
		lastY = ypos;
		firstMouse = false;
	}

	GLfloat xoffset = xpos - lastX;
	GLfloat yoffset = ypos - lastY;

	lastX = xpos;
	lastY = ypos;
	if (io.KeysDown[GLFW_KEY_Q])
	{

		camera.ProcessMouseMovement(xoffset, yoffset);
	}

}


void scroll_callback(GLFWwindow* window, double xoffset, double yoffset)
{
	camera.ProcessMouseScroll(yoffset);
}