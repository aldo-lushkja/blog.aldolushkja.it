---
title: "curl's Summer of Bliss: What AI Slop Bug Reports Actually Cost"
description: "curl's confirmed-vulnerability rate fell from 15% to under 5% as AI-generated reports flooded a seven-person volunteer team — so it took a month off."
pubDate: 2026-07-26
tags: ["security", "open-source", "ai-agents", "maintainer-burnout"]
draft: true
---

curl is one of the most widely deployed pieces of software on earth — it ships in operating systems, embedded devices, and just about every programming language's HTTP tooling. In mid-2026, its maintainers closed the front door to new vulnerability reports for five weeks. Not because curl had run out of bugs. Because the volume of AI-generated noise arriving alongside the real reports had made the reporting channel itself unsustainable for the small volunteer team responsible for triaging it.

Daniel Stenberg, curl's lead maintainer, called the pause the **"summer of bliss."** It's a useful, sharply-worded case study in what "let AI find your bugs" actually costs the people on the other end of the report queue.

## The numbers behind the decision

curl's security team historically confirmed a real vulnerability in roughly **15%** of submitted reports — already a workload, but a sustainable one. By 2025, that confirmation rate had fallen to **under 5%**. Stenberg's own estimate is that roughly **20% of all incoming submissions are AI slop**: reports that cite functions that don't exist, reference code paths that aren't actually reachable, or otherwise read as plausible without describing anything real.

The submission rate itself kept compounding. Report volume in 2026 **doubled** compared to 2025 — a year that had itself already **more than doubled** the rate of the years before it. All of this lands on a team Stenberg describes simply as small: a handful of volunteer maintainers, not a dedicated security operations staff.

The clearest early sign of what this looked like in practice: seven reports arrived on curl's HackerOne program within a single 16-hour window early in 2026. Stenberg's assessment after reviewing them: *"none of them identified a vulnerability."*

## Why "just add better filtering" doesn't fix it

The instinct here is that this is a triage problem, solvable by getting better at spotting bad reports faster. It doesn't fully hold, and the reason is economic rather than technical: an LLM has driven the cost of producing a plausible-sounding security report to nearly zero, while the cost of a human actually reading the code, checking whether the claimed function exists, and confirming or ruling out the claim stays fixed and high. A report doesn't have to be well-crafted to consume real maintainer time — it just has to be plausible enough to require a human to check.

That asymmetry means volume alone is the attack, independent of any individual report's quality. A community member's comment on the discussion around curl's decision captured the underlying sentiment well: *"If you found it with an LLM, anyone else could have found it, and probably already have."* The implication being that most AI-assisted "discoveries" aren't finding anything a human researcher — or the maintainers themselves — hadn't already ruled out; they're just costing someone time to re-derive that.

## The timeline: two separate retreats

curl actually pulled back twice, in escalating steps, before the "summer of bliss."

**End of January 2026** — curl ended its paid HackerOne bug bounty program entirely. Stenberg was explicit about the reasoning: *"The main goal with shutting down the bounty is to remove the incentive for people to submit crap and non-well researched reports to us."* He also pointed to data specific to curl's own program: *"We seem to have data that confirms that the #curl bug-bounty has received a steep increased submission rate through 2025, while several other Open Source programs also hosted on HackerOne have not."* Paying for reports, in other words, had itself become part of the incentive structure drawing in low-effort AI-generated submissions. Submissions moved to GitHub issues instead of HackerOne's paid-bounty flow.

**July 1 – August 3, 2026** — the "summer of bliss" itself: curl stopped accepting *all* new vulnerability reports, through any channel — HackerOne or direct email — with an exception carved out for paid support contract holders. GitHub's issue and pull-request trackers stayed open throughout; this was specifically a pause on the formal vulnerability-report intake pipeline, not a shutdown of the project. Stenberg framed the reasoning plainly: *"Now we need some rest. We do not expect this deluge to be over."* The following curl release (8.22.0) slipped by two weeks to accommodate the pause.

## What this means beyond curl

curl is a useful test case precisely because it's not a marginal project — it's about as close to universally deployed as open-source software gets, actively maintained, historically well-regarded for security response, and still overwhelmed. The "let AI find bugs for open source, for free" pitch has an obvious appeal: more eyes on more code, at no marginal cost to the person running the tool. What it misses is that the marginal cost was never zero — it was just moved onto whoever has to read the report, and that person is frequently an unpaid volunteer maintainer who is also, as Stenberg's framing makes clear, just trying to get some rest.

None of this is an argument that AI-assisted vulnerability research is worthless — plenty of legitimate findings do come from AI-assisted tooling, and curl's own reduced-but-nonzero confirmed-vulnerability rate proves some fraction of submissions were real. It's an argument that report *volume*, not just report *quality*, is now something maintainers have to defend against directly — through bounty program design, submission gating, or explicit and repeated pauses like this one — rather than something that quietly scales alongside the number of people willing to run a scanner.

## Sources

- [Curl pauses security reports for a month to get a break from AI spam — Cybernews](https://cybernews.com/security/curl-stops-accepting-bug-reports-for-july/)
- [Stenberg: curl summer of bliss — LWN.net](https://lwn.net/Articles/1077946/)
- [Curl ending bug bounty program after flood of AI slop reports — BleepingComputer](https://www.bleepingcomputer.com/news/security/curl-ending-bug-bounty-program-after-flood-of-ai-slop-reports/)
