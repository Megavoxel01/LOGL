#include "shader.h"





void Shader::SetUniform(const GLchar* name, const glm::mat4& mat)const
{

	glUniformMatrix4fv(Uniform(name), 1, GL_FALSE, glm::value_ptr(mat));
}

void Shader::SetUniform(const GLchar* name, const glm::mat3& mat)const
{

	glUniformMatrix3fv(Uniform(name), 1, GL_FALSE, glm::value_ptr(mat));
}

void Shader::SetUniform(const GLchar* name, const float& value)const
{

	glUniform1f(Uniform(name), value);
}

void Shader::SetUniform(const GLchar* name, GLfloat* value)const
{

	glUniform3fv(Uniform(name),1,value);
}

void Shader::SetUniform(const GLchar* name, const int& value)const
{

	glUniform1i(Uniform(name), value);
}


void Shader::SetUniform(const GLchar* name, const glm::vec2& vec)const
{

	glUniform2f(Uniform(name), vec[0], vec[1]);
}

void Shader::SetUniform(const GLchar* name, const glm::ivec2& vec)const
{

	glUniform2f(Uniform(name), vec[0], vec[1]);
}

void Shader::SetUniform(const GLchar* name, const glm::vec3& vec)const
{

	glUniform3f(Uniform(name), vec[0], vec[1], vec[2]);
}

void Shader::SetUniform(const GLchar* name, const glm::vec4& vec)const
{
	glUniform4f(Uniform(name), vec[0], vec[1], vec[2], vec[3]);
}


void Shader::BindTexture(int slot, GLint texID, GLchar* name) const
{
	glActiveTexture(GL_TEXTURE0+slot);
	glBindTexture(GL_TEXTURE_2D, texID);
	const auto loc = glGetUniformLocation(this->Program, name);
	glUniform1i(loc, slot);
}


