import { invokeClaude, extractJson } from '../../shared/bedrock';
import type { Topic } from '../../shared/types';

export interface ArticleSkeleton {
  title: string;
  description: string;
  tags: string[];
  outline: { heading: string; notes: string }[];
}

export async function generateSkeleton(topic: Topic): Promise<ArticleSkeleton> {
  const system = [
    'You outline (never fully write) technical blog posts for a senior software engineer\'s',
    'personal blog. The writer fills in the actual prose themselves — your job is to hand them',
    'a tight starting point: a sharp title, a one-line meta description, and a section-by-section',
    'outline with a couple of guiding notes per section (not full paragraphs).',
    'Only reference the sources you were given — never invent URLs.',
    'Respond with ONLY a JSON object, no prose, matching this shape:',
    '{"title": string (<70 chars), "description": string (<160 chars, meta description),',
    '"tags": string[] (2-4 lowercase kebab-case tags), ' +
      '"outline": [{"heading": string, "notes": string (1-2 sentences of guidance, not article prose)}]}',
    'The outline should have an introduction, 3-5 body sections, and a conclusion/takeaways section.',
  ].join(' ');

  const prompt = JSON.stringify(
    {
      topicTitle: topic.title,
      topicSummary: topic.summary,
      tags: topic.tags,
      sources: topic.sources,
    },
    null,
    2,
  );

  const text = await invokeClaude({ system, prompt, maxTokens: 2000, temperature: 0.6 });
  return extractJson<ArticleSkeleton>(text);
}

export function renderMarkdown(skeleton: ArticleSkeleton, topic: Topic, pubDate: string): string {
  const frontMatter = [
    '---',
    `title: "${skeleton.title.replace(/"/g, '\\"')}"`,
    `description: "${skeleton.description.replace(/"/g, '\\"')}"`,
    `pubDate: ${pubDate}`,
    `tags: [${skeleton.tags.map((t) => `"${t}"`).join(', ')}]`,
    'draft: true',
    '---',
  ].join('\n');

  const outline = skeleton.outline
    .map((section) => `## ${section.heading}\n\n<!-- ${section.notes} -->\n`)
    .join('\n');

  const sources = topic.sources.length
    ? `## Sources\n\n${topic.sources.map((url) => `- ${url}`).join('\n')}\n`
    : '';

  return `${frontMatter}\n\n${outline}\n${sources}`;
}
