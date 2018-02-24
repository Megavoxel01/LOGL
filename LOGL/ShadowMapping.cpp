#include <ShadowMapping.h>

ShadowMapping::ShadowMapping(Camera* _camera, Scene *scene): 
	shadowmap("shader/shadow.vert", "shader/shadow.frag")
{
	this->scene = scene;
	this->camera = _camera;
}

ShadowMapping::~ShadowMapping() {

}

void ShadowMapping::init()
{
	float camera_fov = camera->Zoom;
	float width = 1024;
	float height = 1024;
	float ratio = width / height;

	// note that fov is in radians here and in OpenGL it is in degrees.
	// the 0.2f factor is important because we might get artifacts at
	// the screen borders.
	for (int i = 0; i <= m_num_splits; i++) {
		m_frustums[i].m_fov = camera_fov / 57.2957795 + 0.2f;
		m_frustums[i].m_ratio = ratio;
	}

	m_bias = glm::mat4(
		0.5f, 0.0f, 0.0f, 0.0f,
		0.0f, 0.5f, 0.0f, 0.0f,
		0.0f, 0.0f, 0.5f, 0.0f,
		0.5f, 0.5f, 0.5f, 1.0f
	);

	update_split_distances();


	//if (m_texture_array) {
	//	glDeleteTextures(1, &m_texture_array);
	//}

	glGenTextures(1, &m_texture_array);
	glBindTexture(GL_TEXTURE_2D_ARRAY, m_texture_array);
	glTexImage3D(GL_TEXTURE_2D_ARRAY, 0, GL_DEPTH_COMPONENT24, 1024, 1024, 4, 0, GL_DEPTH_COMPONENT, GL_UNSIGNED_BYTE, NULL);
	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_COMPARE_FUNC, GL_LEQUAL);

	glTexParameteri(GL_TEXTURE_2D_ARRAY, GL_TEXTURE_COMPARE_MODE, GL_NONE);
	//glTexParameteri(GL_TEXTURE_2D_ARRAY_EXT, GL_TEXTURE_COMPARE_MODE, GL_COMPARE_R_TO_TEXTURE);

	glBindTexture(GL_TEXTURE_2D_ARRAY, 0);
}

void ShadowMapping::update(const glm::mat4& projection, const glm::mat4& view, glm::vec3& lightdir, const Camera* camera, std::vector<glm::vec3>& objectPositions)
{
	this->objectPositions = objectPositions;
	this->m_light_dir = glm::vec4(lightdir.x, lightdir.y, lightdir.z, 0);
	glm::mat4 t_modelview = glm::lookAt(
		glm::vec3(0.0, 0.0, 0.0),
		glm::vec3(-lightdir.x, -lightdir.y, -lightdir.z),
		glm::vec3(-1.0f, 0.0f, 0.0f));
	/*glm::mat4 t_modelview = glm::lookAt(
		-lightdir,
		glm::vec3(0.0f),
		glm::vec3(0.0f, 1.0f, 0.0f));*/

	//update_split_distances(camera);
	update_split_frustum_points();
	generate_crop_matrices(t_modelview);
	m_modelview = t_modelview;

	// Required camera matices
	glm::mat4 t_view = view;
	glm::mat4 t_view_inverse = glm::inverse(t_view);
	glm::mat4 t_projection = projection;

	update_far_bounds(t_projection, t_view_inverse);
	update_texture_matrices(t_projection, t_view_inverse);
}

void ShadowMapping::update_split_distances() {
	float nd = 0.1f;
	float fd = 50.0f;

	float lambda = m_split_weight;
	float ratio = fd / nd;
	m_frustums[0].m_near = nd;

	for (int i = 1; i < m_num_splits; i++) {
		float si = i / (float)m_num_splits;

		float t_near = lambda * (nd * powf(ratio, si)) + (1 - lambda) * (nd + (fd - nd) * si);
		float t_far = t_near * 1.005f;
		m_frustums[i].m_near = t_near;
		m_frustums[i - 1].m_far = t_far;
	}
	m_frustums[m_num_splits - 1].m_far = fd;
}

