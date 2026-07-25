---
title: "A CI Build Step Leaked a GitHub Admin Token to Every Customer"
description: "How a Vite build dumped its entire environment into a security camera's firmware, and what actually stops secrets from reaching a shipped bundle."
pubDate: 2026-07-25
tags: ["security", "ci-cd", "supply-chain", "iot"]
draft: true
---

## Introduction

<!-- Set up the incident: a researcher found a live GitHub org admin token for
Hanwha, reachable in ~30 files after decrypting a consumer security camera's
firmware. Establish the stakes up front (org-wide repo access, not just one
app's blast radius) before getting into root cause. -->

## Root Cause: How a Build Env Ends Up in Client-Shipped Files

<!-- Walk through the mechanics: a Vite CI step dumped the full build
environment into files that get bundled into the frontend, then shipped
as-is into device firmware. Explain why this is easy to do by accident with
common bundler/env-var conventions (e.g. blanket env exposure) and why
frontend bundling makes "private" env vars public by default. -->

## Why This Slipped Past Review

<!-- Cover why embedded/IoT build pipelines get less scrutiny than web app
pipelines — different review culture, firmware treated as opaque binary,
fewer people diffing what actually ships. Contrast with how the same mistake
would likely get caught faster in a pure web app repo. -->

## Tooling That Would Have Caught It

<!-- Concrete, enforceable controls: CI secret scanning on build artifacts
(not just source), minimal-scope/short-lived build tokens instead of org
admin PATs, automated bundle auditing/diffing before release, and treating
firmware images as build artifacts subject to the same scanning as any
other shipped output. -->

## The Broader Lesson: Discipline Doesn't Scale, Tooling Does

<!-- Make the case that "don't leak secrets into frontend bundles" as a
developer-discipline rule is guaranteed to fail eventually, and why the fix
has to be enforced mechanically in CI/CD rather than relied on as a code
review norm. -->

## Conclusion

<!-- Tie back to the specific incident and restate the actionable takeaway:
audit what your build tooling actually exposes, scope credentials tightly,
and scan artifacts, not just source. -->

## Sources

- https://hhh.hn/hanwha-github-token/
- https://news.ycombinator.com/front
