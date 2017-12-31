#pragma once
#include <RenderPass.h>

class ShadowMapping : public RenderPass {
public:
	ShadowMapping() {}
	~ShadowMapping(){}
	void init();
	void update();
	void execute();
private:

};