#pragma once
#include <RenderPass.h>

class ScreenSpaceAO : public RenderPass {
public:
	ScreenSpaceAO() {}
	~ScreenSpaceAO(){}
	void init();
	void execute();
	void update();
private:

};