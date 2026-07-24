import type { ScheduledHandler } from 'aws-lambda';
import { getTopicsByStatus, updateTopicStatus } from '../../shared/dynamo';
import { notifyTelegram } from '../../shared/telegram';
import { openDraftPr } from '../../shared/github';
import { slugify } from '../../shared/slugify';
import { generateSkeleton, renderMarkdown } from './skeleton';

export const handler: ScheduledHandler = async () => {
  const candidates = await getTopicsByStatus('new', 1);

  if (candidates.length === 0) {
    console.log('No topics with status "new" available to draft');
    await notifyTelegram('✍️ *Blog drafter run*: backlog is empty, nothing to draft this time.');
    return;
  }

  const topic = candidates[0];
  console.log(`Drafting skeleton for topic "${topic.title}" (score ${topic.score})`);

  const skeleton = await generateSkeleton(topic);
  const slug = slugify(skeleton.title || topic.title);
  const pubDate = new Date().toISOString().slice(0, 10);
  const markdown = renderMarkdown(skeleton, topic, pubDate);
  const filePath = `frontend/src/content/blog/${slug}.md`;
  const branchName = `content/${slug}`;

  const prBody = [
    `Auto-generated skeleton for: **${skeleton.title}**`,
    '',
    skeleton.description,
    '',
    '### Outline',
    ...skeleton.outline.map((s) => `- ${s.heading}`),
    '',
    `Backlog topic: \`${topic.topicId}\` (score ${topic.score})`,
    '',
    'This PR is a **draft** — fill in the body, review the front-matter, then flip `draft: false` and merge.',
  ].join('\n');

  const prUrl = await openDraftPr({
    filePath,
    fileContent: markdown,
    branchName,
    prTitle: `Draft: ${skeleton.title}`,
    prBody,
  });

  await updateTopicStatus(topic.topicId, 'drafted', { prUrl });

  await notifyTelegram(
    `✍️ *New draft ready*\n*${skeleton.title}*\n\n${skeleton.description}\n\n${prUrl}`,
  );

  console.log(`Opened draft PR: ${prUrl}`);
};
