# blog.aldolushkja.it

Technical blog built with [Astro](https://astro.build), deployed as a static
site on S3 + CloudFront via AWS CDK — the same deploy pattern used for
[aldolushkja.it](https://aldolushkja.it) and `tools.aldolushkja.it`.

It also has a small content pipeline that keeps a topic backlog and drafts
post skeletons twice a month — see `content-pipeline/README.md`. It runs on
`trustbuddy-vps` via Claude Code + systemd timers, not AWS; the article body
is still written by hand.

## Structure

```
frontend/           Astro site (content in src/content/blog/*.md)
cdk/                 AWS CDK app: BlogSiteStack (S3+CloudFront)
content-pipeline/    Topic backlog + collector/drafter prompts & scripts (runs on trustbuddy-vps)
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
make install       # frontend + cdk deps
make cdk-synth
make cdk-diff
make cdk-deploy    # deploys the site stack
```

CI (`.github/workflows/deploy.yml`) deploys on push to `main` using the same
AWS secrets as the other `*.aldolushkja.it` repos, plus optionally
`secrets.BLOG_CERTIFICATE_ARN` (omit to let CDK issue a fresh ACM cert for
`blog.aldolushkja.it` on first deploy).

`.github/workflows/validate.yml` runs on every PR (including the ones the
drafter opens) — builds the frontend and the CDK app, no AWS credentials
needed.

## Content pipeline

See `content-pipeline/README.md` for how the daily collector and bi-monthly
drafter work, how to trigger a run manually, and how to check on it.
