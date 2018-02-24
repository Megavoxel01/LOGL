#pragma once
#include <RenderPass.h>
#include <Camera.h>

class ShadowMapping : public RenderPass {
public:
	ShadowMapping(Camera* _camera, Scene *scene);
	~ShadowMapping();
	void init();
	void update(const glm::mat4& projection, const glm::mat4& view, glm::vec3& lightdir, const Camera* camera, std::vector<glm::vec3>& objectPositions);
	void update_split_distances();
	void update_split_frustum_points();
	void generate_crop_matrices(const glm::mat4& t_modelview);
	void update_split_frustum_points(Camera* camera);
	void update_far_bounds(const glm::mat4& projection, const glm::mat4& view_inverse);
	void update_texture_matrices(const glm::mat4& projection, const glm::mat4& view_inverse);
	void execute();
	struct Frustum {
		float m_fov = 45.0f;
		float m_ratio = 0.5f;
		float m_near = 1.0f;
		float m_far = 200.0f;
		glm::vec3 m_points[8];
	};
	Framebuffer m_fbo;
	const static int m_num_splits = 3;
	GLuint m_texture_array;
	glm::mat4 m_texture_matrices[m_num_splits];
	glm::mat4 m_projection_matrices[m_num_splits];
	glm::mat4 m_crop_matrices[m_num_splits];
	Frustum m_frustums[m_num_splits+1];
	float m_far_bounds[m_num_splits+1];
private:
	
	Scene *scene;
	std::vector<glm::vec3> objectPositions;
	
	float mWidth;
	float mHeight;
	Camera* camera;
	Shader shadowmap;
	glm::vec4 m_light_dir;
	
	
	float m_split_weight = 0.75f;
	
	glm::mat4 m_modelview;
	glm::mat4 m_bias = glm::mat4(
		0.5f, 0.0f, 0.0f, 0.0f,
		0.0f, 0.5f, 0.0f, 0.0f,
		0.0f, 0.0f, 0.5f, 0.0f,
		0.5f, 0.5f, 0.5f, 1.0f
	);

};