/** Compute the camera frustum slice boundary points in world space */
void ShadowMapping::update_split_frustum_points() {
	glm::vec3 center = camera->Position;
	glm::vec3 view_dir = camera->Front;

	glm::vec3 up(0.0f, 1.0f, 0.0f);
	glm::vec3 right = glm::cross(view_dir, up);

	for (int i = 0; i < m_num_splits; i++) {
		Frustum& t_frustum = m_frustums[i];

		glm::vec3 fc = center + view_dir * t_frustum.m_far;
		glm::vec3 nc = center + view_dir * t_frustum.m_near;

		right = glm::normalize(right);
		up = glm::normalize(glm::cross(right, view_dir));

		// these heights and widths are half the heights and widths of
		// the near and far plane rectangles
		float near_height = tan(t_frustum.m_fov / 2.0f) * t_frustum.m_near;
		float near_width = near_height * t_frustum.m_ratio;
		float far_height = tan(t_frustum.m_fov / 2.0f) * t_frustum.m_far;
		float far_width = far_height * t_frustum.m_ratio;

		t_frustum.m_points[0] = nc - up * near_height - right * near_width;
		t_frustum.m_points[1] = nc + up * near_height - right * near_width;
		t_frustum.m_points[2] = nc + up * near_height + right * near_width;
		t_frustum.m_points[3] = nc - up * near_height + right * near_width;

		t_frustum.m_points[4] = fc - up * far_height - right * far_width;
		t_frustum.m_points[5] = fc + up * far_height - right * far_width;
		t_frustum.m_points[6] = fc + up * far_height + right * far_width;
		t_frustum.m_points[7] = fc - up * far_height + right * far_width;
	}
}

/**
* Adjust the view frustum of the light, so that it encloses the camera frustum slice fully.
* Note that this function sets the projection matrix as it sees best fit
* minZ is just for optimization to cull trees that do not affect the shadows
*/
void ShadowMapping::generate_crop_matrices(const glm::mat4& t_modelview) {
	glm::mat4 t_projection;
	for (int i = 0; i < m_num_splits; i++) {
		Frustum& t_frustum = m_frustums[i];

		glm::vec3 tmax(-1000.0f, -1000.0f, 0.0f);
		glm::vec3 tmin(1000.0f, 1000.0f, 0.0f);

		// find the z-range of the current frustum as seen from the light
		// in order to increase precision

		// note that only the z-component is need and thus
		// the multiplication can be simplified
		// transf.z = shad_modelview[2] * f.point[0].x + shad_modelview[6] * f.point[0].y + shad_modelview[10] * f.point[0].z + shad_modelview[14];
		glm::vec4 t_transf = t_modelview * glm::vec4(t_frustum.m_points[0], 1.0f);

		tmin.z = t_transf.z;
		tmax.z = t_transf.z;
		for (int j = 1; j < 8; j++) {
			t_transf = t_modelview * glm::vec4(t_frustum.m_points[j], 1.0f);
			if (t_transf.z > tmax.z) { tmax.z = t_transf.z; }
			if (t_transf.z < tmin.z) { tmin.z = t_transf.z; }
		}

		// make sure all relevant shadow casters are included
		// note that these here are dummy objects at the edges of our scene
		/*for(int i = 0 ; i < NUM_OBJECTS ; i++) {
		t_transf = t_modelview * vec4(obj_BSphere[i].center, 1.0f);
		if(t_transf.z + obj_BSphere[i].radius > tmax.z) {
		tmax.z = t_transf.z + obj_BSphere[i].radius;
		}
		//if(transf.z - obj_BSphere[i].radius < minZ) { minZ = transf.z - obj_BSphere[i].radius; }
		}*/

		tmax.z += 50; // TODO: This solves the dissapearing shadow problem. but how to fix?

		glm::mat4 t_ortho = glm::ortho(-1.0f, 1.0f, -1.0f, 1.0f, -tmax.z, -tmin.z);
		glm::mat4 t_shad_mvp = t_ortho * t_modelview;

		// find the extends of the frustum slice as projected in light's homogeneous coordinates
		for (int j = 0; j < 8; j++) {
			t_transf = t_shad_mvp * glm::vec4(t_frustum.m_points[j], 1.0f);

			t_transf.x /= t_transf.w;
			t_transf.y /= t_transf.w;

			if (t_transf.x > tmax.x) { tmax.x = t_transf.x; }
			if (t_transf.x < tmin.x) { tmin.x = t_transf.x; }
			if (t_transf.y > tmax.y) { tmax.y = t_transf.y; }
			if (t_transf.y < tmin.y) { tmin.y = t_transf.y; }
		}

		glm::vec2 tscale(2.0f / (tmax.x - tmin.x), 2.0f / (tmax.y - tmin.y));
		glm::vec2 toffset(-0.5f * (tmax.x + tmin.x) * tscale.x, -0.5f * (tmax.y + tmin.y) * tscale.y);

		glm::mat4 t_shad_crop;
		t_shad_crop[0][0] = tscale.x;
		t_shad_crop[1][1] = tscale.y;
		t_shad_crop[0][3] = toffset.x;
		t_shad_crop[1][3] = toffset.y;
		t_shad_crop = glm::transpose(t_shad_crop);

		t_projection = t_shad_crop * t_ortho;

		//return tmin.z;

		// Store the projection matrix
		m_projection_matrices[i] = t_projection;

		// store the product of all shadow matries for later
		m_crop_matrices[i] = t_projection * t_modelview;
	}
}

