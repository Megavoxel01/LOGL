#ifndef SHADER_H
#define SHADER_H

#include <GL/glew.h>
#include <glm/glm.hpp>
//#include <GLFW/glfw3.h>
#include <glm/gtc/type_ptr.hpp>
#include <string>
#include <fstream>
#include <sstream>
#include <iostream>
#include <string>


class Shader
{
public:
    GLuint Program;
    // Constructor generates the shader on the fly

	Shader::Shader(const GLchar* computePath) {
		std::string computeCode;
		std::ifstream computeShaderFile;

		// Ensure that ifstream objects can throw exceptions
		computeShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);

		try {
			// Open file
			computeShaderFile.open(computePath);
			std::stringstream cShaderStream;

			// Read file;s buffer contents into streams
			cShaderStream << computeShaderFile.rdbuf();

			// close file handlers
			computeShaderFile.close();

			// Convert stream to string
			computeCode = cShaderStream.str();
		}
		catch (std::ifstream::failure e) {
			std::cout << "ERROR::SHADER::FILE_NOT_SUCCESFULLY_READ" << std::endl;
		}

		// Then compile shader
		const GLchar* computeShaderCode = computeCode.c_str();

		GLuint compute;

		// Compute shader
		compute = glCreateShader(GL_COMPUTE_SHADER);
		glShaderSource(compute, 1, &computeShaderCode, NULL);
		glCompileShader(compute);
		checkCompileErrors(compute, "COMPUTE");

		// Create the shader program
		this->Program = glCreateProgram();
		glAttachShader(this->Program, compute);

		glLinkProgram(this->Program);
		checkCompileErrors(this->Program, "PROGRAM");

		// No longer need the shaders, delete them
		glDeleteShader(compute);
	}
	Shader(const GLchar* vertexPath, const GLchar* fragmentPath, const GLchar* geometryPath=nullptr)
		:vsName(vertexPath),
		fsName(fragmentPath)
	{

		std::string vertexCode;
		std::string fragmentCode;
		std::string geometryCode;
		std::ifstream vShaderFile;
		std::ifstream fShaderFile;
		std::ifstream gShaderFile;

		vShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);
		fShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);
		gShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);
		try
		{

			vShaderFile.open(vertexPath);
			fShaderFile.open(fragmentPath);
			std::stringstream vShaderStream, fShaderStream;

			vShaderStream << vShaderFile.rdbuf();
			fShaderStream << fShaderFile.rdbuf();

			vShaderFile.close();
			fShaderFile.close();

			vertexCode = vShaderStream.str();
			fragmentCode = fShaderStream.str();

			if (geometryPath != nullptr)
			{
				gShaderFile.open(geometryPath);
				std::stringstream gShaderStream;
				gShaderStream << gShaderFile.rdbuf();
				gShaderFile.close();
				geometryCode = gShaderStream.str();
			}
		}
		catch (std::ifstream::failure e)
		{
			std::cout << "ERROR::SHADER::FILE_NOT_SUCCESFULLY_READ" << std::endl;
		}
		const GLchar* vShaderCode = vertexCode.c_str();
		const GLchar * fShaderCode = fragmentCode.c_str();

		GLuint vertex, fragment;
		GLint success;
		GLchar infoLog[512];

		vertex = glCreateShader(GL_VERTEX_SHADER);
		glShaderSource(vertex, 1, &vShaderCode, NULL);
		glCompileShader(vertex);
		checkCompileErrors(vertex, "VERTEX");

		fragment = glCreateShader(GL_FRAGMENT_SHADER);
		glShaderSource(fragment, 1, &fShaderCode, NULL);
		glCompileShader(fragment);
		checkCompileErrors(fragment, "FRAGMENT");

		GLuint geometry;
		if (geometryPath != nullptr)
		{
			const GLchar * gShaderCode = geometryCode.c_str();
			geometry = glCreateShader(GL_GEOMETRY_SHADER);
			glShaderSource(geometry, 1, &gShaderCode, NULL);
			glCompileShader(geometry);
			checkCompileErrors(geometry, "GEOMETRY");
		}

		this->Program = glCreateProgram();
		glAttachShader(this->Program, vertex);
		glAttachShader(this->Program, fragment);
		if (geometryPath != nullptr)
			glAttachShader(this->Program, geometry);
		glLinkProgram(this->Program);
		checkCompileErrors(this->Program, "PROGRAM");

		glDeleteShader(vertex);
		glDeleteShader(fragment);
		if (geometryPath != nullptr)
			glDeleteShader(geometry);
	}
    void Use()
	{
		glUseProgram(this->Program); 
	}
	GLint Uniform(const GLchar* uniformName)const
	{
		return glGetUniformLocation(this->Program, uniformName);
	}
	
	void SetUniform(const GLchar* name, const glm::mat4& mat)const;
	void SetUniform(const GLchar* name, const glm::mat3& mat)const;
	void SetUniform(const GLchar* name, const float& value)const;
	void SetUniform(const GLchar* name, const int& value)const;
	void SetUniform(const GLchar* name, const glm::vec2& vec)const;
	void SetUniform(const GLchar* name, const glm::ivec2& vec)const;
	void SetUniform(const GLchar* name, const glm::vec3& vec)const;
	void SetUniform(const GLchar* name, const glm::vec4& vec)const;
	void SetUniform(const GLchar* name, GLfloat* value)const;
	void BindTexture(int slot, GLint texID, GLchar* name) const;

	

private:
	void checkCompileErrors(GLuint shader, std::string type)const
	{
		GLint success;
		GLchar infoLog[1024];
		if (type != "PROGRAM")
		{
			glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
			if (!success)
			{
				glGetShaderInfoLog(shader, 1024, NULL, infoLog);
				std::cout << "Shader Name:" << vsName << "|||" << fsName << std::endl;
				std::cout << "| ERROR::::SHADER-COMPILATION-ERROR of type: " << type << "|\n" << infoLog << "\n| -- --------------------------------------------------- -- |" << std::endl;

			}
		}
		else
		{
			glGetProgramiv(shader, GL_LINK_STATUS, &success);
			if (!success)
			{
				glGetProgramInfoLog(shader, 1024, NULL, infoLog);
				std::cout << "Shader Name:" << vsName << "|||" << fsName << std::endl;
				std::cout << "| ERROR::::PROGRAM-LINKING-ERROR of type: " << type << "|\n" << infoLog << "\n| -- --------------------------------------------------- -- |" << std::endl;

			}
		}
	}
	std::string vsName;
	std::string fsName;
};

#endif