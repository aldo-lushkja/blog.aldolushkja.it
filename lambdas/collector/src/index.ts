import { randomUUID } from 'node:crypto';
import Parser from 'rss-parser';
import type { ScheduledHandler } from 'aws-lambda';
import { invokeClaude, extractJson } from '../../shared/bedrock';
import { putTopic, getAllTopicTitles } from '../../shared/dynamo';
import { notifyTelegram } from '../../shared/telegram';
import type { FeedItemCandidate, Topic } from '../../shared/types';
import { FEEDS } from './feeds';

const MAX_ITEMS_PER_FEED = 8;
const MAX_NEW_TOPICS_PER_RUN = 8;

const parser = new Parser({ timeout: 10_000 });

async function fetchCandidates(): Promise<FeedItemCandidate[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return (parsed.items ?? []).slice(0, MAX_ITEMS_PER_FEED).map(
        (item): FeedItemCandidate => ({
          title: item.title ?? 'Untitled',
          link: item.link ?? '',
          snippet: (item.contentSnippet ?? item.content ?? '').slice(0, 400),
          source: feed.name,
          publishedAt: item.isoDate,
        }),
      );
    }),
  );

  const candidates: FeedItemCandidate[] = [];
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      candidates.push(...result.value);
    } else {
      console.error(`Feed "${FEEDS[i].name}" failed: ${result.reason}`);
    }
  });
  return candidates;
}

interface RankedTopic {
  title: string;
  summary: string;
  tags: string[];
  score: number;
  sources: string[];
}

async function rankTopics(candidates: FeedItemCandidate[], existingTitles: string[]): Promise<RankedTopic[]> {
  const system = [
    'You curate topic ideas for a technical blog written by a senior software engineer.',
    'The audience cares about software engineering, cloud infrastructure, distributed systems,',
    'and the broader IT world. Prefer topics with technical depth over generic news.',
    'You will be given raw feed items and a list of topics already in the backlog.',
    'Propose NEW topic ideas only — skip anything that duplicates or closely overlaps an existing backlog title.',
    'Respond with ONLY a JSON array, no prose, matching this shape:',
    '[{"title": string, "summary": string (2-3 sentences, the angle to take), "tags": string[] (2-4 lowercase kebab-case tags), "score": number (1-10, technical interest and evergreen value), "sources": string[] (source URLs)}]',
  ].join(' ');

  const prompt = JSON.stringify(
    {
      existingBacklogTitles: existingTitles,
      candidateItems: candidates.map((c) => ({
        title: c.title,
        link: c.link,
        snippet: c.snippet,
        source: c.source,
      })),
      maxTopics: MAX_NEW_TOPICS_PER_RUN,
    },
    null,
    2,
  );

  const text = await invokeClaude({ system, prompt, maxTokens: 3000, temperature: 0.5 });
  return extractJson<RankedTopic[]>(text);
}

export const handler: ScheduledHandler = async () => {
  console.log('Collecting candidate topics from feeds...');
  const candidates = await fetchCandidates();
  console.log(`Fetched ${candidates.length} candidate items from ${FEEDS.length} feeds`);

  if (candidates.length === 0) {
    console.warn('No candidate items fetched, skipping this run');
    return;
  }

  const existingTitles = await getAllTopicTitles();
  const ranked = await rankTopics(candidates, existingTitles);
  console.log(`Bedrock proposed ${ranked.length} new topics`);

  const now = new Date().toISOString();
  const saved: Topic[] = [];

  for (const item of ranked.slice(0, MAX_NEW_TOPICS_PER_RUN)) {
    const topic: Topic = {
      topicId: randomUUID(),
      title: item.title,
      summary: item.summary,
      tags: item.tags ?? [],
      score: item.score ?? 5,
      sources: item.sources ?? [],
      status: 'new',
      createdAt: now,
      updatedAt: now,
    };
    await putTopic(topic);
    saved.push(topic);
  }

  if (saved.length > 0) {
    const top = [...saved].sort((a, b) => b.score - a.score).slice(0, 5);
    const lines = top.map((t) => `• *${t.title}* (score ${t.score}) — ${t.tags.join(', ')}`);
    await notifyTelegram(
      `📚 *Blog topic backlog update*\n${saved.length} new topic(s) added.\n\n${lines.join('\n')}`,
    );
  } else {
    console.log('No new topics accepted this run (all duplicates or below threshold)');
  }
};
