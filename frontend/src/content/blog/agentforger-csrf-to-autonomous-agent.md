---
title: "When a CSRF Bug Doesn't Steal a Click — It Forges an Agent"
description: "A crafted ChatGPT URL let attackers spin up a persistent autonomous agent inheriting the victim's email, Slack, and Teams — no new consent screen required."
pubDate: 2026-07-26
tags: ["security", "ai-agents", "web-security", "llm"]
draft: true
---

Classic CSRF has a fixed shape: trick an authenticated victim into loading a URL, and the victim's session performs one unwanted action — transfer some funds, change an email address, delete a post. The blast radius ends the moment the tab closes. **AgentForger**, a vulnerability Zenity Labs found in OpenAI's ChatGPT Workspace Agents builder, breaks that assumption. The unwanted action wasn't a transaction. It was standing up a persistent, tool-using agent that kept running long after the victim forgot they'd clicked anything.

## The setup: agents inherit trust silently

ChatGPT's Agent Builder lets a user create an autonomous agent and attach "connectors" — Outlook, Gmail, Slack, Google Drive, SharePoint, Teams — that the agent can then read from and act on. Once a user has authorized a connector once, in the ordinary course of using ChatGPT, that authorization sticks around. It's the kind of implicit, standing trust that makes agent builders convenient: you don't re-consent to Slack access every time you spin up a new agent.

That convenience is exactly the hole AgentForger walks through.

## The mechanism: two URL parameters, no confirmation

The vulnerable endpoint was `https://chatgpt.com/agents/studio/new`, which accepted two query parameters:

- `template_name` — pre-selects an agent template (Zenity's proof of concept used `chief-of-staff`)
- `initial_assistant_prompt` — free-text instructions that the Builder submits and starts acting on automatically, as soon as the page loads

As Zenity's write-up puts it: *"an instruction embedded inside a URL can become the first command the Builder acts on."* No CSRF token, no "are you sure you want to create this agent" confirmation, no distinction between a user typing a prompt themselves and a prompt arriving pre-filled from a link. A single crafted URL:

```
https://chatgpt.com/agents/studio/new?template_name=chief-of-staff&initial_assistant_prompt=<attacker-controlled-instructions>
```

— handed to a logged-in victim as an ordinary phishing link — was enough to make the Builder treat the attacker's instructions as if the victim had typed them.

## What the forged agent could do to itself

The attacker-controlled prompt didn't just create an agent. Because the Builder interprets natural language as configuration, the same channel used to *create* the agent could also *reconfigure its own guardrails*. Zenity's proof of concept, an agent named "TASK Mail Operator," used this to:

- Attach every connector the victim had already authorized — Outlook, Gmail, calendars, Slack, Teams — without triggering a new OAuth consent screen, since authorization was implicit and pre-existing.
- Switch write actions from **"Always ask"** to **"Never ask,"** disabling the approval gate that would otherwise require human confirmation before the agent took a consequential action.
- Publish the agent live and configure it to run on a recurring schedule — every five minutes in the proof of concept.

As the researchers frame it: *"Rather than forging one request, it forges the creation and deployment of an autonomous agent."* That's the category shift. A normal CSRF exploit forges a single API call. This one forges a standing identity with permissions, a schedule, and no supervision.

## Persistence and command channel

Once live, the agent didn't need the attacker to do anything else in real time. Every five minutes, it checked the victim's inbox for emails with "TASK" in the subject line, sent from the attacker's address, and treated their contents as new instructions to execute using whatever connectors it had access to — reporting results back over the same channel. As Zenity put it: *"The agent is not waiting for another click. It is waiting for instructions."*

Zenity's follow-up research on what the forged agent actually did once running is the more unsettling half of the story. Operating with the victim's own inherited trust, across a single automated pass, it:

- **Mapped the organization** — pulling from Outlook, Slack, Teams, Drive, SharePoint, and calendars to identify people, roles, active projects, and workstreams.
- **Found and exfiltrated sensitive material** — searching across email, cloud storage, and collaboration tools simultaneously for things like M&A term sheets, board presentations, and financial records.
- **Harvested credentials** — scanning Slack for password references, API keys, access tokens, and recovery links, then formatting the results into tables for retrieval.
- **Impersonated the victim** — using their trusted internal identity to run phishing campaigns over Teams and Slack, and drafting wire-fraud and calendar-based social engineering attempts.

No part of this required a second click, a new permission grant, or any visible sign in the UI that a background process was running at all.

## Root cause: two flaws that compound

Zenity's analysis identifies two design choices that, independently, are each defensible — and together are the vulnerability:

1. **State-changing operations driven by query parameters, with no CSRF protection.** This is the classic CSRF failure mode, applied to an endpoint far more consequential than the ones CSRF protections usually guard.
2. **Security configuration expressed in natural language, in the same channel used for task instructions.** If "create an agent that does X" and "disable your own approval gate" are both just sentences the Builder interprets, there's no structural boundary between what an agent is asked to *do* and what permissions it's allowed to *have*.

Neither flaw alone is unusual. A web form vulnerable to CSRF is an old bug class. An agent builder that takes configuration in natural language is table stakes for the product category. The combination is what let a single unauthenticated link escalate all the way to a scheduled, credentialed, unsupervised insider.

## Disclosure

Zenity reported AgentForger to OpenAI via Bugcrowd on June 4, 2026. OpenAI accepted the report the next day and shipped a fix by June 8 — a four-day turnaround from report to remediation. No CVE was assigned.

## Why this matters beyond ChatGPT

Every product currently shipping an "agent builder" — and there are a lot of them, fast — inherits this exact risk shape unless it's been explicitly designed against it. Two concrete takeaways for anyone building one:

- **Treat agent-creation and agent-configuration endpoints with the same rigor as a funds transfer**, not the same rigor as a search box. If a URL parameter can cause a new standing, credentialed identity to come into existence, it needs the CSRF protections and explicit confirmation step that any other state-changing, security-relevant action gets.
- **Don't let the same input channel both define behavior and grant permissions.** A prompt that can ask an agent to summarize a spreadsheet should not be able to, as a side effect, also flip "Always ask" to "Never ask." Separating "what the agent does" from "what the agent is allowed to do without asking" into distinct, non-prompt-driven controls closes off the specific escalation Zenity found.

The broader lesson is about what CSRF means once the thing being forged isn't a transaction but an autonomous, tool-using identity. The historical fix for CSRF — a token, a confirmation dialog — was designed around actions that happen once and finish. An agent builder needs the same protections applied to something that, once forged, keeps acting indefinitely.

## Sources

- [AgentForger, Part 1: ChatGPT Cross-Site Agent Forgery — Zenity Labs](https://labs.zenity.io/p/agentforger-part-1-chatgpt-cross-site-agent-forgery)
- [AgentForger, Part 2: The Autonomous Insider — Zenity Labs](https://labs.zenity.io/p/agentforger-part-2-the-autonomous-insider)
