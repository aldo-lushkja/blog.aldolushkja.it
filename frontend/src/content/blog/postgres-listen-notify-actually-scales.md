---
title: "Postgres LISTEN/NOTIFY Doesn't 'Not Scale' — You're Holding It Wrong"
description: "Why LISTEN/NOTIFY throughput collapses under load, the commit-time lock behind it, and how batching gets you a 20x win without abandoning Postgres."
pubDate: 2026-07-25
tags: ["postgresql", "databases", "performance"]
draft: true
---

## Introduction

<!-- Frame the common complaint: teams treat LISTEN/NOTIFY as inherently unscalable and reach for Kafka/Redis instead. Set up DBOS's finding (2.9K -> 60K writes/sec, a 20x jump) as the hook, and preview that the real story is a specific commit-time lock, not a fundamental flaw. -->

## Why NOTIFY Blocks Group Commit

<!-- Explain the global exclusive lock Postgres takes at commit time when a transaction issues NOTIFY, and why that serializes commits that would otherwise batch together. Link this mechanically to WAL group commit so readers understand the actual bottleneck, not just "it's slow." -->

## The Naive Pattern and Where It Falls Over

<!-- Walk through the typical "NOTIFY on every write" implementation, and the load level at which it starts to choke. Use the DBOS numbers as a concrete before/after reference point. -->

## The Buffer-and-Batch Pattern

<!-- Describe the fix: buffering notifications application-side and flushing in batches, plus a polling fallback for durability. Cover the tradeoffs — added latency, complexity, at-least-once vs exactly-once delivery. -->

## When LISTEN/NOTIFY Is Still the Wrong Tool

<!-- Be honest about the ceiling: once NOTIFY payloads become a source of truth rather than a lightweight ping, or you need durable ordered delivery across restarts, this is the point to reach for a real queue. Give concrete signals for making that call. -->

## Conclusion

<!-- Recap: the lock, not LISTEN/NOTIFY itself, is the scalability limit. Batching gets most teams very far; know the line where a dedicated queue is the honest answer. -->

## Sources

- https://www.dbos.dev/blog/postgres-listen-notify-scalability
- https://news.ycombinator.com/front
