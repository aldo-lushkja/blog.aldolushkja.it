# blog.aldolushkja.it

Technical blog built with [Astro](https://astro.build), deployed as a static
site on S3 + CloudFront via AWS CDK — the same deploy pattern used for
[aldolushkja.it](https://aldolushkja.it) and `tools.aldolushkja.it`.

It also ships a small content pipeline: a daily Lambda scans technical RSS
feeds and uses Bedrock (Claude) to maintain a ranked topic backlog in
DynamoDB, and a twice-a-month Lambda turns the top backlog topic into an
article skeleton (title, outline, sources, front-matter) and opens a draft
PR — the article body is still written by hand.

## Structure

```
frontend/    Astro site (content in src/content/blog/*.md)
cdk/         AWS CDK app: BlogSiteStack (S3+CloudFront) + ContentPipelineStack (DynamoDB+Lambda+EventBridge)
lambdas/     collector/ + drafter/ Lambda sources, sharing lambdas/shared/*
```

## Local development

```bash
make frontend-install
make frontend-dev       # http://localhost:5173
make frontend-build     # -> frontend/dist
```

New posts go in `frontend/src/content/blog/<slug>.md` with front-matter:

```yaml
---
title: "..."
description: "..."
pubDate: 2026-01-01
tags: ["aws", "distributed-systems"]
draft: false
---
```

## Deploying

Requires the AWS CLI configured with the `aldolushkja.it` profile (or set
`AWS_PROFILE`/`DOMAIN_NAME` to override), and Docker running locally (the
frontend is built inside a `node:24` container as part of the CDK asset
bundling, matching `aldolushkja.it/cdk`).

```bash
make install       # frontend + lambdas + cdk deps
make cdk-synth
make cdk-diff
make cdk-deploy    # deploys both stacks
```

Deploy a single stack with CDK context: `cd cdk && npx cdk deploy -c stack=site`
or `-c stack=pipeline`.

CI (`.github/workflows/deploy.yml`) deploys on push to `main` using the same
AWS secrets as the other `*.aldolushkja.it` repos, plus:

- `secrets.BLOG_CERTIFICATE_ARN` (optional — omit to let CDK issue a fresh
  ACM cert for `blog.aldolushkja.it` on first deploy)
- `vars.BEDROCK_MODEL_ID` (optional — see below)

## One-time prerequisites for the content pipeline

1. **Enable Bedrock model access** for a Claude model in the target
   account/region (Bedrock console → Model access). Once you know the exact
   model id enabled for your account, set it via `BEDROCK_MODEL_ID` (env var
   locally, or the `BEDROCK_MODEL_ID` repo variable in CI) — it defaults to
   `anthropic.claude-3-5-sonnet-20241022-v2:0`, which may not match what's
   enabled for you.
2. **Create the pipeline secret** the Lambdas read at runtime:
   ```bash
   aws secretsmanager create-secret \
     --name blog/content-pipeline \
     --profile aldolushkja.it \
     --secret-string '{"TELEGRAM_BOT_TOKEN":"...","TELEGRAM_CHAT_ID":"...","GITHUB_TOKEN":"..."}'
   ```
   `GITHUB_TOKEN` needs repo scope to open PRs against this repository.
3. Confirm `GITHUB_REPO` (env var, defaults to `aldolushkja/blog.aldolushkja.it`
   or `${{ github.repository }}` in CI) matches this repo's `owner/name`.

## Manually triggering a pipeline run

```bash
aws lambda invoke --function-name blog-topic-collector --profile aldolushkja.it out.json
aws lambda invoke --function-name blog-topic-drafter --profile aldolushkja.it out.json
```