void ShadowMapping::update_far_bounds(const glm::mat4& projection, const glm::mat4& view_inverse) {
	for (int i = m_num_splits; i <= m_num_splits; i++) {
		m_far_bounds[i] = 0;
	}

	// for every active split
	for (int i = 0; i < m_num_splits; i++) {
		// f[i].fard is originally in eye space - tell's us how far we can see.
		// Here we compute it in camera homogeneous coordinates. Basically, we calculate
		// cam_proj * (0, 0, f[i].fard, 1)^t and then normalize to [0; 1]

		Frustum& split_frustum = m_frustums[i];
		m_far_bounds[i] = 0.5f * (-split_frustum.m_far * projection[2][2] + projection[3][2]) / split_frustum.m_far + 0.5f;
	}
}

/** */
void ShadowMapping::update_texture_matrices(const glm::mat4& projection, const glm::mat4& view_inverse) {
	for (int i = 0; i < m_num_splits; i++) { // for every active split
											 // compute a matrix that transforms from camera eye space to light clip space
											 // and pass it to the shader through the OpenGL texture matrices, since we
											 // don't use them now

											 // multiply the light's (bias*crop*proj*modelview) by the inverse camera modelview
											 // so that we can transform a pixel as seen from the camera
		m_texture_matrices[i] = m_bias * m_crop_matrices[i] * view_inverse;

		// compute a normal matrix for the same thing (to transform the normals)
		// Basically, N = ((L)^-1)^-t

		/* TODO: Why is this here?
		glm::mat4 t_mat_nm = glm::inverse(t_mat_texture);
		t_mat_nm = glm::transpose(t_mat_nm);
		glActiveTexture(GL_TEXTURE0 + (GLenum)(i+4));
		glMatrixMode(GL_TEXTURE);
		glLoadMatrixf(glm::value_ptr(t_mat_nm));*/
	}
}

void ShadowMapping::execute() 
{
	glm::vec4 t_lightdir = this->m_light_dir;

	//glDisable(GL_TEXTURE_2D);
	// since the shadow maps have only a depth channel, we don't need color computation
	// glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);

	shadowmap.Use();

	// redirect rendering to the depth texture
	m_fbo.Bind();

	// store the screen viewport
	//glPushAttrib(GL_VIEWPORT_BIT);

	// and render only to the shadowmap
	glViewport(0, 0, 1024, 1024);

	// offset the geometry slightly to prevent z-fighting
	// note that this introduces some light-leakage artifacts
	//glPolygonOffset(1.0f, 4096.0f);
	//glEnable(GL_POLYGON_OFFSET_FILL);

	//glDisable(GL_CULL_FACE);


	glm::mat4 model11;
	//GLint aaa=glGetUniformLocation(simpleDepthShader.Program, "lightSpaceMatrix");
	//glUniformMatrix4fv(aaa, 1, GL_FALSE, glm::value_ptr(lightSpaceMatrix));
	//glUniformMatrix4fv(glGetUniformLocation(simpleDepthShader.Program, "model"), 1, GL_FALSE, glm::value_ptr(model11));


	glCullFace(GL_FRONT);
	//RenderQuad();
	glm::mat4 model1;
	RenderObject* ourModel = scene->getRenderObject("ourModel");
	shadowmap.SetUniform("lightSpaceMatrix", m_modelview);
	for (int i = 0; i < m_num_splits; i++)
	{
		glFramebufferTextureLayer(GL_FRAMEBUFFER, GL_DEPTH_ATTACHMENT, m_texture_array, 0, i);
		glClear(GL_DEPTH_BUFFER_BIT);

		glm::mat4 t_projection = m_projection_matrices[i];
		shadowmap.SetUniform("projection", t_projection);


		for (GLuint j = 0; j < objectPositions.size(); j++)
		{
			model1 = glm::mat4();
			model1 = glm::translate(model1, objectPositions[j]);
			model1 = glm::scale(model1, glm::vec3(0.15f));
			shadowmap.SetUniform("model", model1);
			ourModel->getModel().Draw(shadowmap);
		}
	}
	
	glCullFace(GL_BACK);

	//glDisable(GL_POLYGON_OFFSET_FILL);
	//glPopAttrib();
	glBindFramebuffer(GL_FRAMEBUFFER, 0);

	//glEnable(GL_TEXTURE_2D);
}