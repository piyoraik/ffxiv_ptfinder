.PHONY: build-PtfinderFunction

# SAM build entrypoint for the function.
build-PtfinderFunction:
	@echo "==> Installing dependencies"
	npm ci
	@echo "==> Building TypeScript"
	npm run -s build
	@echo "==> Pruning devDependencies"
	npm prune --omit=dev
	@echo "==> Copying artifacts"
	cp -R dist $(ARTIFACTS_DIR)/
	cp -R data $(ARTIFACTS_DIR)/
	cp package.json package-lock.json $(ARTIFACTS_DIR)/
	cp -R node_modules $(ARTIFACTS_DIR)/

