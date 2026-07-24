export type TopicStatus = 'new' | 'queued' | 'drafted' | 'published';

export interface Topic {
  topicId: string;
  title: string;
  summary: string;
  sources: string[];
  tags: string[];
  score: number;
  status: TopicStatus;
  createdAt: string;
  updatedAt: string;
  prUrl?: string;
}

export interface FeedItemCandidate {
  title: string;
  link: string;
  snippet: string;
  source: string;
  publishedAt?: string;
}

export interface PipelineSecrets {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
  GITHUB_TOKEN: string;
}
