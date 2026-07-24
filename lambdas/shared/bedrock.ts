import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';

const client = new BedrockRuntimeClient({});

export interface InvokeClaudeOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * Invokes the configured Bedrock Claude model (BEDROCK_MODEL_ID env var) with
 * a single user turn and returns the concatenated text content.
 */
export async function invokeClaude({ system, prompt, maxTokens = 4096, temperature = 0.4 }: InvokeClaudeOptions): Promise<string> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId) throw new Error('BEDROCK_MODEL_ID environment variable is not set');

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: maxTokens,
    temperature,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
  });

  const response = await client.send(
    new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body,
    }),
  );

  const payload = JSON.parse(new TextDecoder().decode(response.body));
  const text = (payload.content ?? [])
    .filter((block: { type: string }) => block.type === 'text')
    .map((block: { text: string }) => block.text)
    .join('\n');

  if (!text) throw new Error(`Bedrock response had no text content: ${JSON.stringify(payload)}`);
  return text;
}

/**
 * Best-effort extraction of a JSON value from a Claude response, tolerating
 * ```json fenced blocks or leading/trailing prose around the JSON payload.
 */
export function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  const end = Math.max(candidate.lastIndexOf('}'), candidate.lastIndexOf(']'));
  const jsonSlice = start >= 0 && end >= start ? candidate.slice(start, end + 1) : candidate;
  return JSON.parse(jsonSlice) as T;
}
