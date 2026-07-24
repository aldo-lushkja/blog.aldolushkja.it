---
title: "Welcome to the new blog"
description: "Why I moved off Hashnode and rebuilt this blog with Astro, S3, and CloudFront — and what's coming next."
pubDate: 2026-07-24
tags: ["meta", "astro", "aws"]
draft: false
---

For a while this blog lived on Hashnode. It worked, but it wasn't *mine* — I couldn't
control the performance budget, the build pipeline, or how content flowed from idea to
published post. So I rebuilt it.

## What changed

- **Astro**, statically built, shipping close to zero JavaScript by default.
- **S3 + CloudFront**, deployed with the same AWS CDK pattern I already use for
  [aldolushkja.it](https://aldolushkja.it) and `tools.aldolushkja.it`.
- Content lives as Markdown in this repo, versioned like everything else I ship.

## What's next

I'm pairing this with a small automation pipeline: a daily job scans technical sources
for topics worth writing about, and twice a month it opens a pull request with a
skeleton post — title, outline, and sources — ready for me to fill in. The goal is a
steady cadence of posts about software engineering, cloud infrastructure, and the rest
of the IT world, without losing the personal voice that makes a blog worth reading.

More soon.
