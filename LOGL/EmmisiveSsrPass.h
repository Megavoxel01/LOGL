#pragma once

#include <RenderPass.h>


class EmmisiveSsrPass : public RenderPass {
public:
	EmmisiveSsrPass();
	~EmmisiveSsrPass();
	void init();
	void update();
	void execute();
private:
	
};