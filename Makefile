APP_NAME := Ato

.PHONY: release lint-secrets

lint-secrets:
	gitleaks detect --source . -v

release:
	@if [ ! -f .env ]; then \
		echo "Error: .env file not found. Copy .env.example to .env and fill in your Apple credentials."; \
		exit 1; \
	fi
	@echo "Current version: $$(jq -r '.version' package.json)"
	@echo ""
	@echo "Select release type:"
	@echo "  1) patch (bug fixes)"
	@echo "  2) minor (new features)"
	@echo "  3) major (breaking changes)"
	@echo ""
	@read -p "Enter choice [1-3]: " choice; \
	current=$$(jq -r '.version' package.json); \
	major=$$(echo $$current | cut -d. -f1); \
	minor=$$(echo $$current | cut -d. -f2); \
	patch=$$(echo $$current | cut -d. -f3); \
	case $$choice in \
		1) patch=$$((patch + 1));; \
		2) minor=$$((minor + 1)); patch=0;; \
		3) major=$$((major + 1)); minor=0; patch=0;; \
		*) echo "Invalid choice"; exit 1;; \
	esac; \
	new_version="$$major.$$minor.$$patch-beta"; \
	echo ""; \
	echo "Updating version to $$new_version..."; \
	jq --arg v "$$new_version" '.version = $$v' package.json > package.json.tmp && mv package.json.tmp package.json; \
	jq --arg v "$$new_version" '.version = $$v' src-tauri/tauri.conf.json > src-tauri/tauri.conf.json.tmp && mv src-tauri/tauri.conf.json.tmp src-tauri/tauri.conf.json; \
	sed -i '' "s/^version = \".*\"/version = \"$$new_version\"/" src-tauri/Cargo.toml; \
	echo "Building $(APP_NAME) $$new_version for macOS..."; \
	set -a && source .env && set +a && bun run build:mac; \
	echo ""; \
	echo "Committing version bump..."; \
	git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml; \
	git commit -m "Release v$$new_version"; \
	git tag -a "v$$new_version" -m "Release v$$new_version"; \
	git push && git push --tags; \
	echo ""; \
	echo "Creating GitHub release..."; \
	cp "src-tauri/target/release/bundle/dmg/$(APP_NAME)_$${new_version}_aarch64.dmg" "src-tauri/target/release/bundle/dmg/$(APP_NAME)-macOS.dmg"; \
	gh release create "v$$new_version" \
		--title "$(APP_NAME) v$$new_version" \
		--generate-notes \
		"src-tauri/target/release/bundle/dmg/$(APP_NAME)-macOS.dmg#$(APP_NAME) for macOS"; \
	echo ""; \
	echo "Release v$$new_version complete!"; \
	echo ""; \
	echo "Direct download link: https://github.com/$$(gh repo view --json nameWithOwner -q .nameWithOwner)/releases/latest/download/$(APP_NAME)-macOS.dmg"
