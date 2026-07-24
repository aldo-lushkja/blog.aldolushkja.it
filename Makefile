AWS_PROFILE ?= aldolushkja.it
DOMAIN_NAME ?= blog.aldolushkja.it
CDK_DIR := cdk
FRONTEND_DIR := frontend
LAMBDAS_DIR := lambdas

.PHONY: help
help:
	@printf '%s\n' \
		'Available targets:' \
		'  make frontend-install   Install frontend dependencies' \
		'  make frontend-build     Build the frontend bundle' \
		'  make frontend-dev       Run the Astro dev server' \
		'  make frontend-preview   Preview the production build' \
		'  make lambdas-install    Install shared Lambda dependencies' \
		'  make cdk-install        Install CDK dependencies' \
		'  make cdk-build          Compile the CDK app' \
		'  make cdk-test           Run CDK tests' \
		'  make cdk-synth          Synthesize the CDK app' \
		'  make cdk-diff           Show CDK diff' \
		'  make cdk-preflight      Print AWS profile/account/region before deploy' \
		'  make cdk-deploy         Deploy the CDK stacks with AWS profile' \
		'  make install            Install all dependencies (frontend + lambdas + cdk)' \
		'  make aws-whoami         Show the active AWS identity for the profile'

.PHONY: frontend-install
frontend-install:
	cd $(FRONTEND_DIR) && npm install

.PHONY: frontend-build
frontend-build:
	cd $(FRONTEND_DIR) && npm run build

.PHONY: frontend-dev
frontend-dev:
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: frontend-preview
frontend-preview:
	cd $(FRONTEND_DIR) && npm run preview

.PHONY: lambdas-install
lambdas-install:
	cd $(LAMBDAS_DIR) && npm install

.PHONY: cdk-install
cdk-install:
	cd $(CDK_DIR) && npm install

.PHONY: cdk-build
cdk-build:
	cd $(CDK_DIR) && npm run build

.PHONY: cdk-test
cdk-test:
	cd $(CDK_DIR) && npm test -- --runInBand --no-watchman

.PHONY: cdk-synth
cdk-synth:
	cd $(CDK_DIR) && AWS_PROFILE=$(AWS_PROFILE) DOMAIN_NAME=$(DOMAIN_NAME) npx cdk synth --profile $(AWS_PROFILE)

.PHONY: cdk-diff
cdk-diff:
	cd $(CDK_DIR) && AWS_PROFILE=$(AWS_PROFILE) DOMAIN_NAME=$(DOMAIN_NAME) npx cdk diff --profile $(AWS_PROFILE)

.PHONY: cdk-preflight
cdk-preflight:
	@printf 'AWS profile: %s\n' '$(AWS_PROFILE)'
	@printf 'Domain: %s\n' '$(DOMAIN_NAME)'
	@aws sts get-caller-identity --profile $(AWS_PROFILE)
	@aws configure get region --profile $(AWS_PROFILE)

.PHONY: cdk-deploy
cdk-deploy:
	$(MAKE) cdk-preflight
	@printf 'Starting CDK deploy with verbose event output...\n'
	cd $(CDK_DIR) && AWS_PROFILE=$(AWS_PROFILE) DOMAIN_NAME=$(DOMAIN_NAME) script -q /dev/null /bin/sh -lc 'npx cdk deploy --all --require-approval never --profile $(AWS_PROFILE) --progress events --verbose'
	@printf 'CDK deploy command finished.\n'

.PHONY: install
install: frontend-install lambdas-install cdk-install

.PHONY: aws-whoami
aws-whoami:
	aws sts get-caller-identity --profile $(AWS_PROFILE)
